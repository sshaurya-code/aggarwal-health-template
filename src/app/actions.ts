"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { addMonths, type Category, type Details } from "@/lib/data";
import { BUCKET, db, requireAuth, requireCare } from "@/lib/supabase";
import { defaultRange, flagFor, marker } from "@/lib/markers";
import { pushEnabled, sendPush } from "@/lib/push";
import { copyToDrive, keepDeletedInDrive } from "@/lib/drive";
import { claudeEnabled, kickQueue, siteOrigin } from "@/lib/claude";
import { guessFromName } from "@/lib/guess";
import { detailsRow, list, NEW_DOC, ownedTitle, text } from "@/lib/docs";
import { CATEGORY_KINDS, KIND_LABEL } from "@/lib/kinds";


// Wrong PINs allowed per 15 minutes: per phone/network, and in total. A full guessing run would take months.
const LOCK_MINUTES = 15;
const PER_IP = 5;
const IN_TOTAL = 20;

export async function login(_: unknown, form: FormData) {
  const pin = String(form.get("pin") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const [total, mine] = await Promise.all([
    db().from("login_failures").select("id", { count: "exact", head: true }).gte("at", since),
    db().from("login_failures").select("id", { count: "exact", head: true }).gte("at", since).eq("ip", ip),
  ]);
  if (total.error || mine.error) return { error: "Can't check the PIN right now. Try again in a minute." };
  // Checked before the PIN itself, so a correct guess during a lockout gets nowhere.
  if ((total.count ?? 0) >= IN_TOTAL || (mine.count ?? 0) >= PER_IP)
    return { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` };

  const role =
    process.env.FAMILY_PIN && pin === process.env.FAMILY_PIN
      ? "family"
      : process.env.HELPER_PIN && process.env.HELPER_MEMBER_ID && pin === process.env.HELPER_PIN
        ? "helper"
        : null;
  if (!role) {
    await db().from("login_failures").insert({ ip });
    await db().from("login_failures").delete().lt("at", new Date(Date.now() - 86_400_000).toISOString());
    if ((total.count ?? 0) + 1 === IN_TOTAL) await alertFamily();
    await new Promise((r) => setTimeout(r, 1000));
    return { error: "Wrong PIN" };
  }
  (await cookies()).set(SESSION_COOKIE, await createSession(role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  redirect(role === "helper" ? "/care" : "/");
}

/** Tells every phone with reminders on that someone is guessing the PIN. */
async function alertFamily() {
  if (!pushEnabled()) return;
  const { data: subs } = await db().from("push_subscriptions").select("*");
  const msg = {
    title: "Someone is guessing the PIN",
    body: `Sign-in is paused for ${LOCK_MINUTES} minutes. If this wasn't the family, change FAMILY_PIN in Vercel.`,
    url: "/settings",
  };
  await Promise.allSettled((subs ?? []).map((s) => sendPush(s, msg)));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function saveMember(form: FormData) {
  await requireAuth();
  const id = text(form.get("id"));
  const row = {
    name: String(form.get("name") ?? "").trim(),
    relation: text(form.get("relation")),
    dob: text(form.get("dob")),
    sex: text(form.get("sex")),
    blood_group: text(form.get("blood_group")),
    height_cm: text(form.get("height_cm")) ? Number(form.get("height_cm")) : null,
    conditions: list(form.get("conditions")),
    allergies: list(form.get("allergies")),
    notes: text(form.get("notes")),
    spouse_id: text(form.get("spouse_id")),
    parent_id: text(form.get("parent_id")),
  };
  if (!row.name) throw new Error("Name is required");
  if (id && (row.spouse_id === id || row.parent_id === id)) throw new Error("Someone can't be linked to themselves");
  const before = id ? (await db().from("members").select("spouse_id").eq("id", id).single()).data : null;
  const res = id
    ? await db().from("members").update(row).eq("id", id).select("id").single()
    : await db().from("members").insert(row).select("id").single();
  if (res.error) throw new Error(res.error.message);
  // Marriage goes both ways: unlink the old partner, link the new one (and free them from anyone else).
  const me = res.data.id;
  if (before?.spouse_id && before.spouse_id !== row.spouse_id) await db().from("members").update({ spouse_id: null }).eq("id", before.spouse_id);
  if (row.spouse_id) {
    await db().from("members").update({ spouse_id: null }).eq("spouse_id", row.spouse_id).neq("id", me);
    await db().from("members").update({ spouse_id: null }).eq("spouse_id", me).neq("id", row.spouse_id);
    await db().from("members").update({ spouse_id: me }).eq("id", row.spouse_id);
  }
  revalidatePath("/", "layout");
  redirect(`/m/${res.data.id}`);
}

export async function deleteMember(id: string) {
  await requireAuth();
  const { data: docs } = await db().from("documents").select("id, files").eq("member_id", id);
  await keepDeletedInDrive((docs ?? []).map((d) => d.id as string));
  const paths = (docs ?? []).flatMap((d) => d.files as string[]);
  if (paths.length) await db().storage.from(BUCKET).remove(paths);
  await db().from("members").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/");
}

// Camera rolls name files IMG_1234, image, PXL_2026… — those say nothing, so keep the generic title.
const CAMERA_NAME = /^((img|image|photo|pxl|dsc|dcim|scan|screenshot|whatsapp image|file)\b|[\d_])[\d\s_.:-]*(at[\d\s_.:-]*)?$/i;
function fileTitle(name: string) {
  const t = name.replace(/_+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return t && !CAMERA_NAME.test(t) ? t : null;
}

/** A YYYY-MM-DD date that isn't in the future (IST), or null. */
function pastDate(v: unknown) {
  const s = typeof v === "string" ? v.trim() : "";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s <= today ? s : null;
}

/** Creates the document row and one signed upload URL per file; the phone uploads straight to storage. */
export async function startUpload(
  chosen: Category,
  memberId: string | null,
  files: { name: string; type: string }[],
  docDate: string | null = null,
  preset: { kind?: string; vehicle_no?: string } = {},
) {
  await requireAuth();
  // A clear file name ("Blood report", "PAN card") beats the one section picked for the whole batch,
  // unless the upload came from a specific slot ("Add PUC" on a car).
  const guess = preset.kind ? null : guessFromName(files[0]?.name ?? "");
  const personal = (c: Category) => c === "health" || c === "investment";
  const category = guess && (!personal(guess.category) || memberId) ? guess.category : chosen;
  if (category === "car") memberId = null; // cars belong to the household
  if (personal(category) && !memberId) throw new Error(`${category === "health" ? "Health records" : "Investments"} belong to a person`);
  const id = crypto.randomUUID();
  const paths = files.map((f, i) => {
    const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : "jpg";
    return `${memberId ?? "household"}/${id}/${i + 1}.${ext}`;
  });
  const start = NEW_DOC[category];
  const kind =
    preset.kind && CATEGORY_KINDS[category]?.includes(preset.kind) ? preset.kind : guess?.category === category && guess.kind ? guess.kind : start.kind;
  const vehicle = category === "car" && preset.vehicle_no ? preset.vehicle_no.toUpperCase().replace(/[\s-]+/g, "") : null;
  const named = fileTitle(files[0]?.name ?? "");
  const ins = await db()
    .from("documents")
    .insert({
      id,
      category,
      member_id: memberId,
      kind,
      files: paths,
      mime: files[0]?.type ?? null,
      status: "ready",
      doc_date: pastDate(docDate),
      title: named ?? (category === "id" && kind !== "id_other" ? await ownedTitle(memberId, kind) : preset.kind && KIND_LABEL[kind] ? `${KIND_LABEL[kind]}${vehicle ? ` · ${vehicle}` : ""}` : start.title),
      ...(vehicle && { details: { vehicle_no: vehicle } }),
    });
  if (ins.error) throw new Error(ins.error.message);
  const uploads = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      return { path, token: data.token };
    }),
  );
  return { id, uploads };
}

