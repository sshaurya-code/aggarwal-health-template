import "server-only";
import { dueTests, type Doc, type Member, type Reading } from "./data";
import { FREQUENCY, KIND_LABEL } from "./kinds";

export type Reminder = {
  key: string;
  type: keyof typeof STAGES;
  title: string;
  body: string;
  date: string;
  days: number;
  href: string;
  memberId: string | null;
};

// Days before the date at which each reminder is pushed; the first one is also when it starts showing on Home.
// IDs start six months out because a passport renewal takes weeks and many visas need six months' validity.
const STAGES = {
  id: [180, 60, 30, 7, 0],
  insurance: [30, 7, 1, 0],
  warranty: [30, 7, 0],
  return: [2, 0],
  test: [0],
  puc: [15, 3, 0],
  car_paper: [60, 30, 0], // RC, fitness, road tax, permit
  investment: [3, 0], // every payment, monthly SIPs included
  maturity: [30, 7, 0],
  other: [30, 7, 0],
};
const GRACE_DAYS = 30; // how long an expired warranty, return window or maturity stays listed

/** The same day of the month, `months` later; the 31st becomes the month's last day. */
function stepMonths(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/** An investment's next payment on or after today, stepping from one known payment date; null if none is left. */
export function nextDue(d: Pick<Doc, "details" | "expires_on">, today = istToday()) {
  const start = d.details.due_on;
  if (!start) return null;
  const step = FREQUENCY[d.details.frequency ?? ""]?.months ?? 0;
  let due = start;
  for (let n = 1; step && due < today; n++) due = stepMonths(start, n * step);
  if (due < today || (d.expires_on && due > d.expires_on)) return null;
  return due;
}

const GENERIC_KINDS = new Set(["id_other", "other_cover", "car_other", "misc", "invest_other"]);

/** A newer copy of the same paper (same person, type and car, later expiry) is on file. */
function renewedBy(d: Doc, docs: Doc[]) {
  return docs.some(
    (o) =>
      o.id !== d.id &&
      o.kind === d.kind &&
      o.member_id === d.member_id &&
      (!GENERIC_KINDS.has(d.kind) || o.title === d.title) &&
      (d.category !== "car" || o.details.vehicle_no === d.details.vehicle_no) &&
      Boolean(o.expires_on && d.expires_on && o.expires_on > d.expires_on),
  );
}

export const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function when(days: number) {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 60) return `in ${days} days`;
  if (days < 730) return `in ${Math.round(days / 30)} months`;
  return `in ${Math.round(days / 365)} years`;
}

/** The most urgent stage a reminder has reached, or null if it isn't due for a push yet. */
export function stageOf(r: Reminder) {
  const reached = STAGES[r.type].filter((d) => r.days <= d);
  return reached.length ? Math.min(...reached) : null;
}

// Papers that matter after their date: an expired ID or policy stays listed until it's renewed or marked not renewing.
const LASTING = new Set<Reminder["type"]>(["id", "insurance", "puc", "car_paper", "other"]);

/**
 * Everything with a date that needs the family. By default only what is close enough to show on Home
 * (each type's first stage); `all` includes every future date too, for the dates dashboard.
 */
