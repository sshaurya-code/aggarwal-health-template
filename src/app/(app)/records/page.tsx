import Link from "next/link";
import { DocRow } from "@/components/DocRow";
import { CATEGORY_STYLE } from "@/components/theme";
import { ExpiryChip } from "@/components/VaultDetails";
import { Avatar, CATEGORY_LABEL, Empty, fmtDate, HouseholdAvatar, KIND_LABEL, LargeTitle, Page, Row, rupees, Section } from "@/components/ui";
import { claudeEnabled } from "@/lib/claude";
import { getDocs, getMembers } from "@/lib/data";
import { istToday } from "@/lib/reminders";

export default async function RecordsPage({ searchParams }: PageProps<"/records">) {
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const cat = param("cat");
  const kind = param("kind");
  const owner = param("owner"); // a member id, or "household"
  const q = param("q").trim().toLowerCase();
  const [docs, members] = await Promise.all([getDocs(), getMembers()]);
  const names = new Map(members.map((m) => [m.id, m.name.split(" ")[0]!]));
  const waiting = docs.filter((d) => d.draft && !d.claude_state).length;
  const who = (id: string | null) => (id ? names.get(id) : "Household");

  const theirs = docs.filter((d) => !owner || (owner === "household" ? !d.member_id : d.member_id === owner));
  const scoped = theirs.filter((d) => !cat || d.category === cat);
  const shown = scoped.filter(
    (d) =>
      (!kind || d.kind === kind) &&
      (!q || [d.title, d.lab_name, d.doctor, d.summary, d.text, who(d.member_id), JSON.stringify(d.details)].some((s) => s?.toLowerCase().includes(q))),
  );
  const months = new Map<string, typeof docs>();
  for (const d of shown) {
    const label = new Date(d.doc_date ?? d.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!months.has(label)) months.set(label, []);
    months.get(label)!.push(d);
  }
  const cats = Object.keys(CATEGORY_LABEL).filter((c) => docs.some((d) => d.category === c && (!owner || (owner === "household" ? !d.member_id : d.member_id === owner))));
  const kinds = cat ? [...new Set(scoped.map((d) => d.kind))] : [];
  const href = (next: Record<string, string>) => `/records?${new URLSearchParams(Object.fromEntries(Object.entries({ cat, kind, owner, q, ...next }).filter(([, v]) => v)))}`;
  const chip = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-[15px] ${active ? "bg-accent text-white" : "bg-card text-ink"}`;

  return (
    <Page>
      {owner ? (
        <LargeTitle
          title={owner === "household" ? "Household records" : `${who(owner)}'s records`}
          subtitle={`${theirs.length} document${theirs.length === 1 ? "" : "s"}`}
          back={owner === "household" ? { href: "/", label: "Family" } : { href: `/m/${owner}`, label: who(owner) ?? "Back" }}
          action={
            <Link href="/records" className="tap text-[15px] text-accent">
              All family records
            </Link>
          }
        />
      ) : (
        <>
          <LargeTitle
            title="Family records"
            subtitle={`${docs.length} documents across the family`}
            action={
              claudeEnabled() && (
                <Link href="/claude" className="tap text-[15px] text-accent">
                  Claude{waiting ? ` · ${waiting}` : ""}
                </Link>
              )
            }
          />
          <div className="-mx-4 mb-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {members.map((m) => (
              <Link key={m.id} href={`/records?owner=${m.id}`} className="tap flex w-14 shrink-0 flex-col items-center gap-1">
                <Avatar name={m.name} size={46} />
                <span className="w-full truncate text-center text-[12px] text-ink2">{m.name.split(" ")[0]}</span>
              </Link>
            ))}
            <Link href="/records?owner=household" className="tap flex w-14 shrink-0 flex-col items-center gap-1">
              <HouseholdAvatar size={46} />
              <span className="w-full truncate text-center text-[12px] text-ink2">Household</span>
            </Link>
          </div>
        </>
      )}
      <form className="mb-3">
        {cat && <input type="hidden" name="cat" value={cat} />}
        {kind && <input type="hidden" name="kind" value={kind} />}
        {owner && <input type="hidden" name="owner" value={owner} />}
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search reports, bills, IDs, policies"
          className="h-10 w-full rounded-[10px] bg-card2 px-3 text-[17px] outline-none placeholder:text-ink2"
        />
      </form>
      {cats.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["", ...cats].map((c) => (
            <Link key={c} href={href({ cat: c, kind: "" })} replace className={chip(c === cat)}>
              {c ? CATEGORY_LABEL[c] : "All"}
            </Link>
          ))}
        </div>
      )}
      {kinds.length > 1 && (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {["", ...kinds].map((k) => (
            <Link key={k} href={href({ kind: k })} replace className={`${chip(k === kind)} text-[13px]`}>
              {k ? KIND_LABEL[k] : `All ${CATEGORY_LABEL[cat]?.toLowerCase()}`}
            </Link>
          ))}
        </div>
      )}
      {!shown.length && (
        <Empty
          title={theirs.length ? "Nothing matches" : "No records yet"}
          body={theirs.length ? "Try a different search." : "Tap + to add the first report, ID, bill or policy."}
        />
      )}
      {cat === "car" && <CarCards docs={shown} slots={!q && !kind} />}
      {cat !== "car" && [...months].map(([month, list]) => (
        <Section key={month} title={month}>
          {list.map((d) => (
            <DocRow key={d.id} doc={d} owner={d.member_id ? (names.get(d.member_id) ?? null) : null} />
          ))}
        </Section>
      ))}
    </Page>
  );
}

