import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";
import { CATEGORY_KINDS, CATEGORY_LABEL, FREQUENCY, KIND_LABEL } from "./kinds";
import type { Category, Doc, Member } from "./data";
import type { Draft, DraftResult } from "./draft";
import { defaultRange, MARKERS, marker } from "./markers";
import { BUCKET, db } from "./supabase";

// Claude reads each uploaded document and drafts its details; a person checks the draft before anything is saved.

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;

// The family's hard limit (20 Nov 2026): ₹500 in total, ever. Costs are counted high on purpose:
// a rupee rate above the market rate, and the highest per-token price any model in the chain bills
// (Claude Opus 5.5 is $4/$20 per million tokens; a refusal fallback can run on a $5/$25 model).
export const SPEND_CAP_INR = 500;
const INR_PER_USD = 90;
const USD_PER_MTOK = { input: 5, output: 25 };
const inr = (input: number, output: number) => ((input * USD_PER_MTOK.input + output * USD_PER_MTOK.output) / 1e6) * INR_PER_USD;

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function spentInr() {
  const { data } = await db().from("claude_spend").select("inr");
  return (data ?? []).reduce((sum, r) => sum + Number(r.inr), 0);
}

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });
const KINDS = Object.keys(KIND_LABEL);
const SECTIONS = Object.keys(CATEGORY_LABEL);

// Text fields use "" for "not found": the API limits how many fields may be nullable.
function schema(names: string[]) {
  const str = ["title", "doc_date", "expires_on", "name_on_document", "lab_name", "doctor", "number", "merchant", "invoice_no", "insurer", "policy_no", "vehicle_no", "make_model", "due_on", "nominee"];
  const num = ["amount", "warranty_months", "return_days", "sum_insured", "premium"];
  const properties: Record<string, unknown> = {
    section: { type: "string", enum: SECTIONS },
    kind: { type: "string", enum: KINDS },
    belongs_to: { type: "string", enum: [...names, "household", "unknown"] },
    frequency: { type: "string", enum: ["", ...Object.keys(FREQUENCY)] },
    summary: { type: "string" },
    ...Object.fromEntries(str.map((k) => [k, { type: "string" }])),
    ...Object.fromEntries(num.map((k) => [k, nullable("number")])),
    items: { type: "array", items: { type: "string" } },
    insured: { type: "array", items: { type: "string" } },
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["marker_key", "name", "value", "value_text", "unit", "ref_low", "ref_high"],
        properties: {
          marker_key: { type: "string", enum: [...MARKERS.map((m) => m.key), "other"] },
          name: { type: "string" },
          value: nullable("number"),
          value_text: { type: "string" },
          unit: { type: "string" },
          ref_low: nullable("number"),
          ref_high: nullable("number"),
        },
      },
    },
    medications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "dose", "frequency"],
        properties: { name: { type: "string" }, dose: { type: "string" }, frequency: { type: "string" } },
      },
    },
  };
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

const kinds = (c: string) => (CATEGORY_KINDS[c] ?? (c === "bill" ? ["bill"] : [])).map((k) => `${k} (${KIND_LABEL[k]})`).join(", ");

