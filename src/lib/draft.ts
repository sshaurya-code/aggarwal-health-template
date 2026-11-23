import { fmtDate, fmtValue, rupees } from "@/components/ui";
import { BASELINE } from "./markers";
import type { Category, Details, Doc, Reading } from "./data";

export type DraftResult = {
  marker_key: string;
  name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
};

/** What Claude read from a document, waiting for a person to check it. */
export type Draft = {
  read_at: string;
  category: Category;
  kind: string;
  title: string | null;
  doc_date: string | null;
  expires_on: string | null;
  summary: string | null;
  name_on_document: string | null;
  owner: string | null; // the family member the printed name matches; null = no match or household
  lab_name: string | null;
  doctor: string | null;
  details: Details;
  results: DraftResult[];
  medications: { name: string; dose: string | null; frequency: string | null }[];
};

type Value = string | number | null | undefined;
type Field = { field: string; label: string; get: (x: Doc | Draft) => Value; show?: (v: Value) => string };

const date = (v: Value) => fmtDate(String(v));
const money = (v: Value) => rupees(Number(v)) ?? "";

// Fields compared between the saved document and Claude's reading. Free text (title, summary) never is.
export const FIELDS: Field[] = [
  { field: "doc_date", label: "Date", get: (x) => x.doc_date, show: date },
  { field: "expires_on", label: "Valid until", get: (x) => x.expires_on, show: date },
  { field: "number", label: "Number", get: (x) => x.details.number },
  { field: "name", label: "Name on card", get: (x) => x.details.name },
  { field: "merchant", label: "Shop", get: (x) => x.details.merchant },
  { field: "amount", label: "Total", get: (x) => x.details.amount, show: money },
  { field: "invoice_no", label: "Invoice no.", get: (x) => x.details.invoice_no },
  { field: "warranty_months", label: "Warranty months", get: (x) => x.details.warranty_months },
  { field: "return_by", label: "Return by", get: (x) => x.details.return_by, show: date },
  { field: "insurer", label: "Insurer", get: (x) => x.details.insurer },
  { field: "policy_no", label: "Policy no.", get: (x) => x.details.policy_no },
  { field: "sum_insured", label: "Sum insured", get: (x) => x.details.sum_insured, show: money },
  { field: "premium", label: "Premium", get: (x) => x.details.premium, show: money },
  { field: "vehicle_no", label: "Vehicle no.", get: (x) => x.details.vehicle_no },
  { field: "make_model", label: "Make & model", get: (x) => x.details.make_model },
  { field: "frequency", label: "How often", get: (x) => x.details.frequency },
  { field: "due_on", label: "Next due", get: (x) => x.details.due_on, show: date },
  { field: "nominee", label: "Nominee", get: (x) => x.details.nominee },
  { field: "lab_name", label: "Lab", get: (x) => x.lab_name },
  { field: "doctor", label: "Doctor", get: (x) => x.doctor },
];

const blank = (v: Value) => v == null || v === "";
const norm = (v: Value) => String(v).toLowerCase().replace(/[\s.,\-/]+/g, "");

/** Same value, allowing 1% for numbers (units round differently) and ignoring spacing and case in text. */
export function same(a: Value, b: Value) {
  if (blank(a) || blank(b)) return true; // one side couldn't read it or didn't fill it: not a disagreement
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= Math.max(Math.abs(b) * 0.01, 0.01);
  return norm(a) === norm(b);
}

export type SecondLook = { field: string; label: string; saved: string; claude: string };

export const checkKey = (field: string, claude: Value) => `${field}=${claude}`;

/** Every saved value that differs from what Claude read, minus the ones someone already confirmed. */
export function secondLook(doc: Doc, readings: Reading[], names: Map<string, string> = new Map()): SecondLook[] {
  const read = doc.claude_read;
  if (!read) return [];
  const out: SecondLook[] = [];
  // Saved under one person although the name on it matches another: kept, but flagged until someone decides.
  if (read.owner && read.owner !== doc.member_id && doc.category !== "car" && !doc.checked.includes(checkKey("owner", read.owner))) {
    const who = (id: string | null) => (id ? (names.get(id)?.split(" ")[0] ?? "someone else") : "Household");
    out.push({ field: "owner", label: "Whose document", saved: who(doc.member_id), claude: `${who(read.owner)}'s${read.name_on_document ? ` (name on it: ${read.name_on_document})` : ""}` });
  }
  for (const f of FIELDS) {
    const saved = f.get(doc);
    const claude = f.get(read);
    if (same(saved, claude) || doc.checked.includes(checkKey(f.field, claude))) continue;
    const show = f.show ?? String;
    out.push({ field: f.field, label: f.label, saved: show(saved), claude: show(claude) });
  }
  for (const r of readings.filter((r) => r.document_id === doc.id)) {
    const c = read.results.find((x) => x.marker_key === r.marker_key);
    if (!c || c.value == null || r.value == null || same(r.value, c.value)) continue;
    const field = `reading:${r.marker_key}`;
    if (doc.checked.includes(checkKey(field, c.value))) continue;
    out.push({ field, label: r.marker_name, saved: `${fmtValue(r.value)} ${r.unit ?? ""}`.trim(), claude: `${fmtValue(c.value)} ${c.unit ?? ""}`.trim() });
  }
  return out;
}

/** The handful of results worth seeing first: out of range, then the usual checkup markers, in report order. */
export function mainResults<T extends { marker_key: string; value: number | null; ref_low: number | null; ref_high: number | null }>(rows: T[], count = 5) {
  const out = (r: T) => r.value != null && ((r.ref_low != null && r.value < r.ref_low) || (r.ref_high != null && r.value > r.ref_high));
  const rank = (r: T) => (out(r) ? 0 : BASELINE.includes(r.marker_key) ? 1 : !r.marker_key.startsWith("other:") ? 2 : 3);
  const picked = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .slice(0, count)
    .map((x) => x.r);
  return new Set(picked);
}