const SLOTS = ["rc", "motor_cover", "puc"]; // every car needs these; missing ones show an Add row
const ORDER = ["rc", "motor_cover", "puc", "fitness", "road_tax", "permit", "car_other"];
const daysLeft = (iso: string) => Math.round((Date.parse(iso) - Date.parse(istToday())) / 86_400_000);

function validity(iso: string | null) {
  if (!iso) return "No expiry date yet · tap to add it";
  const days = daysLeft(iso);
  const left = days < 0 ? `expired ${-days} day${days === -1 ? "" : "s"} ago` : days === 0 ? "ends today" : days <= 60 ? `${days} days left` : days < 730 ? `${Math.round(days / 30)} months left` : `${Math.round(days / 365)} years left`;
  return `Valid to ${fmtDate(iso)} · ${left}`;
}

/** One folder per car (a distinct registration number): RC, insurance and PUC always, with the details and days left. */
function CarCards({ docs, slots }: { docs: Awaited<ReturnType<typeof getDocs>>; slots: boolean }) {
  const cars = new Map<string, typeof docs>();
  for (const d of docs) {
    const plate = d.details.vehicle_no ?? "";
    if (!cars.has(plate)) cars.set(plate, []);
    cars.get(plate)!.push(d);
  }
  return (
    <>
      {[...cars]
        .sort(([a], [b]) => (a ? (b ? a.localeCompare(b) : -1) : 1))
        .map(([plate, list]) => {
          const model = list.find((d) => d.kind === "rc" && d.details.make_model)?.details.make_model ?? list.find((d) => d.details.make_model)?.details.make_model;
          const missing = plate && slots ? SLOTS.filter((k) => !list.some((d) => d.kind === k)) : [];
          // Newest paper of each type first; older copies stay listed below it.
          const sorted = [...list].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (b.expires_on ?? "").localeCompare(a.expires_on ?? ""));
          return (
            <Section
              key={plate || "unknown"}
              title={plate ? [plate.replace(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/, "$1 $2 $3 $4").replace(/\s+/g, " "), model].filter(Boolean).join(" · ") : "Car not known yet"}
              icon={CATEGORY_STYLE.car}
            >
              {sorted.map((d, i) => {
                const older = sorted.findIndex((o) => o.kind === d.kind) < i;
                const extra =
                  d.kind === "motor_cover"
                    ? [d.details.insurer, d.details.policy_no && `Policy ${d.details.policy_no}`, rupees(d.details.premium) && `Premium ${rupees(d.details.premium)}`, rupees(d.details.sum_insured) && `IDV ${rupees(d.details.sum_insured)}`]
                    : [];
                return (
                  <Row key={d.id} href={`/d/${d.id}`}>
                    <div className={`flex items-center justify-between gap-3 ${older ? "opacity-55" : ""}`}>
                      <div className="min-w-0">
                        <p className="truncate text-[17px]">
                          {KIND_LABEL[d.kind] ?? d.title}
                          {older && <span className="text-[13px] text-ink2"> · older copy</span>}
                        </p>
                        <p className="text-[13px] text-ink2">{validity(d.expires_on)}</p>
                        {extra.some(Boolean) && <p className="truncate text-[13px] text-ink2">{extra.filter(Boolean).join(" · ")}</p>}
                      </div>
                      {!older && <ExpiryChip doc={d} />}
                    </div>
                  </Row>
                );
              })}
              {missing.map((k) => (
                <Row key={k} href={`/upload?category=car&kind=${k}&vehicle=${plate}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] text-ink2">{KIND_LABEL[k]}</p>
                      <p className="text-[13px] text-ink3">Not added yet. You won&apos;t get a reminder until it is.</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-0.5 text-[13px] font-semibold text-accent">Add</span>
                  </div>
                </Row>
              ))}
            </Section>
          );
        })}
      {slots && (
        <Link href="/upload?category=car&kind=rc" className="tap mt-4 block px-1 text-[15px] text-accent">
          Add another car (start with its RC)
        </Link>
      )}
    </>
  );
}
