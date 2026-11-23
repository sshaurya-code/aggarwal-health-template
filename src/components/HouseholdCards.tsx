import Link from "next/link";
import type { Member } from "@/lib/data";
import type { Unit } from "@/lib/family";
import type { Reminder } from "@/lib/reminders";
import { personColors } from "./theme";
import { Avatar } from "./ui";

export type CareSummary = { memberId: string; temp: string | null };
type Status = { flags: number; due: number };

const ELDERS = ["#c8a27a", "#8e6e53"]; // the house photo's warm brown

function Chip({ children, tone = "plain", href }: { children: React.ReactNode; tone?: "plain" | "alert"; href?: string }) {
  const cls = `rounded-[10px] px-2.5 py-1 text-[13px] font-semibold ${tone === "alert" ? "bg-white text-[#ff3b30]" : "bg-white/22"}`;
  return href ? (
    <Link href={href} className={`tap ${cls}`}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

function Card({ title, subtitle, people, colors, chips }: { title: string; subtitle: string; people: Member[]; colors: string[]; chips: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-[22px] p-4 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}>
      <h2 className="text-[22px] leading-tight font-bold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-[13px] opacity-90">{subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
        {people.map((m) => (
          <Link key={m.id} href={`/m/${m.id}`} className="tap flex w-[58px] flex-col items-center gap-1">
            <Avatar name={m.name} size={48} ring />
            <span className="w-full truncate text-center text-[12px] font-semibold">{m.name.split(" ")[0]}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{chips}</div>
    </section>
  );
}

export function HouseholdCards({
  units,
  others,
  status,
  coming,
  care,
}: {
  units: Unit[];
  others: Member[];
  status: Map<string, Status>;
  coming: Reminder[];
  care: CareSummary | null;
}) {
  const chipsFor = (people: Member[]) => {
    const ids = new Set(people.map((m) => m.id));
    const flags = people.reduce((n, m) => n + (status.get(m.id)?.flags ?? 0), 0);
    const due = people.reduce((n, m) => n + (status.get(m.id)?.due ?? 0), 0);
    const next = coming.find((r) => r.memberId && ids.has(r.memberId));
    const mine = care && ids.has(care.memberId) ? care : null;
    const chips: React.ReactNode[] = [];
    if (mine) {
      const first = people.find((m) => m.id === mine.memberId)!.name.split(" ")[0];
      chips.push(
        <Chip key="care" href="/care">
          {`${first}'s care`}
        </Chip>,
      );
      if (mine.temp) chips.push(<Chip key="temp" href="/care">{mine.temp}</Chip>);
    }
    if (flags) chips.push(<Chip key="f" tone="alert">{flags} to watch</Chip>);
    if (due) chips.push(<Chip key="d">{due} test{due === 1 ? "" : "s"} due</Chip>);
    if (next) chips.push(<Chip key="n" href={next.href}>{`${next.title} · ${next.days < 0 ? "overdue" : next.days === 0 ? "today" : `${next.days}d`}`}</Chip>);
    if (!chips.length) chips.push(<Chip key="ok">All clear</Chip>);
    return chips;
  };

  return (
    <>
      {units.map((u) => {
        const people = [...u.heads, ...u.children];
        const colors = u.elders ? ELDERS : [...personColors(u.heads[0]!.name)].reverse();
        return (
          <Card
            key={u.key}
            title={u.title}
            subtitle={u.elders ? "Elders" : people.map((m) => m.name.split(" ")[0]).join(" · ")}
            people={people}
            colors={colors}
            chips={chipsFor(people)}
          />
        );
      })}
      {others.length > 0 && <Card title="Others" subtitle="Not linked to a branch yet. Tap Edit on a profile to link them." people={others} colors={["#aeaeb2", "#8e8e93"]} chips={chipsFor(others)} />}
    </>
  );
}
