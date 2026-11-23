import { saveDetails } from "@/app/actions";
import type { Doc } from "@/lib/data";
import { FREQUENCY } from "@/lib/kinds";
import { istToday, nextDue } from "@/lib/reminders";
import { CATEGORY_KINDS, CATEGORY_LABEL, fmtDate, KIND_LABEL, Row, rupees } from "./ui";

const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.parse(istToday())) / 86_400_000);

/** Expiry pill: always for IDs and policies, but only near the end for warranties (old bills shouldn't all say "expired"). */
export function ExpiryChip({ doc }: { doc: Pick<Doc, "category" | "kind" | "expires_on"> }) {
  if (!doc.expires_on) return null;
  const days = daysUntil(doc.expires_on);
  if (doc.category === "bill" && (days < 0 || days > 30)) return null;
  const [label, cls] =
    days < 0
      ? [doc.category === "investment" ? (doc.kind === "life_cover" ? "Cover ended" : "Matured") : doc.category === "insurance" || doc.kind === "motor_cover" ? "Lapsed" : "Expired", doc.category === "investment" ? "bg-card2 text-ink2" : "bg-bad/14 text-bad"]
      : days <= 30
        ? [days === 0 ? "Ends today" : `${days} day${days === 1 ? "" : "s"} left`, "bg-warn/15 text-warn"]
        : days <= 180 && doc.category === "id"
          ? [`Renew by ${fmtDate(doc.expires_on, { month: "short", year: "numeric" })}`, "bg-warn/15 text-warn"]
          : [null, ""];
  return label ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${cls}`}>{label}</span> : null;
}

/** The date on the document itself; until someone sets it, say plainly that it's only the upload date. */
export const docDateLabel = (doc: Pick<Doc, "doc_date" | "created_at">) =>
  doc.doc_date ? fmtDate(doc.doc_date) : `Uploaded ${fmtDate(doc.created_at, { day: "numeric", month: "short" })}`;

/** "Aadhaar · ••1234" style line for lists, so full ID numbers aren't on every screen. */
export function vaultLine(doc: Doc) {
  const d = doc.details;
  if (doc.category === "id") return [doc.title !== KIND_LABEL[doc.kind] && KIND_LABEL[doc.kind], d.number && `••${d.number.replace(/\s/g, "").slice(-4)}`];
  if (doc.category === "bill") return [d.merchant, rupees(d.amount), docDateLabel(doc)];
  if (doc.category === "car") return [KIND_LABEL[doc.kind], d.vehicle_no, doc.expires_on && `until ${fmtDate(doc.expires_on)}`];
  if (doc.category === "other") return [doc.doc_date && fmtDate(doc.doc_date), doc.expires_on && `until ${fmtDate(doc.expires_on)}`];
  if (doc.category === "investment") return [KIND_LABEL[doc.kind], d.insurer, paymentLine(doc)];
  return [KIND_LABEL[doc.kind], d.insurer, doc.expires_on && `until ${fmtDate(doc.expires_on)}`];
}

/** "₹5,000 monthly · next 5 Dec 2026" */
export function paymentLine(doc: Pick<Doc, "details" | "expires_on">) {
  const d = doc.details;
  const freq = FREQUENCY[d.frequency ?? ""];
  const next = nextDue(doc);
  return [rupees(d.premium) && `${rupees(d.premium)}${freq ? ` ${freq.months ? freq.label.toLowerCase() : "once"}` : ""}`, next && `next ${fmtDate(next)}`].filter(Boolean).join(" · ") || null;
}

function Item({ label, value, big }: { label: string; value: React.ReactNode; big?: boolean }) {
  if (value == null || value === "") return null;
  return (
    <Row>
      <p className="text-[13px] text-ink2">{label}</p>
      <p className={big ? `${String(value).length > 16 ? "text-[19px]" : "text-[24px]"} font-semibold tracking-wider break-all tabular-nums select-all` : "text-[17px]"}>{value}</p>
    </Row>
  );
}

export function VaultCard({ doc }: { doc: Doc }) {
  const d = doc.details;
  if (doc.category === "id")
    return (
      <>
        <Item label="Number" value={d.number} big />
        <Item label="Name on card" value={d.name} />
        <Item label="Valid until" value={doc.expires_on ? fmtDate(doc.expires_on) : null} />
      </>
    );
  if (doc.category === "bill")
    return (
      <>
        <Item label="Total" value={rupees(d.amount)} big />
        <Item label="Shop" value={d.merchant} />
        <Item label="Bill date" value={doc.doc_date ? fmtDate(doc.doc_date) : null} />
        <Item label="Invoice no." value={d.invoice_no} />
        <Item label="Warranty" value={doc.expires_on ? `Until ${fmtDate(doc.expires_on)} (${d.warranty_months} months)` : "Not recorded. Add it below if the item has one."} />
        <Item label="Return by" value={d.return_by ? fmtDate(d.return_by) : null} />
        <Item label="Items" value={d.items?.length ? d.items.join(", ") : null} />
      </>
    );
  if (doc.category === "car" && doc.kind !== "motor_cover")
    return (
      <>
        <Item label="Vehicle" value={d.vehicle_no} big />
        <Item label="Make & model" value={d.make_model} />
        <Item label="Issued" value={doc.doc_date ? fmtDate(doc.doc_date) : null} />
        <Item label="Valid until" value={doc.expires_on ? fmtDate(doc.expires_on) : null} />
      </>
    );
  if (doc.category === "investment") {
    const next = nextDue(doc);
    const freq = FREQUENCY[d.frequency ?? ""];
    return (
      <>
        <Item label={doc.kind === "life_cover" ? "Policy number" : "Folio / account no."} value={d.policy_no} big />
        <Item label={doc.kind === "life_cover" ? "Insurer" : "With"} value={d.insurer} />
        <Item label={doc.kind === "life_cover" ? "Premium" : "Amount"} value={[rupees(d.premium), freq?.label].filter(Boolean).join(" · ") || null} />
        <Item label="Next payment" value={next ? fmtDate(next) : d.due_on ? "No payments left" : "Add a payment date below to get reminders"} />
        <Item label="Started" value={doc.doc_date ? fmtDate(doc.doc_date) : null} />
        <Item label={doc.kind === "life_cover" ? "Cover ends" : "Matures"} value={doc.expires_on ? fmtDate(doc.expires_on) : null} />
        <Item label={doc.kind === "life_cover" ? "Sum assured" : "Value"} value={rupees(d.sum_insured)} />
        <Item label="Nominee" value={d.nominee} />
      </>
    );
  }
  if (doc.category === "other")
    return (
      <>
        <Item label="Date" value={doc.doc_date ? fmtDate(doc.doc_date) : null} />
        <Item label="Valid until" value={doc.expires_on ? fmtDate(doc.expires_on) : null} />
      </>
    );
  return (
    <>
      <Item label="Policy number" value={d.policy_no} big />
      <Item label="Insurer" value={d.insurer} />
      <Item label="Cover" value={[doc.doc_date && fmtDate(doc.doc_date), doc.expires_on && fmtDate(doc.expires_on)].filter(Boolean).join(" → ") || null} />
      <Item label="Covers" value={d.insured?.length ? d.insured.join(", ") : null} />
      <Item label="Vehicle" value={[d.vehicle_no, d.make_model].filter(Boolean).join(" · ") || null} />
      <Item label={doc.kind === "motor_cover" ? "IDV" : "Sum insured"} value={rupees(d.sum_insured)} />
      <Item label="Premium" value={rupees(d.premium)} />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 border-b border-sep py-1 pr-4 pl-4 last:border-0">
      <span className="w-28 shrink-0 text-[17px]">{label}</span>
      {children}
    </label>
  );
}

const input = "min-w-0 flex-1 bg-transparent py-2 text-right outline-none placeholder:text-ink3";
const WARRANTY = [0, 6, 12, 24, 36, 60, 84, 120];

function Text({ name, value, ...rest }: { name: string; value?: string | number | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value">) {
  return <input name={name} defaultValue={value ?? ""} className={input} autoComplete="off" {...rest} />;
}

function KindSelect({ doc }: { doc: Doc }) {
  return (
    <Field label="Type">
      <select name="kind" defaultValue={doc.kind} className={`${input} appearance-none`} dir="rtl">
        {CATEGORY_KINDS[doc.category]!.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function VaultForm({ doc }: { doc: Doc }) {
  const d = doc.details;
  return (
    <form action={saveDetails.bind(null, doc.id)}>
      <div className="card overflow-hidden rounded-2xl bg-card">
        <Field label="Section">
          <select name="category" defaultValue={doc.category} className={`${input} appearance-none`} dir="rtl">
            {Object.entries(CATEGORY_LABEL)
              .filter(([c]) => (c !== "health" && c !== "investment") || doc.member_id)
              .map(([c, label]) => (
                <option key={c} value={c}>
                  {label}
                </option>
              ))}
          </select>
        </Field>
        {doc.category === "health" && (
          <>
            <KindSelect doc={doc} />
            <Field label="Name">
              <Text name="title" value={doc.title} placeholder="Blood test, Dr Mehta…" />
            </Field>
            <Field label="Date">
              <Text name="doc_date" type="date" value={doc.doc_date} />
            </Field>
          </>
        )}
        {doc.category === "id" && (
          <>
            <KindSelect doc={doc} />
            <Field label="Name">
              <Text name="title" value={doc.title === "ID document" ? "" : doc.title} placeholder="Shown as the ID type if blank" />
            </Field>
            <Field label="Number">
              <Text name="number" value={d.number} placeholder="As printed" />
            </Field>
            <Field label="Name on card">
              <Text name="name" value={d.name} placeholder="Optional" />
            </Field>
            <Field label="Valid until">
              <Text name="expires_on" type="date" value={doc.expires_on} />
            </Field>
          </>
        )}
        {doc.category === "bill" && (
          <>
            <Field label="Item">
              <Text name="title" value={doc.title} placeholder="What was bought" />
            </Field>
            <Field label="Shop">
              <Text name="merchant" value={d.merchant} placeholder="Croma, Amazon…" />
            </Field>
            <Field label="Bill date">
              <Text name="doc_date" type="date" value={doc.doc_date} />
            </Field>
            <Field label="Total (₹)">
              <Text name="amount" inputMode="decimal" value={d.amount} placeholder="0" />
            </Field>
            <Field label="Invoice no.">
              <Text name="invoice_no" value={d.invoice_no} placeholder="Optional" />
            </Field>
            <Field label="Warranty">
              <select name="warranty_months" defaultValue={d.warranty_months ?? ""} className={`${input} appearance-none`} dir="rtl">
                {WARRANTY.map((m) => (
                  <option key={m} value={m || ""}>
                    {m === 0 ? "None" : m < 12 ? `${m} months` : `${m / 12} year${m === 12 ? "" : "s"}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Return by">
              <Text name="return_by" type="date" value={d.return_by} />
            </Field>
          </>
        )}
        {doc.category === "car" && (
          <>
            <KindSelect doc={doc} />
            <Field label="Name">
              <Text name="title" value={doc.title} placeholder="PUC, RC, policy…" />
            </Field>
            <Field label="Vehicle no.">
              <Text name="vehicle_no" value={d.vehicle_no} placeholder="HR51AB1234" />
            </Field>
            <Field label="Make & model">
              <Text name="make_model" value={d.make_model} placeholder="From the RC" />
            </Field>
            <Field label={doc.kind === "motor_cover" ? "Starts" : "Issued"}>
              <Text name="doc_date" type="date" value={doc.doc_date} />
            </Field>
            <Field label={doc.kind === "motor_cover" ? "Ends" : "Valid until"}>
              <Text name="expires_on" type="date" value={doc.expires_on} />
            </Field>
            {doc.kind === "motor_cover" && (
              <>
                <Field label="Insurer">
                  <Text name="insurer" value={d.insurer} />
                </Field>
                <Field label="Policy no.">
                  <Text name="policy_no" value={d.policy_no} />
                </Field>
                <Field label="IDV">
                  <Text name="sum_insured" inputMode="decimal" value={d.sum_insured} placeholder="₹" />
                </Field>
                <Field label="Premium">
                  <Text name="premium" inputMode="decimal" value={d.premium} placeholder="₹" />
                </Field>
              </>
            )}
          </>
        )}
        {doc.category === "investment" && (
          <>
            <KindSelect doc={doc} />
            <Field label="Name">
              <Text name="title" value={doc.title} placeholder="LIC Jeevan Anand, HDFC SIP…" />
            </Field>
            <Field label={doc.kind === "life_cover" ? "Insurer" : "With"}>
              <Text name="insurer" value={d.insurer} placeholder="LIC, HDFC MF, SBI…" />
            </Field>
            <Field label={doc.kind === "life_cover" ? "Policy no." : "Folio / a/c"}>
              <Text name="policy_no" value={d.policy_no} />
            </Field>
            <Field label={doc.kind === "life_cover" ? "Premium" : "Amount"}>
              <Text name="premium" inputMode="decimal" value={d.premium} placeholder="₹ each payment" />
            </Field>
            <Field label="How often">
              <select name="frequency" defaultValue={d.frequency ?? ""} className={`${input} appearance-none`} dir="rtl">
                <option value="">Not set</option>
                {Object.entries(FREQUENCY).map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Next due">
              <Text name="due_on" type="date" value={d.due_on} />
            </Field>
            <Field label="Started">
              <Text name="doc_date" type="date" value={doc.doc_date} />
            </Field>
            <Field label={doc.kind === "life_cover" ? "Cover ends" : "Matures"}>
              <Text name="expires_on" type="date" value={doc.expires_on} />
            </Field>
            <Field label={doc.kind === "life_cover" ? "Sum assured" : "Value"}>
              <Text name="sum_insured" inputMode="decimal" value={d.sum_insured} placeholder="₹" />
            </Field>
            <Field label="Nominee">
              <Text name="nominee" value={d.nominee} placeholder="Optional" />
            </Field>
          </>
        )}
        {doc.category === "other" && (
          <>
            <Field label="Name">
              <Text name="title" value={doc.title} placeholder="What it is" />
            </Field>
            <Field label="Date">
              <Text name="doc_date" type="date" value={doc.doc_date} />
            </Field>
            <Field label="Valid until">
              <Text name="expires_on" type="date" value={doc.expires_on} />
            </Field>
          </>
        )}
        {doc.category === "insurance" && (
          <>
            <KindSelect doc={doc} />
            <Field label="Name">
              <Text name="title" value={doc.title} placeholder="Insurer and plan" />
            </Field>
            <Field label="Insurer">
              <Text name="insurer" value={d.insurer} />
            </Field>
            <Field label="Policy no.">
              <Text name="policy_no" value={d.policy_no} />
            </Field>
            <Field label="Starts">
              <Text name="doc_date" type="date" value={doc.doc_date} />
            </Field>
            <Field label="Ends">
              <Text name="expires_on" type="date" value={doc.expires_on} />
            </Field>
            <Field label="Covers">
              <Text name="insured" value={d.insured?.join(", ")} placeholder="Names, comma separated" />
            </Field>
            <Field label="Vehicle no.">
              <Text name="vehicle_no" value={d.vehicle_no} placeholder="For car or bike cover" />
            </Field>
            <Field label="Sum insured">
              <Text name="sum_insured" inputMode="decimal" value={d.sum_insured} placeholder="₹" />
            </Field>
            <Field label="Premium">
              <Text name="premium" inputMode="decimal" value={d.premium} placeholder="₹" />
            </Field>
          </>
        )}
      </div>
      {doc.category === "id" && <input type="hidden" name="doc_date" value={doc.doc_date ?? ""} />}
      <button className="tap mt-3 h-[50px] w-full rounded-2xl bg-accent text-[17px] font-semibold text-white">Save details</button>
    </form>
  );
}
