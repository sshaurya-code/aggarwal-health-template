import Link from "next/link";
import { notFound } from "next/navigation";
import { setMedicationActive } from "@/app/actions";
import { Sparkline } from "@/components/charts";
import { ActionButton } from "@/components/client";
import { DocRow } from "@/components/DocRow";
import { CATEGORY_STYLE, KIND_STYLE, PANEL_SHORT, PANEL_STYLE, personColors } from "@/components/theme";
import { Avatar, CATEGORY_LABEL, Empty, Flag, fmtDate, fmtValue, IconTile, Page, Row, Section } from "@/components/ui";
import { age, byMarker, dueTests, flagged, getDocs, getMedications, getMember, getReadings, markerName, type Reading } from "@/lib/data";
import { marker, PANELS, type Panel } from "@/lib/markers";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "results", label: "Results" },
  { key: "docs", label: "Documents" },
];

export default async function MemberPage({ params, searchParams }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const tab = String((await searchParams).tab ?? "overview");
  const member = await getMember(id);
  if (!member) notFound();
  const [readings, docs, meds] = await Promise.all([getReadings(id), getDocs(id), getMedications(id)]);
  const grouped = byMarker(readings);

  return (
    <Page>
      <Hero member={member} />
      {id === process.env.HELPER_MEMBER_ID && (
        <Link href="/care" className="tap card mt-4 flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-[17px] font-semibold text-accent">
          Daily care: medicines and readings
          <span aria-hidden>›</span>
        </Link>
      )}
      <nav className="mt-4 flex rounded-[10px] bg-card2 p-0.5 text-[13px] font-semibold">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/m/${id}?tab=${t.key}`}
            replace
            className={`flex-1 rounded-[8px] py-1.5 text-center ${tab === t.key ? "bg-card shadow-sm" : "text-ink2"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview member={member} readings={readings} grouped={grouped} meds={meds} />}
      {tab === "results" && <Results id={id} grouped={grouped} />}
      {tab === "docs" && <Docs id={id} name={member.name} docs={docs} />}
    </Page>
  );
}