export const SYSTEM = `You file documents for an Indian family's private records app. You receive one document (a PDF, or photos of its pages) and return its details as JSON, which a family member checks before anything is saved.

The overriding rule: never guess. Copy what is printed. If something is not printed or you cannot read it with certainty, leave it blank: an empty string for text and dates, null for numbers, an empty array for lists. A blank is fine; a wrong value is not.

section and kind:
- health: ${kinds("health")}. Medical reports, prescriptions, scans, discharge papers, vaccination cards.
- id: ${kinds("id")}. Identity documents.
- bill: bill. Shopping bills, invoices, warranty cards.
- insurance: ${kinds("insurance")}. Health, home and travel policies. Car and bike insurance is NOT here, nor is life insurance.
- investment: ${kinds("investment")}. Life insurance (LIC, term plans), mutual funds and SIPs, fixed and recurring deposits, PPF, NPS and other savings. Always a person's.
- car: ${kinds("car")}. Every paper about a vehicle, including its insurance (motor_cover), the RC, PUC and FASTag.
- other: misc. Anything that fits nowhere else.

belongs_to: the family member the document is about. Match the name printed on it (patient, card holder, policyholder, owner on the RC) to the family list given, allowing for initials, middle names and surnames (e.g. "RAHUL KUMAR SHARMA" matches "Rahul"). "household" for documents about the home or a vehicle, or shared bills. "unknown" when no name is printed or it matches nobody.
name_on_document: the person's name exactly as printed, or null.

Dates: YYYY-MM-DD. Indian documents write dates day-first: 05/03/2026 is 5 March 2026.
- doc_date: the report / sample / visit date, the bill date, the policy start date, the issue date of an ID or car paper.
- expires_on: when it stops being valid: ID valid-until, policy end date, PUC / fitness / road tax / permit / RC validity, an investment's maturity date or a life policy's end of cover, any expiry on an "other" document. Null for health records and bills.

title: short and specific, e.g. "Lipid Profile & HbA1c", "Prescription · Dr Mehta (Cardiology)", "LG 260L Refrigerator", "Star Health Family Optima", "PUC · HR51AB1234". For an ID, its type, e.g. "PAN card".

Fields by section (blank when not that section):
- health: lab_name (lab or hospital), doctor (referring or prescribing), results, medications.
  results: every measured value. marker_key is the catalog key below when it is the same test, otherwise "other" with the printed test name in name. Convert value and range to the catalog unit when the lab used another (glucose mmol/L × 18 = mg/dL, testosterone nmol/L × 28.84 = ng/dL, vitamin D nmol/L ÷ 2.496 = ng/mL); otherwise keep the printed unit. ref_low / ref_high: the range printed for this patient (an open end is null: "<200" is ref_low null, ref_high 200). Qualitative results (Negative, Reactive, Nil) go in value_text with value null. Leave out any test whose number you cannot read.
  medications: for prescriptions and discharge papers, each drug with dose and frequency as written ("1-0-1 after food").
- id: number exactly as printed, with its spaces.
- bill: merchant, amount (grand total in rupees), invoice_no, items (each product, shortened, at most 15), warranty_months (only if a warranty period is printed; "1 year" = 12), return_days (only if a return window is printed).
- insurance and car motor_cover: insurer, policy_no, sum_insured (sum insured, or the IDV for a vehicle), premium (total including GST), insured (names of people covered; for motor or home, the policyholder).
- investment: insurer (the company: insurer, fund house, bank or post office), policy_no (policy, folio or account number), premium (the amount of each payment: premium, SIP or instalment), frequency (how often it is paid: monthly, quarterly, half_yearly, yearly, or once for a lump sum; "" if not printed), due_on (the next payment date printed, or the date of a payment shown, e.g. the SIP date or premium due date), sum_insured (sum assured for life cover, or the deposit / current value), nominee (name as printed), doc_date (start or commencement date).
- car: vehicle_no (registration number, uppercase without spaces, e.g. HR51AB1234), make_model (from the RC or policy, e.g. "Hyundai Creta SX").

summary: 1–3 plain-English sentences for the family: what the document is and what it covers. For lab reports, do not say whether values are normal, high or low (the app compares them to their ranges itself). For imaging, consultations and discharge papers, include the doctor's impression or diagnosis as written. Never diagnose or advise; where something needs attention, say it is worth discussing with their doctor.

Catalog (key: name [unit]):
${MARKERS.map((m) => `${m.key}: ${m.name} [${m.unit}]`).join("\n")}`;

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter((s): s is string => Boolean(s)) : []);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
const DEFAULT_KIND: Record<string, string> = { health: "other", id: "id_other", bill: "bill", insurance: "other_cover", car: "car_other", investment: "invest_other", other: "misc" };

