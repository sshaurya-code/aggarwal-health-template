import Link from "next/link";
import { DuePill, DueRow } from "@/components/DueRow";
import { CATEGORY_STYLE } from "@/components/theme";
import { Avatar, Empty, IconTile, KIND_LABEL, LargeTitle, Page, Row, Section } from "@/components/ui";
import { ExpiryChip, paymentLine } from "@/components/VaultDetails";
import { getDocs, getMembers } from "@/lib/data";
import { istToday, nextDue, reminders } from "@/lib/reminders";

const daysUntil = (iso: string) => Math.round((Date.parse(iso) - Date.parse(istToday())) / 86_400_000);

export default async function InvestmentsPage({ searchParams }: PageProps<"/investments">) {
  const { member } = await searchParams;
  const [docs, members] = await Promise.all([getDocs(), getMembers()]);
  const picked = typeof member === "string" && members.some((m) => m.id === member) ? member : null;
  const all = docs.filter((d) => d.category === "investment");
  const shown = all.filter((d) => !picked || d.member_id === picked);
  const soon = reminders(shown, members, [], istToday(), { all: true }).filter((r) => (r.type === "investment" || r.type === "maturity") && r.days <= 30);
  const people = members.filter((m) => (!picked || m.id === picked) && shown.some((d) => d.member_id === m.id));
  const add = `/upload?category=investment${picked ? `&member=${picked}` : ""}`;

  return (
    <Page>
      <LargeTitle
        title="Investments"
        subtitle={`${all.length} across the family · life cover, SIPs, deposits`}
        action={
          <Link href={add} aria-label="Add an investment" className="tap flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        }
      />

      <div className="-mx-4 mb-1 flex gap-3 overflow-x-auto px-4 pb-1">
        <Link href="/investments" replace className="tap flex w-14 shrink-0 flex-col items-center gap-1">
          <span className={`flex h-[46px] w-[46px] items-center justify-center rounded-full bg-card text-[13px] font-semibold ${!picked ? "ring-2 ring-accent" : ""}`}>All</span>
          <span className={`w-full truncate text-center text-[12px] ${!picked ? "font-semibold text-accent" : "text-ink2"}`}>Family</span>
        </Link>
        {members.map((m) => (
          <Link key={m.id} href={`/investments?member=${m.id}`} replace className="tap flex w-14 shrink-0 flex-col items-center gap-1">
            <span className={`rounded-full ${m.id === picked ? "ring-2 ring-accent" : ""}`}>
              <Avatar name={m.name} size={46} />
            </span>
            <span className={`w-full truncate text-center text-[12px] ${m.id === picked ? "font-semibold text-accent" : "text-ink2"}`}>{m.name.split(" ")[0]}</span>
          </Link>
        ))}
      </div>

      {!shown.length && (
        <Empty
          title={picked ? "Nothing for them yet" : "No investments yet"}
          body="Upload the policy, SIP statement or FD receipt. Then set the amount, how often it's paid and a due date, and you'll get a reminder before every payment."
          action={
            <Link href={add} className="tap inline-block rounded-2xl bg-accent px-5 py-3 text-[17px] font-semibold text-white">
              Add an investment
            </Link>
          }
        />
      )}

      {soon.length > 0 && (
        <Section title="Due in the next 30 days">
          {soon.map((r) => (
            <DueRow key={r.key} r={r} />
          ))}
        </Section>
      )}

      {people.map((m) => (
        <Section key={m.id} title={m.name.split(" ")[0]} action={<Link href={`/upload?category=investment&member=${m.id}`} className="tap text-[15px] text-accent">Add</Link>}>
          {shown
            .filter((d) => d.member_id === m.id)
            .map((d) => ({ d, next: nextDue(d) }))
            .sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999"))
            .map(({ d, next }) => (
              <Row key={d.id} href={`/d/${d.id}`}>
                <div className="flex items-center gap-3">
                  <IconTile style={CATEGORY_STYLE.investment!} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px]">{d.title}</p>
                    <p className="truncate text-[13px] text-ink2">
                      {[KIND_LABEL[d.kind], d.details.insurer, paymentLine(d) ?? (d.details.due_on ? null : "Set a due date for reminders")].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {next ? <DuePill days={daysUntil(next)} /> : <ExpiryChip doc={d} />}
                </div>
              </Row>
            ))}
        </Section>
      ))}
    </Page>
  );
}
