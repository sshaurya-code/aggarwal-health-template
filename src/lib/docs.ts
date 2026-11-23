import "server-only";
import { addMonths, type Category, type Details } from "./data";
import { CATEGORY_KINDS, KIND_LABEL } from "./kinds";
import { db } from "./supabase";

export const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
export const amount = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[₹,\s]/g, ""));
  return String(v ?? "").trim() && Number.isFinite(n) ? n : null;
};

export const NEW_DOC: Record<Category, { kind: string; title: string }> = {
  health: { kind: "other", title: "Health record" },
  id: { kind: "id_other", title: "ID document" },
  bill: { kind: "bill", title: "Bill" },
  insurance: { kind: "other_cover", title: "Insurance policy" },
  car: { kind: "car_other", title: "Car paper" },
  investment: { kind: "invest_other", title: "Investment" },
  other: { kind: "misc", title: "Document" },
};

/** "Rahul's PAN card": the family has many PAN cards, so a type alone doesn't say whose. */
export async function ownedTitle(memberId: string | null, kind: string) {
  const label = KIND_LABEL[kind] ?? "ID document";
  if (!memberId) return label;
  const { data } = await db().from("members").select("name").eq("id", memberId).single();
  return data ? `${data.name.split(" ")[0]}'s ${label}` : label;
}

type Current = { category: Category; kind: string; details: Details; member_id: string | null; title: string; expires_on: string | null };

/** The document columns a details form changes. Only fields present in the form are touched. */
export async function detailsRow(doc: Current, form: FormData, memberId = doc.member_id) {
  const category = (text(form.get("category")) ?? doc.category) as Category;
  if (!(category in NEW_DOC)) throw new Error("Unknown section");
  if ((category === "health" || category === "investment") && !memberId) throw new Error(`${category === "health" ? "Health records" : "Investments"} belong to a person`);
  const details: Details = { ...doc.details };
  for (const k of ["number", "name", "merchant", "invoice_no", "return_by", "insurer", "policy_no", "vehicle_no", "make_model", "frequency", "due_on", "nominee"] as const)
    if (form.has(k)) details[k] = text(form.get(k));
  if (details.vehicle_no) details.vehicle_no = details.vehicle_no.toUpperCase().replace(/[\s-]+/g, "");
  for (const k of ["amount", "warranty_months", "sum_insured", "premium"] as const) if (form.has(k)) details[k] = amount(form.get(k));
  if (form.has("insured")) details.insured = list(form.get("insured"));

  const docDate = text(form.get("doc_date"));
  const row: Record<string, unknown> = { details, doc_date: docDate };
  // An ID still carrying its automatic name ("Rahul's Aadhaar") is renamed when its type changes.
  const typed = text(form.get("title"));
  const auto = typed === doc.title && (doc.title === KIND_LABEL[doc.kind] || doc.title === (await ownedTitle(doc.member_id, doc.kind)));
  const title = auto ? null : typed;
  if (title) row.title = title;
  const kind = text(form.get("kind"));
  if (category !== doc.category) {
    // Moved to another section: the old type doesn't apply there, nor does a generic title like "ID document".
    row.category = category;
    row.kind = kind && (CATEGORY_KINDS[category] ?? []).includes(kind) ? kind : NEW_DOC[category].kind;
    if (!row.title && Object.values(NEW_DOC).some((d) => d.title === doc.title)) row.title = NEW_DOC[category].title;
  } else if (kind) row.kind = kind;
  if (category === "id" && row.kind && row.kind !== "id_other" && !title) row.title = await ownedTitle(memberId, row.kind as string);
  if (category === "car") row.member_id = null; // cars belong to the household
  row.expires_on =
    category === "bill" ? (docDate && details.warranty_months ? addMonths(docDate, details.warranty_months) : null) : text(form.get("expires_on"));
  // A new expiry date means it was renewed after all.
  if (row.expires_on !== doc.expires_on) delete details.not_renewing;
  return row;
}
