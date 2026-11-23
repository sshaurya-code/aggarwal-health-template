import Link from "next/link";
import { TrendChart } from "@/components/charts";
import { ShareButton } from "@/components/client";
import { PANEL_STYLE } from "@/components/theme";
import { Empty, fmtDate, fmtValue, LargeTitle, Page, Section } from "@/components/ui";
import { fmtTime, getTrends, todayIST } from "@/lib/care";
import type { Reading } from "@/lib/data";
import { marker } from "@/lib/markers";

const RANGES = [7, 14, 30, 90];
// Any-time sugar is no longer logged, but older readings still show.
const CHARTS = ["bp_systolic", "bp_diastolic", "heart_rate", "glucose_fasting", "glucose_lunch", "glucose_dinner", "glucose_random", "insulin_lunch", "insulin_dinner"];
const SUFFIX: Record<string, string> = { glucose_fasting: "F", glucose_lunch: "L", glucose_dinner: "D", glucose_random: "", insulin_lunch: "L", insulin_dinner: "D" };
const COLUMNS: { label: string; keys: string[] }[] = [
  { label: "BP", keys: ["bp_systolic", "bp_diastolic"] },
  { label: "Pulse", keys: ["heart_rate"] },
  { label: "Sugar", keys: ["glucose_fasting", "glucose_lunch", "glucose_dinner", "glucose_random"] },
  { label: "Insulin u", keys: ["insulin_lunch", "insulin_dinner"] },
];

const when = (r: Reading) => `${r.taken_at}T${(r.taken_time ?? "12:00").slice(0, 5)}`;
const bad = (r?: Reading) => r && (r.flag === "high" || r.flag === "low");

function Cell({ rows, keys }: { rows: Reading[]; keys: string[] }) {
  const found = keys.map((k) => rows.find((r) => r.marker_key === k));
  if (!found.some(Boolean)) return <td className="px-2.5 py-2 text-ink3">—</td>;
  if (keys[0] === "bp_systolic") {
    const [sys, dia] = found;
    return (
      <td className="px-2.5 py-2 tabular-nums">
        <span className={bad(sys) ? "font-semibold text-bad" : ""}>{sys ? fmtValue(sys.value) : "—"}</span>/
        <span className={bad(dia) ? "font-semibold text-bad" : ""}>{dia ? fmtValue(dia.value) : "—"}</span>
      </td>
    );
  }
  return (
    <td className="px-2.5 py-2 tabular-nums">
      {found.filter((r): r is Reading => !!r).map((r) => (
        <span key={r.id} className={`block ${bad(r) ? "font-semibold text-bad" : ""}`}>
          {fmtValue(r.value)}
          {SUFFIX[r.marker_key] && <span className="ml-0.5 text-[11px] font-normal text-ink2">{SUFFIX[r.marker_key]}</span>}
        </span>
      ))}
    </td>
  );
}

export default async function TrendsPage({ searchParams }: PageProps<"/care/trends">) {
  const memberId = process.env.HELPER_MEMBER_ID;
  if (!memberId) return null;
  const asked = Number((await searchParams).days);
  const days = RANGES.includes(asked) ? asked : 14;
  const { name, readings } = await getTrends(memberId, days);
  const today = todayIST();
  const first = name.split(" ")[0] || "Daily";

  const byKey = new Map<string, Reading[]>();
  for (const r of readings) if (r.value != null) byKey.set(r.marker_key, [...(byKey.get(r.marker_key) ?? []), r]);
  const charts = CHARTS.filter((k) => (byKey.get(k)?.length ?? 0) >= 2);

  // The sheet: newest day first, one row per time a set of readings was taken.
  const dayList = [...new Set(readings.map((r) => r.taken_at))].sort().reverse();
  const timesOf = (day: string) => {
    const at = new Map<string, Reading[]>();
    for (const r of readings.filter((r) => r.taken_at === day)) {
      const t = r.taken_time?.slice(0, 5) ?? "";
      at.set(t, [...(at.get(t) ?? []), r]);
    }
    return [...at].sort(([a], [b]) => b.localeCompare(a));
  };

  return (
    <Page>
      <LargeTitle eyebrow={`${first}'s care`} title="Trends" subtitle="Home readings, day by day" back={{ href: "/care", label: "Care" }} />

      <div className="flex gap-2">
        {RANGES.map((d) => (
          <Link key={d} href={`/care/trends?days=${d}`} replace className={`tap rounded-full px-3.5 py-1.5 text-[15px] ${d === days ? "bg-accent text-white" : "bg-card text-ink"}`}>
            {d} days
          </Link>
        ))}
      </div>

      {readings.length > 0 && (
        <div className="card mt-4 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">For the doctor</p>
            <p className="text-[13px] text-ink2">PDF of the last {days} days: summary and every reading</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <a href={`/care/report?days=${days}`} target="_blank" className="tap text-[17px] text-accent">
              Open
            </a>
            <ShareButton key={days} url={`/care/report?days=${days}`} title={`${name} readings, last ${days} days`} label="Share" />
          </div>
        </div>
      )}

      {readings.length < 2 ? (
        <Empty title="Not enough data yet" body={`Trends appear once a few readings have been logged. Nothing in the last ${days} days so far.`} />
      ) : (
        <>
          {charts.map((k) => {
            const m = marker(k)!;
            const pts = byKey.get(k)!;
            const last = pts.at(-1)!;
            return (
              <Section key={k} title={m.name} icon={PANEL_STYLE[m.panel] ?? PANEL_STYLE.Vitals} action={<span className="text-[15px] text-ink2 tabular-nums">{pts.length} readings</span>}>
                <div className="px-2 pt-2 pb-1">
                  <TrendChart daily points={pts.map((r) => ({ value: r.value!, date: when(r), flag: r.flag }))} low={last.ref_low} high={last.ref_high} unit={m.unit} />
                </div>
              </Section>
            );
          })}

          <Section title="Sheet" icon={PANEL_STYLE.Other} footer="Red values are outside the normal range. F fasting, L lunch, D dinner.">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px] whitespace-nowrap">
                <thead>
                  <tr className="border-b border-sep text-[12px] font-semibold text-ink2 uppercase">
                    <th className="sticky left-0 bg-card px-3 py-2">Time</th>
                    {COLUMNS.map((c) => (
                      <th key={c.label} className="px-2.5 py-2">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayList.map((day) => {
                    const rows = timesOf(day);
                    return [
                      <tr key={day} className="bg-card2/60">
                        <td colSpan={COLUMNS.length + 1} className="px-3 py-1.5 text-[13px] font-semibold">
                          <span className="sticky left-3">
                            {day === today ? "Today" : fmtDate(`${day}T00:00:00`, { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                        </td>
                      </tr>,
                      ...(rows.length
                        ? rows.map(([t, rs]) => (
                            <tr key={`${day}${t}`} className="border-b border-sep last:border-0">
                              <td className="sticky left-0 bg-card px-3 py-2 text-ink2 tabular-nums">{t ? fmtTime(t) : "—"}</td>
                              {COLUMNS.map((c) => (
                                <Cell key={c.label} rows={rs} keys={c.keys} />
                              ))}
                            </tr>
                          ))
                        : [
                            <tr key={`${day}-none`} className="border-b border-sep">
                              <td colSpan={COLUMNS.length + 1} className="px-3 py-2 text-[13px] text-ink3">
                                No readings
                              </td>
                            </tr>,
                          ]),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}