/** The phone calls this once its files are in storage; Claude's read and the Drive copy happen after the reply. */
export async function uploadsDone(ids: string[]) {
  await requireAuth();
  if (claudeEnabled() && ids.length) {
    await db().from("documents").update({ claude_state: "queued" }).in("id", ids);
    await kickQueue(await siteOrigin());
  }
  after(() => Promise.all(ids.map(copyToDrive)));
}

/** Saves the hand-edited fields of a document. Only fields present in the form are touched. */
export async function saveDetails(id: string, form: FormData) {
  await requireAuth();
  const { data: doc } = await db().from("documents").select("category, kind, details, member_id, title, expires_on").eq("id", id).single();
  if (!doc) throw new Error("Document not found");
  const res = await db().from("documents").update(await detailsRow(doc, form)).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  after(() => copyToDrive(id));
  revalidatePath("/", "layout");
  redirect(`/d/${id}`);
}

/** Sets only the date printed on a report or bill; a bill's warranty end moves with it. */
export async function setDocDate(id: string, form: FormData) {
  await requireAuth();
  const docDate = pastDate(form.get("doc_date"));
  if (!docDate) throw new Error("Pick a date that isn't in the future");
  const { data: doc } = await db().from("documents").select("category, details").eq("id", id).single();
  if (!doc) throw new Error("Document not found");
  const months = doc.category === "bill" ? (doc.details as Details).warranty_months : null;
  const res = await db()
    .from("documents")
    .update({ doc_date: docDate, ...(months && { expires_on: addMonths(docDate, months) }) })
    .eq("id", id);
  if (res.error) throw new Error(res.error.message);
  after(() => copyToDrive(id));
  revalidatePath("/", "layout");
  redirect(`/d/${id}`);
}

/** Marks an expired paper as deliberately not renewed (or undoes it), so it stops asking for attention. */
export async function setNotRenewing(id: string, on: boolean) {
  await requireAuth();
  const { data: doc } = await db().from("documents").select("details").eq("id", id).single();
  if (!doc) throw new Error("Document not found");
  const details = { ...(doc.details as Details) };
  if (on) details.not_renewing = true;
  else delete details.not_renewing;
  const res = await db().from("documents").update({ details }).eq("id", id);
  if (res.error) throw new Error(res.error.message);
  revalidatePath("/", "layout");
}

