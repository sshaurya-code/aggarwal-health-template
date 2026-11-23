import "server-only";
import { db, requireAuth } from "./supabase";
import { BASELINE, MARKERS, marker, type Sex } from "./markers";
import type { Draft } from "./draft";

export type Member = {
  id: string;
  name: string;
  relation: string | null;
  dob: string | null;
  sex: "male" | "female" | null;
  blood_group: string | null;
  height_cm: number | null;
  conditions: string[];
  allergies: string[];
  notes: string | null;
  review: string | null;
  review_at: string | null;
  spouse_id: string | null;
  parent_id: string | null;
};

export type Category = "health" | "id" | "bill" | "insurance" | "car" | "investment" | "other";

// One bag of fields for every vault section; each section uses its own subset.
export type Details = {
  number?: string | null; // ID number
  name?: string | null; // name printed on the ID
  merchant?: string | null;
  amount?: number | null;
  invoice_no?: string | null;
  items?: string[];
  warranty_months?: number | null;
  return_by?: string | null;
  insurer?: string | null;
  policy_no?: string | null;
  sum_insured?: number | null;
  premium?: number | null;
  insured?: string[];
  vehicle_no?: string | null;
  make_model?: string | null; // from a car's RC
  frequency?: string | null; // investments: a FREQUENCY key
  due_on?: string | null; // investments: one payment date; the rest follow from frequency
  nominee?: string | null;
  not_renewing?: boolean; // expired on purpose: stop listing it
};

export type Doc = {
  id: string;
  member_id: string | null; // null = household
  category: Category;
  details: Details;
  expires_on: string | null;
  kind: string;
  title: string;
  doc_date: string | null;
  lab_name: string | null;
  doctor: string | null;
  patient_name: string | null;
  summary: string | null;
  text: string | null;
  files: string[];
  mime: string | null;
  status: "processing" | "ready" | "failed" | "manual";
  error: string | null;
  created_at: string;
  claude_state: "queued" | "reading" | "failed" | null;
  claude_error: string | null;
  draft: Draft | null;
  claude_read: Draft | null;
  checked: string[];
};

export type Reading = {
  id: string;
  member_id: string;
  document_id: string | null;
  marker_key: string;
  marker_name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: "low" | "high" | "normal" | null;
  taken_at: string;
  taken_time?: string | null;
  source: "report" | "manual";
};

export type Medication = {
  id: string;
  member_id: string;
  document_id: string | null;
  name: string;
  dose: string | null;
  frequency: string | null;
  started_on: string | null;
  active: boolean;
  times?: string[];
  created_at: string;
};

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getMembers() {
  await requireAuth();
  return unwrap<Member[]>(await db().from("members").select("*").order("created_at"));
}

export async function getMember(id: string) {
  await requireAuth();
  return unwrap<Member | null>(await db().from("members").select("*").eq("id", id).maybeSingle());
}

export async function getReadings(memberId?: string) {
  await requireAuth();
  let q = db().from("readings").select("*").order("taken_at", { ascending: true }).order("taken_time", { nullsFirst: true }).order("created_at");
  if (memberId) q = q.eq("member_id", memberId);
  return unwrap<Reading[]>(await q);
}

export async function getDocs(memberId?: string) {
  await requireAuth();
  let q = db().from("documents").select("*").order("doc_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (memberId) q = q.eq("member_id", memberId);
  return unwrap<Doc[]>(await q);
}

export async function getDoc(id: string) {
  await requireAuth();
  return unwrap<Doc | null>(await db().from("documents").select("*").eq("id", id).maybeSingle());
}

export async function getMedications(memberId: string) {
  await requireAuth();
  return unwrap<Medication[]>(
    await db().from("medications").select("*").eq("member_id", memberId).order("active", { ascending: false }).order("created_at", { ascending: false }),
  );
}

export function age(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
}

/** Readings grouped by marker, oldest → newest. */
export function byMarker(readings: Reading[]) {
  const map = new Map<string, Reading[]>();
  for (const r of readings) {
    if (!map.has(r.marker_key)) map.set(r.marker_key, []);
    map.get(r.marker_key)!.push(r);
  }
  return map;
}

export type DueItem = { key: string; name: string; last: string | null; dueOn: string | null; overdue: boolean; flagged: boolean };

export const addMonths = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

/** What should be retested soon: tracked markers past their interval, plus untested baseline markers. */
export function dueTests(readings: Reading[], sex: Sex) {
  const grouped = byMarker(readings);
  const today = new Date().toISOString().slice(0, 10);
  const soon = addMonths(today, 1);
  const items: DueItem[] = [];
  for (const m of MARKERS) {
    if (!m.recheck || (m.maleOnly && sex === "female")) continue;
    const rows = grouped.get(m.key);
    const latest = rows?.at(-1);
    if (!latest) {
      if (BASELINE.includes(m.key)) items.push({ key: m.key, name: m.name, last: null, dueOn: null, overdue: true, flagged: false });
      continue;
    }
    const flagged = latest.flag === "high" || latest.flag === "low";
    const dueOn = addMonths(latest.taken_at, m.recheck[flagged ? 1 : 0]);
    if (dueOn <= soon) items.push({ key: m.key, name: m.name, last: latest.taken_at, dueOn, overdue: dueOn <= today, flagged });
  }
  return items.sort((a, b) => Number(b.flagged) - Number(a.flagged) || (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));
}

/** Latest out-of-range reading per marker. */
export function flagged(readings: Reading[]) {
  const out: Reading[] = [];
  for (const [, rows] of byMarker(readings)) {
    const latest = rows.at(-1)!;
    if (latest.flag === "high" || latest.flag === "low") out.push(latest);
  }
  return out;
}

export const markerName = (r: Pick<Reading, "marker_key" | "marker_name">) => marker(r.marker_key)?.name ?? r.marker_name;