/** Turns Claude's JSON into a draft in the app's own terms. */
export function toDraft(x: Raw, doc: Doc, members: Member[]): Draft {
  const category = (SECTIONS.includes(String(x.section)) ? x.section : doc.category) as Category;
  const allowed = CATEGORY_KINDS[category] ?? [DEFAULT_KIND[category]!];
  const kind = allowed.includes(String(x.kind)) ? String(x.kind) : DEFAULT_KIND[category]!;
  const who = String(x.belongs_to);
  const matched = members.find((m) => m.name === who)?.id;
  const owner = category === "car" || (who === "household" && category !== "investment") ? null : (matched ?? doc.member_id);
  const ownerSex = members.find((m) => m.id === owner)?.sex ?? null;
  const docDate = day(x.doc_date);
  const returnDays = num(x.return_days);
  const results: DraftResult[] = (Array.isArray(x.results) ? (x.results as Raw[]) : [])
    .map((r) => {
      const m = marker(String(r.marker_key));
      const name = str(r.name) ?? m?.name ?? "Test";
      const low = num(r.ref_low);
      const high = num(r.ref_high);
      const range = low == null && high == null ? defaultRange(m, ownerSex) : undefined;
      return {
        marker_key: m ? m.key : `other:${slug(name)}`,
        name,
        value: num(r.value),
        value_text: str(r.value_text),
        unit: str(r.unit) ?? m?.unit ?? null,
        ref_low: low ?? range?.low ?? null,
        ref_high: high ?? range?.high ?? null,
      };
    })
    .filter((r) => r.value != null || r.value_text);
  return {
    read_at: new Date().toISOString(),
    category,
    kind,
    title: str(x.title),
    doc_date: docDate,
    expires_on: category === "health" || category === "bill" ? null : day(x.expires_on),
    summary: str(x.summary),
    name_on_document: str(x.name_on_document),
    owner,
    lab_name: category === "health" ? str(x.lab_name) : null,
    doctor: category === "health" ? str(x.doctor) : null,
    details: {
      number: category === "id" ? str(x.number) : null,
      name: category === "id" ? str(x.name_on_document) : null,
      merchant: str(x.merchant),
      amount: num(x.amount),
      invoice_no: str(x.invoice_no),
      items: strs(x.items).slice(0, 15),
      warranty_months: num(x.warranty_months),
      return_by: docDate && returnDays ? addDays(docDate, returnDays) : null,
      insurer: str(x.insurer),
      policy_no: str(x.policy_no),
      sum_insured: num(x.sum_insured),
      premium: num(x.premium),
      insured: strs(x.insured),
      vehicle_no: str(x.vehicle_no)?.toUpperCase().replace(/[\s-]+/g, "") ?? null,
      make_model: str(x.make_model),
      ...(category === "investment" && {
        frequency: str(x.frequency) && FREQUENCY[String(x.frequency)] ? String(x.frequency) : null,
        due_on: day(x.due_on),
        nominee: str(x.nominee),
      }),
    },
    results: category === "health" ? results : [],
    medications:
      category === "health"
        ? (Array.isArray(x.medications) ? (x.medications as Raw[]) : []).filter((m) => str(m.name)).map((m) => ({ name: str(m.name)!, dose: str(m.dose), frequency: str(m.frequency) }))
        : [],
  };
}

async function blocks(files: string[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  return Promise.all(
    files.map(async (path) => {
      const { data, error } = await db().storage.from(BUCKET).download(path);
      if (error || !data) throw new Error("Couldn't open the uploaded file. Try again.");
      const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
      if (path.endsWith(".pdf")) return { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 } };
      const media = path.endsWith(".png") ? ("image/png" as const) : ("image/jpeg" as const);
      return { type: "image" as const, source: { type: "base64" as const, media_type: media, data: b64 } };
    }),
  );
}

class Stop extends Error {}

