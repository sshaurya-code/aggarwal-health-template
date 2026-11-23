import { discardDraft, saveDraft } from "@/app/(app)/claude/actions";
import type { Doc, Member } from "@/lib/data";
import { mainResults, same } from "@/lib/draft";
import { FilterList, UseValue } from "./client";
import { FREQUENCY } from "@/lib/kinds";
import { CATEGORY_KINDS, CATEGORY_LABEL, fmtDate, KIND_LABEL, rupees } from "./ui";

type V = string | number | null | undefined;
type Spec = { name: string; label: string; saved: V; claude: V; type?: "date" | "money" | "number" };

const input = "min-w-0 flex-1 bg-transparent py-2 text-right outline-none placeholder:text-ink3";
const small = "h-9 w-full min-w-0 rounded-lg bg-card2 px-2 text-[15px] tabular-nums outline-none";
const blank = (v: V) => v == null || v === "";
const show = (s: Spec, v: V) => (s.type === "date" ? fmtDate(String(v)) : s.type === "money" ? rupees(Number(v)) : String(v));
const WARRANTY = [0, 6, 12, 24, 36, 60, 84, 120];
// Titles the app gives on its own; Claude's specific title is better than any of these.
const GENERIC = /^(health record|id document|bill|insurance policy|car paper|investment|document)$|'s /i;

