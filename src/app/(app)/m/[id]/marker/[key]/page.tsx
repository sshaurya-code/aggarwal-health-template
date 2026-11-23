import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteReading } from "@/app/actions";
import { TrendChart } from "@/components/charts";
import { ActionButton } from "@/components/client";
import { PANEL_STYLE } from "@/components/theme";
import { Flag, fmtDate, fmtValue, IconTile, LargeTitle, Page, Row, Section } from "@/components/ui";
import { fmtTime } from "@/lib/care";
import { getMember, getReadings, markerName } from "@/lib/data";
import { marker } from "@/lib/markers";

export default async function MarkerPage({ params }: PageProps<"/m/[id]/marker/[key]">) {
  const { id, key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const [member, all] = await Promise.all([getMember(id), getReadings(id)]);
  const rows = all.filter((r) => r.marker_key === key);
  if (!member || !rows.length) notFound();

  const m = marker(key);
  const latest = rows.at(-1)!;
  const numeric = rows.filter((r) => r.value != null);
  const prev = numeric.at(-2);
  const change = prev && latest.value != null ? latest.value - prev.value! : null;
  const style = PANEL_STYLE[m?.panel ?? "Other"];

  return (
    <Page>
      <LargeTitle title={markerName(latest)} subtitle={member.name} back={{ href: `/m/${id}?tab=results`, label: "Results" }} />

      <div className="card rounded-2xl bg-card px-4 pt-4 pb-2">
        <div className="mb-2 flex items-center gap-1.5">
          <IconTile style={style} size={22} />
          <span className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: style.color }}>
            {m?.panel ?? "Other"}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-ink2">Latest · {fmtDate(latest.taken_at)}</p>
            <p className="text-[34px] leading-tight font-bold tabular-nums">
              {latest.value != null ? fmtValue(latest.value) : latest.value_text}
              <span className="ml-1 text-[17px] font-medium text-ink2">{latest.unit}</span>
            </p>
          </div>
          <div className="pb-2 text-right">
            <Flag flag={latest.flag} />
            {change != null && change !== 0 && (
              <p className="mt-1 text-[13px] text-ink2">
                {change > 0 ? "▲" : "▼"} {fmtValue(Math.abs(change))} since {fmtDate(prev!.taken_at, { month: "short", year: "2-digit" })}
              </p>
            )}
          </div>
        </div>
        {numeric.length > 0 && (
          <div className="mt-2">
            <TrendChart points={numeric.map((r) => ({ value: r.value!, date: r.taken_at, flag: r.flag }))} low={latest.ref_low} high={latest.ref_high} unit={latest.unit ?? ""} color={style.color} />
          </div>
        )}
      </div>
      <p className="mt-2 px-1 text-[13px] text-ink2">
        {latest.ref_low != null || latest.ref_high != null
          ? `Reference range ${latest.ref_low != null ? fmtValue(latest.ref_low) : "below"}${latest.ref_low != null && latest.ref_high != null ? "–" : " "}${latest.ref_high != null ? fmtValue(latest.ref_high) : "and above"} ${latest.unit ?? ""}, shaded green. Tap a point for its value.`
          : "No reference range on file for this test."}
        {m?.recheck && ` Usually rechecked every ${m.recheck[0]} months, or ${m.recheck[1]} if out of range.`}
      </p>

      <Section title="History">
        {[...rows].reverse().map((r) => (
          <Row key={r.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[17px] tabular-nums">
                  {r.value != null ? fmtValue(r.value) : r.value_text} <span className="text-[13px] text-ink2">{r.unit}</span>
                </p>
                <p className="text-[13px] text-ink2">
                  {fmtDate(r.taken_at)}
                  {r.taken_time && `, ${fmtTime(r.taken_time)}`} ·{" "}
                  {r.document_id ? (
                    <Link href={`/d/${r.document_id}`} className="text-accent">
                      View report
                    </Link>
                  ) : (
                    "Logged at home"
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Flag flag={r.flag} />
                <ActionButton action={deleteReading.bind(null, r.id)} className="text-[13px] text-ink2">
                  Delete
                </ActionButton>
              </div>
            </div>
          </Row>
        ))}
      </Section>
    </Page>
  );
}
