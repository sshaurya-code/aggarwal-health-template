"use client";

import { useState } from "react";

type Point = { value: number; date: string; flag: "low" | "high" | "normal" | null };

function scale(points: Point[], low: number | null, high: number | null) {
  const vals = points.map((p) => p.value);
  if (low != null) vals.push(low);
  if (high != null) vals.push(high);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}

const dotColor = (f: Point["flag"]) => (f === "high" || f === "low" ? "var(--bad)" : f === "normal" ? "var(--good)" : "var(--accent)");

export function Sparkline({ points, low, high, color = "var(--accent)", width = 72 }: { points: Point[]; low: number | null; high: number | null; color?: string; width?: number }) {
  const W = width;
  const H = 28;
  if (points.length < 2) return <div style={{ width: W }} />;
  const { min, max } = scale(points, low, high);
  const x = (i: number) => 3 + (i / (points.length - 1)) * (W - 6);
  const y = (v: number) => H - 3 - ((v - min) / (max - min)) * (H - 6);
  const last = points.at(-1)!;
  return (
    <svg width={W} height={H} aria-hidden className="shrink-0">
      {(low != null || high != null) && (
        <rect x={0} width={W} y={y(high ?? max)} height={Math.max(0, y(low ?? min) - y(high ?? max))} fill="var(--band)" />
      )}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r={3} fill={dotColor(last.flag)} stroke="var(--card)" strokeWidth={1.5} />
    </svg>
  );
}

export function TrendChart({
  points,
  low,
  high,
  unit,
  color = "var(--accent)",
  daily = false,
}: {
  points: Point[];
  low: number | null;
  high: number | null;
  unit: string;
  color?: string;
  /** Home readings taken several times a day: label by day and time instead of month. */
  daily?: boolean;
}) {
  const [sel, setSel] = useState(points.length - 1);
  const W = 343;
  const H = 200;
  const L = 36;
  const R = 12;
  const T = 44;
  const B = 24;
  const { min, max } = scale(points, low, high);
  // Spaced by date, so a gap of months looks like one.
  const times = points.map((q) => new Date(q.date).getTime());
  const t0 = times[0]!;
  const span = times.at(-1)! - t0;
  const x = (i: number) => (span === 0 ? (L + W - R) / 2 : L + ((times[i]! - t0) / span) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1];
  const p = points[sel]!;
  const half = daily ? 58 : 50;
  const tipX = Math.min(Math.max(x(sel), L + half), W - R - half);
  const fmt = (v: number) => (Math.abs(v) >= 100 && !daily ? Math.round(v) : Math.round(v * 10) / 10);
  const tipDate = (d: string) =>
    daily
      ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
      : new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  const axisDate = (d: string) => new Date(d).toLocaleDateString("en-IN", daily ? { day: "numeric", month: "short" } : { month: "short", year: "2-digit" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Trend of ${points.length} readings`}>
      {(low != null || high != null) && (
        <>
          <rect x={L} width={W - L - R} y={y(high ?? max)} height={Math.max(0, y(low ?? min) - y(high ?? max))} fill="var(--band)" />
          {high != null && <text x={W - R} y={y(high) - 3} textAnchor="end" fontSize={10} fill="var(--ink2)">ref {fmt(high)}</text>}
          {low != null && <text x={W - R} y={y(low) + 11} textAnchor="end" fontSize={10} fill="var(--ink2)">ref {fmt(low)}</text>}
        </>
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--sep)" strokeWidth={0.5} />
          <text x={L - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink2)">{fmt(t)}</text>
        </g>
      ))}
      <line x1={x(sel)} x2={x(sel)} y1={T - 4} y2={H - B} stroke="var(--ink3)" strokeWidth={1} />
      {points.length > 1 && (
        <polyline points={points.map((q, i) => `${x(i)},${y(q.value)}`).join(" ")} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((q, i) => (
        <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
          <circle cx={x(i)} cy={y(q.value)} r={16} fill="transparent" />
          <circle cx={x(i)} cy={y(q.value)} r={i === sel ? 5.5 : 4} fill={dotColor(q.flag)} stroke="var(--card)" strokeWidth={2} />
        </g>
      ))}
      <g transform={`translate(${tipX},6)`}>
        <rect x={-half} width={half * 2} height={32} rx={8} fill="var(--card2)" />
        <text y={14} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)">
          {fmt(p.value)} {unit}
        </text>
        <text y={27} textAnchor="middle" fontSize={10} fill="var(--ink2)">
          {tipDate(p.date)}
        </text>
      </g>
      <text x={span > 0 ? L : (L + W - R) / 2} y={H - 6} textAnchor={span > 0 ? "start" : "middle"} fontSize={10} fill="var(--ink2)">
        {axisDate(points[0]!.date)}
      </text>
      {span > 0 && (
        <text x={W - R} y={H - 6} textAnchor="end" fontSize={10} fill="var(--ink2)">
          {axisDate(points.at(-1)!.date)}
        </text>
      )}
    </svg>
  );
}