/** One form row. A value someone already typed stays, with Claude's differing reading offered next to it. */
function Field({ s }: { s: Spec }) {
  const keep = !blank(s.saved);
  const value = keep ? s.saved : s.claude;
  const fromClaude = !keep && !blank(s.claude);
  return (
    <div className="border-b border-sep last:border-0">
      <label className={`flex min-h-11 items-center gap-3 py-1 pr-4 pl-4 ${fromClaude ? "bg-accent/8" : ""}`}>
        <span className="w-28 shrink-0 text-[17px]">{s.label}</span>
        <input
          name={s.name}
          type={s.type === "date" ? "date" : "text"}
          inputMode={s.type === "money" || s.type === "number" ? "decimal" : undefined}
          defaultValue={value ?? ""}
          autoComplete="off"
          className={input}
        />
      </label>
      {keep && !same(s.saved, s.claude) && <UseValue name={s.name} value={String(s.claude)} label={`Claude read ${show(s, s.claude)} · Use it`} />}
    </div>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <label className="flex min-h-11 items-center gap-3 border-b border-sep py-1 pr-4 pl-4 last:border-0">
      <span className="w-28 shrink-0 text-[17px]">{label}</span>
      <select name={name} defaultValue={value} className={`${input} appearance-none`} dir="rtl">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckCard({ doc, members, fromCheck }: { doc: Doc; members: Member[]; fromCheck: boolean }) {
  const d = doc.draft!;
  const c = d.category;
  const sd = doc.details;
  const cd = d.details;
  const main = mainResults(d.results);
  const same_section = c === doc.category;
  // Fields only carry the saved value over when the document stays in its section.
  const saved = <T,>(v: T) => (same_section ? v : null);
  const f = (name: string, label: string, s: V, cl: V, type?: Spec["type"]) => <Field key={name} s={{ name, label, saved: saved(s), claude: cl, type }} />;
  // The person it was uploaded for stays the default; a name matching someone else is only flagged.
  const owner = doc.member_id ?? (c === "health" ? d.owner : null);
  const elsewhere = c !== "car" && d.owner && d.owner !== owner ? d.owner : null;
  const name = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? "someone else") : "the household");
  const first = (id: string | null) => name(id).split(" ")[0];
  const title = !blank(doc.title) && !GENERIC.test(doc.title) && same_section ? doc.title : (d.title ?? doc.title);

  return (
    <form action={saveDraft.bind(null, doc.id)} className="mt-4">
      <div className="rounded-2xl bg-accent/10 px-4 py-3">
        <p className="text-[17px] font-semibold">Check Claude&apos;s details</p>
        <p className="mt-0.5 text-[13px] text-ink2">
          Claude read this document. Shaded fields are what it found; nothing is saved until you tap Save. Fix anything that&apos;s wrong first.
        </p>
        {!same_section && (
          <p className="mt-2 text-[15px]">
            Claude thinks this is <strong>{KIND_LABEL[d.kind] ?? CATEGORY_LABEL[c]}</strong>, so it will move to {CATEGORY_LABEL[c]} unless you change the section below.
          </p>
        )}
      </div>

      {elsewhere && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-warn/15">
          <p className="px-4 pt-3 text-[15px]">
            ⚠ <strong>This looks like {first(elsewhere)}&apos;s</strong>
            {d.name_on_document ? (
              <>
                {" "}
                (the name on it is {d.name_on_document})
              </>
            ) : null}
            , but it&apos;s filed under {first(owner)}. It stays with {first(owner)} if you just tap Save.
          </p>
          <UseValue name="member_id" value={elsewhere} label={`Move it to ${first(elsewhere)}`} />
        </div>
      )}

      <div className="card mt-3 overflow-hidden rounded-2xl bg-card">
        <Select name="category" label="Section" value={c} options={Object.entries(CATEGORY_LABEL).filter(([k]) => (k !== "health" && k !== "investment") || owner)} />
        {c !== "car" && (
          <Select
            name="member_id"
            label="Whose"
            value={owner ?? (c === "investment" ? (members[0]?.id ?? "") : "")}
            options={[...(c === "health" || c === "investment" ? [] : [["", "Household"] as [string, string]]), ...members.map((m): [string, string] => [m.id, m.name])]}
          />
        )}
        {CATEGORY_KINDS[c] && CATEGORY_KINDS[c].length > 1 && (
          <Select name="kind" label="Type" value={d.kind} options={CATEGORY_KINDS[c].map((k): [string, string] => [k, KIND_LABEL[k]!])} />
        )}
        <div className="border-b border-sep last:border-0">
          <label className={`flex min-h-11 items-center gap-3 py-1 pr-4 pl-4 ${title === d.title ? "bg-accent/8" : ""}`}>
            <span className="w-28 shrink-0 text-[17px]">Name</span>
            <input name="title" defaultValue={title} autoComplete="off" className={input} />
          </label>
          {title !== doc.title && <UseValue name="title" value={doc.title} label={`Keep the old name, “${doc.title}”`} />}
        </div>
        {c === "health" && [f("doc_date", "Date", doc.doc_date, d.doc_date, "date"), f("lab_name", "Lab", doc.lab_name, d.lab_name), f("doctor", "Doctor", doc.doctor, d.doctor)]}
        {c === "id" && [f("number", "Number", sd.number, cd.number), f("name", "Name on card", sd.name, cd.name), f("expires_on", "Valid until", doc.expires_on, d.expires_on, "date")]}
        {c === "id" && <input type="hidden" name="doc_date" value={doc.doc_date ?? d.doc_date ?? ""} />}
        {c === "bill" && [
          f("merchant", "Shop", sd.merchant, cd.merchant),
          f("doc_date", "Bill date", doc.doc_date, d.doc_date, "date"),
          f("amount", "Total (₹)", sd.amount, cd.amount, "money"),
          f("invoice_no", "Invoice no.", sd.invoice_no, cd.invoice_no),
          f("return_by", "Return by", sd.return_by, cd.return_by, "date"),
        ]}
        {c === "bill" && (
          <Select
            name="warranty_months"
            label="Warranty"
            value={String(saved(sd.warranty_months) ?? cd.warranty_months ?? "")}
            options={[...new Set([...WARRANTY, cd.warranty_months ?? 0])].map((m): [string, string] => [m ? String(m) : "", m === 0 ? "None" : m < 12 || m % 12 ? `${m} months` : `${m / 12} year${m === 12 ? "" : "s"}`])}
          />
        )}
        {c === "car" && [
          f("vehicle_no", "Vehicle no.", sd.vehicle_no, cd.vehicle_no),
          f("make_model", "Make & model", sd.make_model, cd.make_model),
          f("doc_date", d.kind === "motor_cover" ? "Starts" : "Issued", doc.doc_date, d.doc_date, "date"),
          f("expires_on", d.kind === "motor_cover" ? "Ends" : "Valid until", doc.expires_on, d.expires_on, "date"),
        ]}
        {(c === "insurance" || (c === "car" && d.kind === "motor_cover")) && [
          f("insurer", "Insurer", sd.insurer, cd.insurer),
          f("policy_no", "Policy no.", sd.policy_no, cd.policy_no),
          ...(c === "insurance" ? [f("doc_date", "Starts", doc.doc_date, d.doc_date, "date"), f("expires_on", "Ends", doc.expires_on, d.expires_on, "date")] : []),
          f("insured", "Covers", sd.insured?.join(", "), cd.insured?.join(", ")),
          f("sum_insured", c === "car" ? "IDV" : "Sum insured", sd.sum_insured, cd.sum_insured, "money"),
          f("premium", "Premium", sd.premium, cd.premium, "money"),
        ]}
        {c === "investment" && [
          f("insurer", d.kind === "life_cover" ? "Insurer" : "With", sd.insurer, cd.insurer),
          f("policy_no", d.kind === "life_cover" ? "Policy no." : "Folio / a/c", sd.policy_no, cd.policy_no),
          f("premium", d.kind === "life_cover" ? "Premium" : "Amount", sd.premium, cd.premium, "money"),
        ]}
        {c === "investment" && (
          <Select
            name="frequency"
            label="How often"
            value={sd.frequency ?? cd.frequency ?? ""}
            options={[["", "Not set"], ...Object.entries(FREQUENCY).map(([k, v]): [string, string] => [k, v.label])]}
          />
        )}
        {c === "investment" && [
          f("due_on", "Next due", sd.due_on, cd.due_on, "date"),
          f("doc_date", "Started", doc.doc_date, d.doc_date, "date"),
          f("expires_on", d.kind === "life_cover" ? "Cover ends" : "Matures", doc.expires_on, d.expires_on, "date"),
          f("sum_insured", d.kind === "life_cover" ? "Sum assured" : "Value", sd.sum_insured, cd.sum_insured, "money"),
          f("nominee", "Nominee", sd.nominee, cd.nominee),
        ]}
        {c === "other" && [f("doc_date", "Date", doc.doc_date, d.doc_date, "date"), f("expires_on", "Valid until", doc.expires_on, d.expires_on, "date")]}
      </div>

      {c === "health" && d.results.length > 0 && (
        <>
          <p className="mt-6 mb-2 px-1 text-[20px] font-bold tracking-tight">Test values · {d.results.length}</p>
          <div className="card overflow-hidden rounded-2xl bg-card">
            <FilterList
              items={d.results.map((r, i) => ({
                key: String(i),
                label: r.name,
                main: d.results.length <= 6 || main.has(r),
                node: (
              <div key={i} className="border-b border-sep px-4 py-2.5 last:border-0">
                <label className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[17px]">{r.name}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink2">
                    Keep <input type="checkbox" name={`r:${i}:keep`} defaultChecked className="h-5 w-5 accent-[var(--color-accent)]" />
                  </span>
                </label>
                {r.value == null && r.value_text && <p className="text-[13px] text-ink2">Result: {r.value_text}</p>}
                <div className="mt-1.5 grid grid-cols-4 gap-1.5 text-[11px] text-ink2">
                  <label>
                    Value
                    <input name={`r:${i}:value`} inputMode="decimal" defaultValue={r.value ?? ""} className={small} />
                  </label>
                  <label>
                    Unit
                    <input name={`r:${i}:unit`} defaultValue={r.unit ?? ""} className={small} />
                  </label>
                  <label>
                    Low
                    <input name={`r:${i}:low`} inputMode="decimal" defaultValue={r.ref_low ?? ""} className={small} />
                  </label>
                  <label>
                    High
                    <input name={`r:${i}:high`} inputMode="decimal" defaultValue={r.ref_high ?? ""} className={small} />
                  </label>
                </div>
              </div>
                ),
              }))}
            />
          </div>
          <p className="mt-2 px-1 text-[13px] text-ink2">Compare each value with the report before saving. Untick any test that shouldn&apos;t be kept.</p>
        </>
      )}

      {c === "health" && d.medications.length > 0 && (
        <>
          <p className="mt-6 mb-2 px-1 text-[20px] font-bold tracking-tight">Medicines · {d.medications.length}</p>
          <div className="card overflow-hidden rounded-2xl bg-card">
            {d.medications.map((m, i) => (
              <div key={i} className="border-b border-sep px-4 py-2.5 last:border-0">
                <div className="flex items-center gap-2">
                  <input name={`med:${i}:name`} defaultValue={m.name} className={`${small} flex-1 text-[17px]`} />
                  <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink2">
                    Keep <input type="checkbox" name={`med:${i}:keep`} defaultChecked className="h-5 w-5 accent-[var(--color-accent)]" />
                  </label>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] text-ink2">
                  <label>
                    Dose
                    <input name={`med:${i}:dose`} defaultValue={m.dose ?? ""} className={small} />
                  </label>
                  <label>
                    How often
                    <input name={`med:${i}:frequency`} defaultValue={m.frequency ?? ""} className={small} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-6 mb-2 px-1 text-[20px] font-bold tracking-tight">Summary</p>
      <textarea name="summary" defaultValue={doc.summary ?? d.summary ?? ""} rows={4} className="card w-full rounded-2xl bg-card px-4 py-3 text-[15px] leading-relaxed outline-none" />
      {doc.summary && d.summary && doc.summary !== d.summary && <UseValue name="summary" value={d.summary} label="Use Claude's summary instead" />}

      {fromCheck && <input type="hidden" name="from" value="check" />}
      <button className="tap mt-4 h-[50px] w-full rounded-2xl bg-accent text-[17px] font-semibold text-white">{fromCheck ? "Save and check the next" : "Save"}</button>
      <button formAction={discardDraft.bind(null, doc.id)} className="tap card mt-3 h-[50px] w-full rounded-2xl bg-card text-[17px] font-semibold text-bad">
        Discard Claude&apos;s reading
      </button>
    </form>
  );
}