/** Reads one document into its draft. Never throws: problems end up in claude_error for the page to show. */
async function readOne(id: string) {
  const fail = (message: string) => db().from("documents").update({ claude_state: "failed", claude_error: message }).eq("id", id);
  let reservation: number | null = null;
  try {
    const { data: doc } = await db().from("documents").select("*").eq("id", id).maybeSingle<Doc>();
    if (!doc) return;
    if (!doc.files.length) return void (await fail("This document has no pages to read."));
    const { data: members } = await db().from("members").select("*").order("created_at");
    const family = (members ?? []) as Member[];
    const owner = family.find((m) => m.id === doc.member_id)?.name;
    const context = `Family members: ${family.map((m) => m.name).join(", ")}.
It was uploaded under ${CATEGORY_LABEL[doc.category]}, for ${owner ?? "the household"}${doc.files.length > 1 ? `, as ${doc.files.length} pages` : ""}. Today is ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}.`;
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: [...(await blocks(doc.files)), { type: "text", text: context }] }];
    const client = new Anthropic();

    // Reserve the worst case first (twice, in case a refusal fallback runs the request again); settle to the real cost after.
    const counted = await client.beta.messages.countTokens({ model: MODEL, system: SYSTEM, messages });
    const worst = 2 * inr(counted.input_tokens + 3000, MAX_TOKENS);
    const { data: rid, error: rpcError } = await db().rpc("reserve_claude_spend", { doc: id, est: Math.ceil(worst * 100) / 100, cap: SPEND_CAP_INR });
    if (rpcError) throw new Error(`Couldn't check the spending cap: ${rpcError.message}`);
    if (rid == null) throw new Stop(`The ₹${SPEND_CAP_INR} spending cap is reached (₹${Math.round(await spentInr())} used). Raise the cap to read more.`);
    reservation = rid as number;

    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema: schema(family.map((m) => m.name)) } },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages,
      });
    } catch (e) {
      // The API answered with an error, so nothing was generated or billed: release the reservation.
      if (e instanceof Anthropic.APIError && e.status) await db().from("claude_spend").update({ inr: 0, settled: true }).eq("id", reservation);
      throw e;
    }

    const u = res.usage;
    const top = { input: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), output: u.output_tokens };
    const hops = (u.iterations ?? []).reduce(
      (t, it) => ("input_tokens" in it ? { input: t.input + it.input_tokens + (it.cache_creation_input_tokens ?? 0) + (it.cache_read_input_tokens ?? 0), output: t.output + it.output_tokens } : t),
      { input: 0, output: 0 },
    );
    const used = { input: Math.max(top.input, hops.input), output: Math.max(top.output, hops.output) };
    await db()
      .from("claude_spend")
      .update({ inr: Math.ceil(inr(used.input, used.output) * 100) / 100, settled: true, input_tokens: used.input, output_tokens: used.output })
      .eq("id", reservation);

    if (res.stop_reason === "refusal") throw new Error("Claude declined to read this one. Fill it in by hand.");
    if (res.stop_reason === "max_tokens") throw new Error("This document is too long to read in one go. Fill it in by hand.");
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("Claude didn't return any details. Try again.");
    const draft = toDraft(JSON.parse(text.text) as Raw, doc, family);
    await db().from("documents").update({ draft, claude_state: null, claude_error: null }).eq("id", id);
  } catch (e) {
    console.error("claude read failed", id, e);
    const message =
      e instanceof Stop
        ? e.message
        : e instanceof Anthropic.RateLimitError
          ? "Claude is busy. Tap Try again in a minute."
          : e instanceof Anthropic.AuthenticationError
            ? "The Anthropic API key isn't working."
            : e instanceof Anthropic.APIError && e.status === 400 && /credit balance/i.test(e.message)
              ? "The Anthropic account is out of credit."
              : e instanceof Anthropic.APIError
                ? `Claude had a problem (${e.status ?? "network"}). Try again.`
                : e instanceof Error
                  ? e.message
                  : "Something went wrong. Try again.";
    await fail(message);
    if (e instanceof Stop) throw e;
  }
}

/** Reads queued documents one at a time, newest first, then hands what's left to a fresh function. */
export async function drainQueue(origin: string, budgetMs = 180_000) {
  if (!claudeEnabled()) return;
  const until = Date.now() + budgetMs;
  // A read that started over 10 minutes ago died with its function: queue it again.
  await db()
    .from("documents")
    .update({ claude_state: "queued" })
    .eq("claude_state", "reading")
    .lt("claude_at", new Date(Date.now() - 600_000).toISOString());
  while (Date.now() < until) {
    const { data: next } = await db().from("documents").select("id").eq("claude_state", "queued").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!next) return;
    const { data: claimed } = await db()
      .from("documents")
      .update({ claude_state: "reading", claude_at: new Date().toISOString(), claude_error: null })
      .eq("id", next.id)
      .eq("claude_state", "queued")
      .select("id");
    if (!claimed?.length) continue; // another run took it
    try {
      await readOne(next.id);
    } catch {
      // Cap reached: nothing else in the queue can be read either.
      const spent = Math.round(await spentInr());
      await db()
        .from("documents")
        .update({ claude_state: "failed", claude_error: `The ₹${SPEND_CAP_INR} spending cap is reached (₹${spent} used). Raise the cap to read more.` })
        .eq("claude_state", "queued");
      return;
    }
  }
  await kickQueue(origin);
}

/** Starts a background run of the queue in its own function, so it outlives the request that queued the work. */
export async function kickQueue(origin: string) {
  if (!claudeEnabled() || !process.env.CRON_SECRET) return;
  try {
    await fetch(`${origin}/api/cron/claude`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  } catch (e) {
    console.error("couldn't start the Claude queue", e);
  }
}

/** This site's own address, for starting background work on it from a server action. */
export async function siteOrigin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