export function reminders(docs: Doc[], members: Member[], readings: Reading[], today = istToday(), { all = false } = {}) {
  const first = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name.split(" ")[0] ?? "") : "Household");
  const out: Reminder[] = [];
  const push = (r: Omit<Reminder, "days">) => {
    const days = daysBetween(today, r.date);
    if (!all && days > STAGES[r.type][0]!) return;
    if (days < 0 && !LASTING.has(r.type) && days < -GRACE_DAYS) return;
    out.push({ ...r, days });
  };

  for (const d of docs) {
    // Superseded or deliberately let go: nothing to do about this one.
    if (d.expires_on && (renewedBy(d, docs) || (d.details.not_renewing && d.expires_on < today))) continue;
    const who = first(d.member_id);
    const href = `/d/${d.id}`;
    if (d.category === "investment") {
      const due = nextDue(d, today);
      const freq = FREQUENCY[d.details.frequency ?? ""];
      if (due)
        push({
          key: `investment:${d.id}:${due}`,
          type: "investment",
          title: `${who}'s ${d.title} ${freq?.months === 0 ? "payment" : (freq?.label.toLowerCase() ?? "") + " payment"} due ${when(daysBetween(today, due))}`.replace(/\s+/g, " "),
          body: `${[d.details.premium != null ? `₹${d.details.premium.toLocaleString("en-IN")}` : null, d.details.insurer].filter(Boolean).join(" · ") || KIND_LABEL[d.kind]} · due ${fmt(due)}.`,
          date: due,
          href,
          memberId: d.member_id,
        });
      if (d.expires_on)
        push({
          key: `maturity:${d.id}:${d.expires_on}`,
          type: "maturity",
          title: `${who}'s ${d.title} ${d.expires_on < today ? (d.kind === "life_cover" ? "cover has ended" : "has matured") : `${d.kind === "life_cover" ? "cover ends" : "matures"} ${when(daysBetween(today, d.expires_on))}`}`,
          body: `${KIND_LABEL[d.kind]}${d.details.insurer ? ` · ${d.details.insurer}` : ""} · ${fmt(d.expires_on)}.`,
          date: d.expires_on,
          href,
          memberId: d.member_id,
        });
      continue;
    }
    if (d.expires_on && d.category === "id")
      push({
        key: `id:${d.id}:${d.expires_on}`,
        type: "id",
        title: `${who}'s ${d.kind === "id_other" ? d.title : (KIND_LABEL[d.kind] ?? "ID")} ${d.expires_on < today ? "has expired" : "expires " + when(daysBetween(today, d.expires_on))}`,
        body: d.expires_on < today ? `Expired ${fmt(d.expires_on)}. Renew it, or open it and tap Not renewing.` : `Valid until ${fmt(d.expires_on)}. Start the renewal early.`,
        date: d.expires_on,
        href,
        memberId: d.member_id,
      });
    if (d.expires_on && d.category === "insurance")
      push({
        key: `insurance:${d.id}:${d.expires_on}`,
        type: "insurance",
        title: `${d.title} ${d.expires_on < today ? "has lapsed" : "renews " + when(daysBetween(today, d.expires_on))}`,
        body: `${who} · cover ends ${fmt(d.expires_on)}.`,
        date: d.expires_on,
        href,
        memberId: d.member_id,
      });
    if (d.expires_on && d.category === "bill")
      push({
        key: `warranty:${d.id}:${d.expires_on}`,
        type: "warranty",
        title: `${d.title} warranty ${d.expires_on < today ? "ended" : "ends " + when(daysBetween(today, d.expires_on))}`,
        body: `${who} · bought ${d.doc_date ? fmt(d.doc_date) : ""}${d.details.merchant ? ` at ${d.details.merchant}` : ""}. Get anything faulty fixed before ${fmt(d.expires_on)}.`,
        date: d.expires_on,
        href,
        memberId: d.member_id,
      });
    if (d.expires_on && d.category === "car") {
      const car = d.details.vehicle_no ?? "Car";
      const paper = KIND_LABEL[d.kind] ?? "paper";
      const type = d.kind === "motor_cover" ? "insurance" : d.kind === "puc" ? "puc" : d.kind === "car_other" ? "other" : "car_paper";
      push({
        key: `${type}:${d.id}:${d.expires_on}`,
        type,
        title: `${car} ${paper} ${d.expires_on < today ? "has expired" : "expires " + when(daysBetween(today, d.expires_on))}`,
        body: `Valid until ${fmt(d.expires_on)}.${d.details.make_model ? ` ${d.details.make_model}.` : ""}`,
        date: d.expires_on,
        href,
        memberId: null,
      });
    }
    if (d.expires_on && d.category === "other")
      push({
        key: `other:${d.id}:${d.expires_on}`,
        type: "other",
        title: `${d.title} ${d.expires_on < today ? "has expired" : "expires " + when(daysBetween(today, d.expires_on))}`,
        body: `${who} · valid until ${fmt(d.expires_on)}.`,
        date: d.expires_on,
        href,
        memberId: d.member_id,
      });
    if (d.details.return_by && d.details.return_by >= today)
      push({
        key: `return:${d.id}:${d.details.return_by}`,
        type: "return",
        title: `Return window for ${d.title} closes ${when(daysBetween(today, d.details.return_by))}`,
        body: `${who} · last day ${fmt(d.details.return_by)}.`,
        date: d.details.return_by,
        href,
        memberId: d.member_id,
      });
  }

  for (const m of members) {
    const due = dueTests(
      readings.filter((r) => r.member_id === m.id),
      m.sex,
    ).filter((t) => t.overdue && t.last && t.dueOn);
    for (const t of due)
      out.push({
        key: `test:${m.id}:${t.key}:${t.last}`,
        type: "test",
        title: `${t.name} due for ${first(m.id)}`,
        body: `Last tested ${fmt(t.last!)}${t.flagged ? ", when it was out of range" : ""}. Worth booking a retest.`,
        date: t.dueOn!,
        days: daysBetween(today, t.dueOn!),
        href: `/m/${m.id}/marker/${t.key}`,
        memberId: m.id,
      });
  }

  return out.sort((a, b) => a.days - b.days);
}