function Overview({
  member,
  readings,
  grouped,
  meds,
}: {
  member: NonNullable<Awaited<ReturnType<typeof getMember>>>;
  readings: Reading[];
  grouped: Map<string, Reading[]>;
  meds: Awaited<ReturnType<typeof getMedications>>;
}) {
  const weight = grouped.get("weight")?.at(-1)?.value ?? null;
  const bmi = weight && member.height_cm ? weight / (member.height_cm / 100) ** 2 : null;
  const flags = flagged(readings);
  const due = dueTests(readings, member.sex);
  const active = meds.filter((m) => m.active);

  // Every out-of-range marker first, then the latest test from each remaining health area.
  const latest = [...grouped.values()].map((rows) => rows.at(-1)!).sort((a, b) => b.taken_at.localeCompare(a.taken_at));
  const panelOf = (r: Reading) => marker(r.marker_key)?.panel ?? "Other";
  const highlights = [...flags];
  for (const r of latest) if (!highlights.some((h) => panelOf(h) === panelOf(r))) highlights.push(r);

  return (
    <>
      {highlights.length > 0 && (
        <Section
          title="Highlights"
          bare
          action={
            <Link href={`/m/${member.id}?tab=results`} replace className="tap text-[15px] text-accent">
              All results
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2.5">
            {highlights.slice(0, 8).map((r) => (
              <HighlightTile key={r.id} memberId={member.id} rows={grouped.get(r.marker_key)!} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Medical ID" icon={{ color: "#ff3b30", icon: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" }}>
        <div className="grid grid-cols-3 divide-x divide-sep py-3.5 text-center">
          <Stat label="Blood" value={member.blood_group ?? "—"} />
          <Stat label="Age" value={age(member.dob)?.toString() ?? "—"} />
          <Stat label={bmi ? "BMI" : "Height"} value={bmi ? bmi.toFixed(1) : member.height_cm ? `${member.height_cm} cm` : "—"} />
        </div>
        <div className="space-y-2 border-t border-sep px-4 py-3 text-[15px]">
          <p>
            <span className="block text-[12px] font-semibold text-ink2 uppercase">Conditions</span>
            {member.conditions.join(", ") || "None recorded"}
          </p>
          <p>
            <span className="block text-[12px] font-semibold text-ink2 uppercase">Allergies</span>
            <span className={member.allergies.length ? "font-semibold text-bad" : ""}>{member.allergies.join(", ") || "None recorded"}</span>
          </p>
          {active.length > 0 && (
            <p>
              <span className="block text-[12px] font-semibold text-ink2 uppercase">Medications</span>
              {active.map((m) => m.name).join(", ")}
            </p>
          )}
          {member.notes && <p className="text-ink2">{member.notes}</p>}
        </div>
      </Section>

      {due.length > 0 && (
        <Section title="Tests due" icon={{ color: "#ff9500", icon: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z" }} footer="Based on the last result: flagged values are rechecked sooner.">
          {due.map((d) => (
            <Row key={d.key} href={d.last ? `/m/${member.id}/marker/${d.key}` : undefined}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[17px]">{d.name}</p>
                  <p className="text-[13px] text-ink2">{d.last ? `Last tested ${fmtDate(d.last)}` : "Never tested — part of a baseline checkup"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold ${d.overdue ? "bg-warn/15 text-warn" : "bg-card2 text-ink2"}`}>
                  {d.last ? (d.overdue ? "Overdue" : `Due ${fmtDate(d.dueOn, { month: "short" })}`) : "Baseline"}
                </span>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {meds.length > 0 && (
      <Section title="Medications" icon={KIND_STYLE.prescription} footer="Tap Stop when a course ends.">
        {[...active, ...meds.filter((m) => !m.active)].map((m) => (
          <Row key={m.id}>
            <div className={`flex items-center justify-between gap-3 ${m.active ? "" : "opacity-45"}`}>
              <div className="min-w-0">
                <p className="truncate text-[17px]">{m.name}</p>
                <p className="truncate text-[13px] text-ink2">{[m.dose, m.frequency, m.started_on && `since ${fmtDate(m.started_on)}`].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <ActionButton action={setMedicationActive.bind(null, m.id, !m.active)} className="shrink-0 text-[15px] text-accent">
                {m.active ? "Stop" : "Resume"}
              </ActionButton>
            </div>
          </Row>
        ))}
      </Section>
      )}

      {readings.length === 0 && (
        <Empty
          title="No results yet"
          body="Home readings you log (sugar, BP, weight) are charted here. Reports are kept under Documents."
          action={
            <Link href={`/upload?member=${member.id}`} className="tap inline-block rounded-2xl bg-accent px-5 py-3 text-[17px] font-semibold text-white">
              Upload a report
            </Link>
          }
        />
      )}
    </>
  );
}

function Results({ id, grouped }: { id: string; grouped: Map<string, Reading[]> }) {
  if (!grouped.size) return <Empty title="No results yet" body="Readings you log appear here, grouped by panel." />;
  const panels = [...PANELS, "Other" as const].map((p) => ({
    panel: p,
    keys: [...grouped.keys()].filter((k) => (marker(k)?.panel ?? "Other") === p),
  }));
  return (
    <>
      {panels
        .filter((p) => p.keys.length)
        .map((p) => (
          <Section key={p.panel} title={p.panel} icon={PANEL_STYLE[p.panel]}>
            {p.keys.map((k) => (
              <MarkerRow key={k} memberId={id} rows={grouped.get(k)!} />
            ))}
          </Section>
        ))}
    </>
  );
}

function MarkerRow({ memberId, rows }: { memberId: string; rows: Reading[] }) {
  const latest = rows.at(-1)!;
  const numeric = rows.filter((r) => r.value != null);
  return (
    <Row href={`/m/${memberId}/marker/${encodeURIComponent(latest.marker_key)}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px]">{marker(latest.marker_key)?.short ?? markerName(latest)}</p>
          <p className="text-[13px] text-ink2">
            {fmtDate(latest.taken_at)}
            {rows.length > 1 && ` · ${rows.length} readings`}
          </p>
        </div>
        <Sparkline
          points={numeric.map((r) => ({ value: r.value!, date: r.taken_at, flag: r.flag }))}
          low={latest.ref_low}
          high={latest.ref_high}
          color={PANEL_STYLE[marker(latest.marker_key)?.panel ?? "Other"].color}
        />
        <div className="w-[84px] shrink-0 text-right">
          <p className="text-[17px] font-semibold tabular-nums">
            {latest.value != null ? fmtValue(latest.value) : latest.value_text}
            <span className="ml-0.5 text-[11px] font-normal text-ink2">{latest.unit}</span>
          </p>
          <Flag flag={latest.flag} />
        </div>
      </div>
    </Row>
  );
}

function Docs({ id, name, docs }: { id: string; name: string; docs: Awaited<ReturnType<typeof getDocs>> }) {
  if (!docs.length)
    return (
      <Empty
        title="No documents"
        body="Reports, prescriptions, IDs, bills and policies are filed here."
        action={
          <Link href={`/upload?member=${id}`} className="tap inline-block rounded-2xl bg-accent px-5 py-3 text-[17px] font-semibold text-white">
            Upload
          </Link>
        }
      />
    );
  const vault = (["id", "insurance", "investment", "bill", "other"] as const).map((c) => ({ c, list: docs.filter((d) => d.category === c) })).filter((g) => g.list.length);
  const years = new Map<string, typeof docs>();
  for (const d of docs.filter((d) => d.category === "health")) {
    const y = (d.doc_date ?? d.created_at).slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y)!.push(d);
  }
  return (
    <>
      {vault.map(({ c, list }) => (
        <Section key={c} title={CATEGORY_LABEL[c]} icon={CATEGORY_STYLE[c]}>
          {list.map((d) => (
            <DocRow key={d.id} doc={d} owner={name} />
          ))}
        </Section>
      ))}
      {[...years].map(([year, list]) => (
        <Section key={year} title={vault.length ? `Health · ${year}` : year}>
          {list.map((d) => (
            <DocRow key={d.id} doc={d} owner={name} />
          ))}
        </Section>
      ))}
    </>
  );
}

function Hero({ member }: { member: NonNullable<Awaited<ReturnType<typeof getMember>>> }) {
  const [from, to] = personColors(member.name);
  const facts = [member.relation, age(member.dob) != null && `${age(member.dob)} yrs`, member.sex && (member.sex === "male" ? "Male" : "Female"), member.blood_group].filter(Boolean);
  return (
    <header
      className="-mx-4 rounded-b-[28px] px-5 pb-6 text-white [margin-top:calc(-1*env(safe-area-inset-top))] [padding-top:calc(env(safe-area-inset-top)+12px)]"
      style={{ background: `linear-gradient(150deg, ${to} 0%, ${from} 70%)` }}
    >
      <div className="flex h-9 items-center justify-between text-[17px] font-medium">
        <Link href="/" className="tap -ml-1 flex items-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Family
        </Link>
        <Link href={`/m/${member.id}/edit`} className="tap rounded-full bg-white/20 px-3 py-1 text-[15px] font-semibold">
          Edit
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Avatar name={member.name} size={68} ring />
        <div className="min-w-0">
          <h1 className="truncate text-[30px] leading-tight font-bold tracking-tight">{member.name}</h1>
          <p className="mt-0.5 truncate text-[15px] opacity-90">{facts.join(" · ") || "Tap Edit to complete the profile"}</p>
        </div>
      </div>
    </header>
  );
}

function HighlightTile({ memberId, rows }: { memberId: string; rows: Reading[] }) {
  const latest = rows.at(-1)!;
  const m = marker(latest.marker_key);
  const style = PANEL_STYLE[(m?.panel ?? "Other") as Panel | "Other"];
  const numeric = rows.filter((r) => r.value != null);
  return (
    <Link href={`/m/${memberId}/marker/${encodeURIComponent(latest.marker_key)}`} className="tap card flex flex-col rounded-2xl bg-card p-3">
      <div className="flex items-center gap-1.5">
        <IconTile style={style} size={20} />
        <span className="truncate text-[12px] font-semibold tracking-wide uppercase" style={{ color: style.color }}>
          {PANEL_SHORT[m?.panel ?? "Other"] ?? m?.panel ?? "Other"}
        </span>
      </div>
      <p className="mt-2 truncate text-[13px] text-ink2">{m?.short ?? markerName(latest)}</p>
      <p className="text-[26px] leading-tight font-bold tabular-nums">
        {latest.value != null ? fmtValue(latest.value) : latest.value_text}
        <span className="ml-1 text-[12px] font-medium text-ink2">{latest.unit}</span>
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        {numeric.length > 1 ? (
          <Sparkline points={numeric.map((r) => ({ value: r.value!, date: r.taken_at, flag: r.flag }))} low={latest.ref_low} high={latest.ref_high} color={style.color} width={64} />
        ) : (
          <span className="text-[11px] text-ink2">{fmtDate(latest.taken_at, { day: "numeric", month: "short", year: "2-digit" })}</span>
        )}
        <Flag flag={latest.flag} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-ink2 uppercase">{label}</p>
      <p className="mt-0.5 text-[24px] font-bold">{value}</p>
    </div>
  );
}