export async function addReading(form: FormData) {
  const memberId = String(form.get("member_id"));
  await requireCare(memberId);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const takenAt = text(form.get("taken_at")) ?? today;
  if (takenAt > today) throw new Error("A reading can't be dated in the future");
  const takenTime = text(form.get("taken_time"));
  const { data: member } = await db().from("members").select("sex").eq("id", memberId).single();
  const rows = [];
  for (const [field, value] of form.entries()) {
    if (!field.startsWith("v:") || !String(value).trim()) continue;
    const key = field.slice(2);
    const m = marker(key);
    const num = Number(value);
    if (!m || Number.isNaN(num)) continue;
    const range = defaultRange(m, member?.sex ?? null);
    const group = text(form.get(`group:${key}`));
    const time = (group && text(form.get(`time:${group}`))) || takenTime;
    rows.push({
      member_id: memberId,
      marker_key: key,
      marker_name: m.name,
      value: num,
      unit: m.unit,
      ref_low: range?.low ?? null,
      ref_high: range?.high ?? null,
      flag: flagFor(num, range?.low, range?.high),
      taken_at: takenAt,
      ...(time && { taken_time: time }),
      source: "manual",
    });
  }
  if (rows.length) {
    const res = await db().from("readings").insert(rows);
    if (res.error) throw new Error(res.error.message);
  }
  revalidatePath("/", "layout");
  redirect(form.get("next") === "/care" ? "/care?saved=1" : `/m/${memberId}`);
}

export async function deleteReading(id: string) {
  await requireAuth();
  await db().from("readings").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function moveDoc(id: string, memberId: string | null) {
  await requireAuth();
  await db().from("documents").update({ member_id: memberId }).eq("id", id);
  if (memberId) {
    await db().from("readings").update({ member_id: memberId }).eq("document_id", id);
    await db().from("medications").update({ member_id: memberId }).eq("document_id", id);
  }
  after(() => copyToDrive(id));
  revalidatePath("/", "layout");
}

export async function deleteDoc(id: string) {
  await requireAuth();
  const { data } = await db().from("documents").select("files, member_id").eq("id", id).single();
  await keepDeletedInDrive([id]);
  if (data?.files?.length) await db().storage.from(BUCKET).remove(data.files);
  await db().from("documents").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect(data?.member_id ? `/m/${data.member_id}?tab=docs` : "/records");
}

export async function setMedicationActive(id: string, active: boolean) {
  await requireAuth();
  await db().from("medications").update({ active }).eq("id", id);
  revalidatePath("/", "layout");
}

type BrowserSub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Remembers this phone for reminders. memberId null = reminders for the whole family. */
export async function savePushSubscription(sub: BrowserSub, memberId: string | null) {
  await requireAuth();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) throw new Error("This phone didn't return a valid subscription");
  const res = await db()
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, member_id: memberId }, { onConflict: "endpoint" });
  if (res.error) throw new Error(res.error.message);
}

export async function removePushSubscription(endpoint: string) {
  await requireAuth();
  await db().from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function pushSubscriptionOwner(endpoint: string) {
  await requireAuth();
  const { data } = await db().from("push_subscriptions").select("member_id").eq("endpoint", endpoint).maybeSingle();
  return data ? { memberId: data.member_id as string | null } : null;
}

export async function sendTestPush(endpoint: string) {
  await requireAuth();
  const { data: sub } = await db().from("push_subscriptions").select("*").eq("endpoint", endpoint).single();
  if (!sub) throw new Error("Turn reminders on first");
  await sendPush(sub, { title: "Reminders are on", body: "You'll hear from the family vault when something is due.", url: "/settings" });
}

/** Everything the phone needs to build a backup zip itself: all rows plus a signed link per file (valid 1 hour). */
export async function backupManifest() {
  await requireAuth();
  const [members, documents, readings, medications] = await Promise.all(
    ["members", "documents", "readings", "medications"].map(async (t) => {
      const { data, error } = await db().from(t).select("*");
      if (error) throw new Error(error.message);
      return data;
    }),
  );
  const paths = documents!.flatMap((d) => d.files as string[]);
  const signed = paths.length ? ((await db().storage.from(BUCKET).createSignedUrls(paths, 3600)).data ?? []) : [];
  const names = new Map(members!.map((m) => [m.id as string, m.name as string]));
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
  const used = new Set<string>();
  const files = documents!.flatMap((d) =>
    (d.files as string[]).map((path, i) => {
      const base = `${safe(d.member_id ? (names.get(d.member_id) ?? "Unknown") : "Household")}/${d.category}/${d.doc_date ?? d.created_at.slice(0, 10)} ${safe(d.title)}${d.files.length > 1 ? ` p${i + 1}` : ""}`;
      let name = base;
      for (let n = 2; used.has(name); n++) name = `${base} (${n})`;
      used.add(name);
      return { name: `${name}.${path.split(".").pop()}`, url: signed.find((x) => x.path === path)?.signedUrl ?? null };
    }),
  );
  return { data: { exported_at: new Date().toISOString(), members, documents, readings, medications }, files };
}
