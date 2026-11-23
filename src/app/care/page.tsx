import Link from "next/link";
import { addReading, logout } from "@/app/actions";
import { ConfirmButton } from "@/components/client";
import { KIND_STYLE, PANEL_STYLE } from "@/components/theme";
import { Empty, Flag, fmtDate, fmtValue, IconTile, KIND_LABEL, LargeTitle, Page, Row, Section } from "@/components/ui";
import { fmtTime, getCare, nowIST, todayIST } from "@/lib/care";
import { marker } from "@/lib/markers";
import { deleteCareReading } from "./actions";

// Each group carries its own time, since BP, morning sugar and each meal are taken at different times.
const GROUPS: { id: string; title: string; keys: string[]; labels?: Record<string, string> }[] = [
  { id: "bp", title: "BP & pulse", keys: ["bp_systolic", "bp_diastolic", "heart_rate"] },
  { id: "morning", title: "Morning", keys: ["glucose_fasting"], labels: { glucose_fasting: "Fasting sugar" } },
  { id: "lunch", title: "Lunch", keys: ["glucose_lunch", "insulin_lunch"], labels: { glucose_lunch: "Sugar", insulin_lunch: "Insulin" } },
  { id: "dinner", title: "Dinner", keys: ["glucose_dinner", "insulin_dinner"], labels: { glucose_dinner: "Sugar", insulin_dinner: "Insulin" } },
];
const dayLabel = (day: string, today: string) =>
  day === today ? "Today" : fmtDate(`${day}T00:00:00`, { weekday: "short", day: "numeric", month: "short" });

export default async function CarePage({ searchParams }: PageProps<"/care">) {
  const { saved } = await searchParams;
  const memberId = process.env.HELPER_MEMBER_ID;
  if (!memberId)
    return (
      <Page>
        <LargeTitle title="Daily care" back={{ href: "/", label: "Family" }} />
        <Empty title="No one is set up for daily care" body="Set HELPER_MEMBER_ID and HELPER_PIN to turn this on." />
      </Page>
    );

  const { role, member, readings, docs } = await getCare(memberId);
  const today = todayIST();
  const now = nowIST();
  const first = member?.name.split(" ")[0] ?? "Daily";
  const days = [...new Set(readings.map((r) => r.taken_at))];
  return (
    <Page>
      <LargeTitle
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
        title={`${first}'s care`}
        subtitle="Readings, logged through the day"
        back={role === "family" ? { href: `/m/${memberId}`, label: first } : undefined}
        action={
          role === "helper" && (
            <form action={logout}>
              <button className="tap text-[17px] text-accent">Lock</button>
            </form>
          )
        }
      />

      {saved && <p className="card mt-2 rounded-2xl bg-good/14 px-4 py-3 text-[15px] font-semibold text-good">✓ Readings saved</p>}

      <form action={addReading}>
        <input type="hidden" name="member_id" value={memberId} />
        <input type="hidden" name="next" value="/care" />
        <Section
          title="Log readings"
          icon={PANEL_STYLE.Vitals}
          bare
        >
          <div className="card overflow-hidden rounded-2xl bg-card">
            <label className="flex min-h-11 items-center justify-between px-4 py-1">
              <span className="text-[17px]">Date</span>
              <input name="taken_at" type="date" defaultValue={today} max={today} required className="bg-transparent text-right text-accent outline-none" />
            </label>
          </div>
          {GROUPS.map((g) => (
            <div key={g.id}>
              <h3 className="mt-5 mb-2 flex items-center gap-2 px-1 text-[15px] font-semibold text-ink2 uppercase">{g.title}</h3>
              <div className="card overflow-hidden rounded-2xl bg-card">
                <label className="flex min-h-11 items-center justify-between border-b border-sep px-4 py-1">
                  <span className="text-[17px]">Time</span>
                  <input name={`time:${g.id}`} type="time" defaultValue={now} required className="bg-transparent text-right text-accent outline-none" />
                </label>
                {g.keys.map((k) => {
                  const m = marker(k)!;
                  return (
                    <label key={k} className="flex min-h-11 items-center gap-3 border-b border-sep py-1 pr-4 pl-4 last:border-0">
                      <input type="hidden" name={`group:${k}`} value={g.id} />
                      <span className="flex-1 text-[17px]">{g.labels?.[k] ?? m.short ?? m.name}</span>
                      <input name={`v:${k}`} type="number" inputMode="decimal" step="any" placeholder="—" className="w-24 bg-transparent text-right tabular-nums outline-none placeholder:text-ink3" />
                      <span className="w-14 text-[13px] text-ink2">{m.unit}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="mt-2 px-1 text-[13px] text-ink2">Fill only what you measured. Missed one earlier? Change the date and time to when it was taken.</p>
          <button className="tap mt-4 h-[50px] w-full rounded-2xl bg-accent text-[17px] font-semibold text-white">Save readings</button>
        </Section>
      </form>

      <Section
        title="Recent readings"
        icon={PANEL_STYLE["Heart & Lipids"]}
        bare
        action={
          <Link href="/care/trends" className="tap text-[15px] font-semibold text-accent">
            Trends ›
          </Link>
        }
      >
        {days.length ? (
          days.map((day) => (
            <div key={day} className="mb-4">
              <h3 className="mb-2 px-1 text-[15px] font-semibold text-ink2 uppercase">{dayLabel(day, today)}</h3>
              <div className="card overflow-hidden rounded-2xl bg-card">
                {readings
                  .filter((r) => r.taken_at === day)
                  .map((r) => (
                    <Row key={r.id}>
                      <div className="flex items-center gap-3">
                        <span className="w-[72px] shrink-0 text-[15px] text-ink2 tabular-nums">{r.taken_time ? fmtTime(r.taken_time) : "—"}</span>
                        <span className="min-w-0 flex-1 truncate text-[17px]">{marker(r.marker_key)?.short ?? r.marker_name}</span>
                        <span className="text-[17px] font-semibold tabular-nums">
                          {fmtValue(r.value)} <span className="text-[13px] font-normal text-ink2">{r.unit}</span>
                        </span>
                        {r.flag !== "normal" && <Flag flag={r.flag} />}
                        <ConfirmButton action={deleteCareReading.bind(null, memberId, r.id)} label="✕" confirmLabel="Delete?" className="text-[15px] text-ink3" />
                      </div>
                    </Row>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <div className="card rounded-2xl bg-card px-4 py-4 text-[15px] text-ink2">Nothing logged in the last 7 days.</div>
        )}
      </Section>

      <Section title="Reports & prescriptions" icon={KIND_STYLE.lab_report} footer="The family adds new reports from the main app.">
        {docs.length ? (
          docs.map((d) => (
            <a key={d.id} href={`/api/file?path=${encodeURIComponent(d.files[0] ?? "")}`} target="_blank" rel="noreferrer" className="tap block border-b border-sep last:border-0">
              <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                <IconTile style={KIND_STYLE[d.kind] ?? PANEL_STYLE.Other} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px]">{d.title}</p>
                  <p className="truncate text-[13px] text-ink2">{[KIND_LABEL[d.kind], d.doc_date && fmtDate(d.doc_date)].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
            </a>
          ))
        ) : (
          <p className="px-4 py-4 text-[15px] text-ink2">No reports yet.</p>
        )}
      </Section>
    </Page>
  );
}
