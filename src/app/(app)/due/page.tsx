import Link from "next/link";
import { DueRow } from "@/components/DueRow";
import { Avatar, Empty, HouseholdAvatar, LargeTitle, Page, Section } from "@/components/ui";
import { getDocs, getMembers } from "@/lib/data";
import { istToday, reminders } from "@/lib/reminders";

const GROUPS: { title: string; test: (days: number) => boolean; footer?: string }[] = [
  { title: "Expired", test: (d) => d < 0, footer: "Listed until a newer one is uploaded, or you open it and tap Not renewing." },
  { title: "Next 30 days", test: (d) => d >= 0 && d <= 30 },
  { title: "1 to 3 months", test: (d) => d > 30 && d <= 91 },
  { title: "3 to 12 months", test: (d) => d > 91 && d <= 366 },
  { title: "Later", test: (d) => d > 366 },
];

export default async function DuePage({ searchParams }: PageProps<"/due">) {
  const { who } = await searchParams;
  const [docs, members] = await Promise.all([getDocs(), getMembers()]);
  const picked = who === "household" || (typeof who === "string" && members.some((m) => m.id === who)) ? (who as string) : null;
  // Tests due live on each person's profile; this page is the vault's dates.
  const items = reminders(docs, members, [], istToday(), { all: true }).filter(
    (r) => r.type !== "test" && (!picked || (picked === "household" ? r.memberId === null : r.memberId === picked)),
  );
  const chip = (active: boolean) => (active ? "ring-2 ring-accent" : "");
  const label = (active: boolean) => `w-full truncate text-center text-[12px] ${active ? "font-semibold text-accent" : "text-ink2"}`;

  return (
    <Page>
      <LargeTitle title="Due dates" subtitle="Every expiry, renewal and payment in the vault" back={{ href: "/", label: "Family" }} />

      <div className="-mx-4 mb-1 flex gap-3 overflow-x-auto px-4 pb-1">
        <Link href="/due" replace className="tap flex w-14 shrink-0 flex-col items-center gap-1">
          <span className={`flex h-[46px] w-[46px] items-center justify-center rounded-full bg-card text-[13px] font-semibold ${chip(!picked)}`}>All</span>
          <span className={label(!picked)}>Everyone</span>
        </Link>
        {members.map((m) => (
          <Link key={m.id} href={`/due?who=${m.id}`} replace className="tap flex w-14 shrink-0 flex-col items-center gap-1">
            <span className={`rounded-full ${chip(m.id === picked)}`}>
              <Avatar name={m.name} size={46} />
            </span>
            <span className={label(m.id === picked)}>{m.name.split(" ")[0]}</span>
          </Link>
        ))}
        <Link href="/due?who=household" replace className="tap flex w-14 shrink-0 flex-col items-center gap-1">
          <span className={`rounded-full ${chip(picked === "household")}`}>
            <HouseholdAvatar size={46} />
          </span>
          <span className={label(picked === "household")}>Home & cars</span>
        </Link>
      </div>

      {!items.length && <Empty title="Nothing dated yet" body="Add an expiry date to an ID, policy or car paper, or a due date to an investment, and it shows up here." />}

      {GROUPS.map((g) => {
        const list = items.filter((r) => g.test(r.days));
        return list.length ? (
          <Section key={g.title} title={`${g.title} · ${list.length}`} footer={g.footer}>
            {list.map((r) => (
              <DueRow key={r.key} r={r} />
            ))}
          </Section>
        ) : null;
      })}
    </Page>
  );
}
