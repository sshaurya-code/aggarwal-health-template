"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { claudeEnabled, kickQueue, siteOrigin } from "@/lib/claude";
import { addMonths, type Doc, type Member } from "@/lib/data";
import { detailsRow, text } from "@/lib/docs";
import { checkKey, same, type Draft } from "@/lib/draft";
import { copyToDrive } from "@/lib/drive";
import { defaultRange, flagFor, marker } from "@/lib/markers";
import { db, requireAuth } from "@/lib/supabase";

async function load(id: string) {
  const { data } = await db().from("documents").select("*").eq("id", id).maybeSingle<Doc>();
  if (!data) throw new Error("Document not found");
  return data;
}

export async function readWithClaude(id: string) {
  await requireAuth();
  if (!claudeEnabled()) throw new Error("Claude isn't set up");
  await db().from("documents").update({ claude_state: "queued", claude_error: null }).eq("id", id);
  await kickQueue(await siteOrigin());
  revalidatePath("/", "layout");
}

/** Queues every document Claude has never read. */
export async function readAllUnread() {
  await requireAuth();
  if (!claudeEnabled()) throw new Error("Claude isn't set up");
  await db()
    .from("documents")
    .update({ claude_state: "queued", claude_error: null })
    .is("claude_read", null)
    .is("draft", null)
    .or("claude_state.is.null,claude_state.eq.failed");
  await kickQueue(await siteOrigin());
  revalidatePath("/", "layout");
}

export async function discardDraft(id: string) {
  await requireAuth();
  await db().from("documents").update({ draft: null }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/d/${id}`);
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s && Number.isFinite(Number(s)) ? Number(s) : null;
};

/** Saves the checked draft: details, test values and medicines become real data, and reminders follow. */
export async function saveDraft(id: string, form: FormData) {
  await requireAuth();
  const doc = await load(id);
  const draft = doc.draft;
  if (!draft) redirect(`/d/${id}`);
  const category = (text(form.get("category")) ?? doc.category) as Doc["category"];
  const memberId = category === "car" ? null : text(form.get("member_id"));
  const row = await detailsRow(doc, form, memberId);
  row.member_id = memberId;
  row.summary = text(form.get("summary"));
  row.status = "ready";
  row.claude_read = draft;
  row.draft = null;

  await db().from("readings").delete().eq("document_id", id);
  await db().from("medications").delete().eq("document_id", id);
  if (category === "health" && memberId) {
    row.lab_name = text(form.get("lab_name"));
    row.doctor = text(form.get("doctor"));
    row.patient_name = draft.name_on_document;
    const takenAt = (row.doc_date as string | null) ?? doc.created_at.slice(0, 10);
    const { data: member } = await db().from("members").select("sex").eq("id", memberId).single<Pick<Member, "sex">>();
    const results = draft.results
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => form.get(`r:${i}:keep`) === "on")
      .map(({ r, i }) => {
        const value = num(form.get(`r:${i}:value`));
        const low = num(form.get(`r:${i}:low`));
        const high = num(form.get(`r:${i}:high`));
        const range = low == null && high == null ? defaultRange(marker(r.marker_key), member?.sex ?? null) : undefined;
        return {
          member_id: memberId,
          document_id: id,
          marker_key: r.marker_key,
          marker_name: r.name,
          value,
          value_text: value == null ? r.value_text : null,
          unit: text(form.get(`r:${i}:unit`)),
          ref_low: low ?? range?.low ?? null,
          ref_high: high ?? range?.high ?? null,
          flag: flagFor(value, low ?? range?.low, high ?? range?.high),
          taken_at: takenAt,
          source: "report",
        };
      })
      .filter((r) => r.value != null || r.value_text);
    // The same report uploaded twice shouldn't double every value in the charts.
    const { data: existing } = await db().from("readings").select("marker_key, value, value_text").eq("member_id", memberId).eq("taken_at", takenAt).neq("document_id", id);
    const fresh = results.filter(
      (r) => !(existing ?? []).some((e) => e.marker_key === r.marker_key && (r.value != null ? same(r.value, e.value) && e.value != null : r.value_text === e.value_text)),
    );
    if (fresh.length) {
      const res = await db().from("readings").insert(fresh);
      if (res.error) throw new Error(res.error.message);
    }
    const meds = draft.medications
      .map((m, i) => ({ m, i }))
      .filter(({ i }) => form.get(`med:${i}:keep`) === "on")
      .map(({ i }) => ({
        member_id: memberId,
        document_id: id,
        name: text(form.get(`med:${i}:name`)),
        dose: text(form.get(`med:${i}:dose`)),
        frequency: text(form.get(`med:${i}:frequency`)),
        started_on: row.doc_date ?? null,
      }))
      .filter((m) => m.name);
    if (meds.length) await db().from("medications").insert(meds);
  }

  const res = await db().from("documents").update(row).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  after(() => copyToDrive(id));
  revalidatePath("/", "layout");
  if (form.get("from") === "check") {
    const { data: next } = await db().from("documents").select("id").not("draft", "is", null).neq("id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    redirect(next ? `/d/${next.id}?from=check` : "/claude");
  }
  redirect(`/d/${id}`);
}

/** "Saved value is right": this disagreement stops showing until a later read differs again. */
export async function confirmSaved(id: string, field: string) {
  await requireAuth();
  const doc = await load(id);
  const claude = claudeValue(doc.claude_read, field);
  await db()
    .from("documents")
    .update({ checked: [...doc.checked, checkKey(field, claude)] })
    .eq("id", id);
  revalidatePath("/", "layout");
}

function claudeValue(read: Draft | null, field: string) {
  if (!read) return null;
  if (field === "owner") return read.owner;
  if (field.startsWith("reading:")) return read.results.find((r) => r.marker_key === field.slice(8))?.value ?? null;
  if (field === "doc_date" || field === "expires_on" || field === "lab_name" || field === "doctor") return read[field];
  return (read.details as Record<string, string | number | null>)[field] ?? null;
}

/** "Use Claude's": writes what Claude read over the saved value, re-flagging and moving dates as needed. */
export async function useClaude(id: string, field: string) {
  await requireAuth();
  const doc = await load(id);
  const value = claudeValue(doc.claude_read, field);
  if (value == null) return;
  if (field === "owner") {
    await db().from("documents").update({ member_id: value }).eq("id", id);
    await db().from("readings").update({ member_id: value }).eq("document_id", id);
    await db().from("medications").update({ member_id: value }).eq("document_id", id);
    after(() => copyToDrive(id));
  } else if (field.startsWith("reading:")) {
    const key = field.slice(8);
    const c = doc.claude_read!.results.find((r) => r.marker_key === key)!;
    const { data: rows } = await db().from("readings").select("id, ref_low, ref_high").eq("document_id", id).eq("marker_key", key);
    for (const r of rows ?? [])
      await db()
        .from("readings")
        .update({ value: c.value, unit: c.unit, flag: flagFor(c.value, r.ref_low, r.ref_high) })
        .eq("id", r.id);
  } else {
    const row: Record<string, unknown> =
      field === "doc_date" || field === "expires_on" || field === "lab_name" || field === "doctor" ? { [field]: value } : { details: { ...doc.details, [field]: value } };
    const docDate = (row.doc_date as string | undefined) ?? doc.doc_date;
    const months = field === "warranty_months" ? Number(value) : doc.details.warranty_months;
    if (doc.category === "bill" && docDate && months && (field === "doc_date" || field === "warranty_months")) row.expires_on = addMonths(docDate, months);
    await db().from("documents").update(row).eq("id", id);
    after(() => copyToDrive(id));
  }
  revalidatePath("/", "layout");
}
