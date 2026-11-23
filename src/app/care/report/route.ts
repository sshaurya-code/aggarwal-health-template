import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { getTrends, todayIST } from "@/lib/care";
import type { Reading } from "@/lib/data";
import { defaultRange, marker } from "@/lib/markers";

// A printable sheet of the cared-for person's home readings, for showing a doctor.

const RANGES = [7, 14, 30, 90];
const A4 = { w: 595.28, h: 841.89 };
const M = 40; // page margin
const INK = rgb(0.1, 0.1, 0.12);
const GREY = rgb(0.45, 0.45, 0.5);
const RED = rgb(0.78, 0.1, 0.1);
const LINE = rgb(0.85, 0.85, 0.88);
const BAND = rgb(0.95, 0.95, 0.97);

const SUMMARY: { key: string; label: string }[] = [
  { key: "bp_systolic", label: "BP systolic" },
  { key: "bp_diastolic", label: "BP diastolic" },
  { key: "heart_rate", label: "Pulse" },
  { key: "glucose_fasting", label: "Sugar, fasting" },
  { key: "glucose_lunch", label: "Sugar, lunch" },
  { key: "glucose_dinner", label: "Sugar, dinner" },
  { key: "glucose_random", label: "Sugar, random" },
  { key: "insulin_lunch", label: "Insulin, lunch" },
  { key: "insulin_dinner", label: "Insulin, dinner" },
  { key: "temperature", label: "Temperature" },
];
const SUFFIX: Record<string, string> = { glucose_fasting: "F", glucose_lunch: "L", glucose_dinner: "D", glucose_random: "R", insulin_lunch: "L", insulin_dinner: "D" };

const num = (v: number, dp = 0) => v.toLocaleString("en-IN", { maximumFractionDigits: dp });
const bad = (r?: Reading) => Boolean(r && (r.flag === "high" || r.flag === "low"));
const day = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
const time = (hm: string) => new Date(`2000-01-01T${hm.slice(0, 5)}:00Z`).toLocaleTimeString("en-IN", { timeZone: "UTC", hour: "numeric", minute: "2-digit", hour12: true });

type Piece = { text: string; bad?: boolean };

export async function GET(req: Request) {
  const memberId = process.env.HELPER_MEMBER_ID;
  if (!memberId) return new Response("No one is set up for daily care", { status: 404 });
  const asked = Number(new URL(req.url).searchParams.get("days"));
  const days = RANGES.includes(asked) ? asked : 30;
  let data;
  try {
    data = await getTrends(memberId, days);
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const readings = data.readings.filter((r) => r.value != null);
  const today = todayIST();
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 864e5).toISOString().slice(0, 10);
  const period = `${day(from, { day: "numeric", month: "short" })} – ${day(today, { day: "numeric", month: "short", year: "numeric" })}`;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${data.name}: home readings, ${period}`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const text = (s: string, x: number, size: number, f: PDFFont = font, color = INK) => page.drawText(s, { x, y, size, font: f, color });
  const rule = (at = y) => page.drawLine({ start: { x: M, y: at }, end: { x: A4.w - M, y: at }, thickness: 0.6, color: LINE });
  /** Values side by side, out-of-range ones in red with a star so they still stand out in black and white. */
  const pieces = (list: Piece[], x: number, size: number, sep = ", ") => {
    let at = x;
    list.forEach((p, i) => {
      const s = `${p.text}${p.bad ? "*" : ""}${i < list.length - 1 ? sep : ""}`;
      page.drawText(s, { x: at, y, size, font: p.bad ? bold : font, color: p.bad ? RED : INK });
      at += (p.bad ? bold : font).widthOfTextAtSize(s, size);
    });
  };

  // Header
  text(data.name || "Home readings", M, 20, bold);
  y -= 22;
  text(`Home readings · ${period} (${days} days)`, M, 12, font, GREY);
  y -= 15;
  text(`Logged at home by her carer. Prepared ${day(today, { day: "numeric", month: "long", year: "numeric" })}.`, M, 9, font, GREY);
  y -= 26;

  if (!readings.length) {
    text(`No readings were logged in the last ${days} days.`, M, 12);
  } else {
    // Summary
    text("Summary", M, 13, bold);
    y -= 18;
    const sCols = [M, M + 120, M + 185, M + 245, M + 300, M + 355, M + 430];
    const sHead = ["Measure", "Readings", "Average", "Lowest", "Highest", "Normal range", "Outside range"];
    page.drawRectangle({ x: M, y: y - 5, width: A4.w - 2 * M, height: 17, color: BAND });
    sHead.forEach((h, i) => text(h, sCols[i]! + 4, 8.5, bold, GREY));
    y -= 18;
    for (const s of SUMMARY) {
      const rs = readings.filter((r) => r.marker_key === s.key);
      if (!rs.length) continue;
      const vals = rs.map((r) => r.value!);
      const m = marker(s.key);
      const dp = s.key === "temperature" ? 1 : 0;
      const low = rs.at(-1)!.ref_low ?? defaultRange(m, null)?.low;
      const high = rs.at(-1)!.ref_high ?? defaultRange(m, null)?.high;
      const outside = rs.filter(bad).length;
      const range = low != null && high != null ? `${num(low, dp)}–${num(high, dp)}` : low != null ? `≥ ${num(low, dp)}` : high != null ? `≤ ${num(high, dp)}` : "—";
      const cells = [
        `${s.label} (${m?.unit ?? ""})`,
        String(rs.length),
        num(vals.reduce((a, b) => a + b, 0) / vals.length, dp === 1 ? 1 : 0),
        num(Math.min(...vals), dp),
        num(Math.max(...vals), dp),
        range.replace("≥", ">=").replace("≤", "<="),
        low == null && high == null ? "—" : `${outside} of ${rs.length}`,
      ];
      cells.forEach((c, i) => text(c, sCols[i]! + 4, 9, i === 6 && outside ? bold : font, i === 6 && outside ? RED : INK));
      y -= 6;
      rule();
      y -= 12;
    }
    y -= 14;

    // Daily log, oldest first
    const hasTemp = readings.some((r) => r.marker_key === "temperature");
    const cols = [
      { label: "Date", x: M },
      { label: "Time", x: M + 72 },
      { label: "BP (mmHg)", x: M + 130 },
      { label: "Pulse", x: M + 200 },
      { label: "Sugar (mg/dL)", x: M + 245 },
      { label: "Insulin (units)", x: M + (hasTemp ? 365 : 395) },
      ...(hasTemp ? [{ label: "Temp (°F)", x: M + 455 }] : []),
    ];
    const head = () => {
      page.drawRectangle({ x: M, y: y - 5, width: A4.w - 2 * M, height: 17, color: BAND });
      cols.forEach((c) => text(c.label, c.x + 4, 8.5, bold, GREY));
      y -= 18;
    };
    const footer = () => {
      const note = "* outside the normal range.  F fasting · L lunch · D dinner · R random.";
      page.drawText(note, { x: M, y: 24, size: 8, font, color: GREY });
      const n = `Page ${pdf.getPageCount()}`;
      page.drawText(n, { x: A4.w - M - font.widthOfTextAtSize(n, 8), y: 24, size: 8, font, color: GREY });
    };
    const newPage = () => {
      footer();
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - M;
      text(`${data.name} · home readings · ${period} (continued)`, M, 9, font, GREY);
      y -= 20;
      head();
    };

    if (y < 140) newPage();
    else {
      text("Daily log", M, 13, bold);
      y -= 18;
      head();
    }
    const dayList = [...new Set(readings.map((r) => r.taken_at))].sort();
    for (const d of dayList) {
      const at = new Map<string, Reading[]>();
      for (const r of readings.filter((r) => r.taken_at === d)) {
        const t = r.taken_time?.slice(0, 5) ?? "";
        at.set(t, [...(at.get(t) ?? []), r]);
      }
      [...at]
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([t, rs], i) => {
          if (y < 60) newPage();
          const get = (k: string) => rs.find((r) => r.marker_key === k);
          if (i === 0) text(day(d, { weekday: "short", day: "numeric", month: "short" }), cols[0]!.x + 4, 9, bold);
          text(t ? time(t) : "—", cols[1]!.x + 4, 9, font, GREY);
          const sys = get("bp_systolic");
          const dia = get("bp_diastolic");
          if (sys || dia)
            pieces(
              [
                { text: sys ? num(sys.value!) : "—", bad: bad(sys) },
                { text: dia ? num(dia.value!) : "—", bad: bad(dia) },
              ],
              cols[2]!.x + 4,
              9,
              "/",
            );
          const cell = (keys: string[], x: number, dp = 0) => {
            const list = keys.flatMap((k) => rs.filter((r) => r.marker_key === k)).map((r) => ({ text: `${num(r.value!, dp)}${SUFFIX[r.marker_key] ? ` ${SUFFIX[r.marker_key]}` : ""}`, bad: bad(r) }));
            if (list.length) pieces(list, x + 4, 9);
          };
          cell(["heart_rate"], cols[3]!.x);
          cell(["glucose_fasting", "glucose_lunch", "glucose_dinner", "glucose_random"], cols[4]!.x);
          cell(["insulin_lunch", "insulin_dinner"], cols[5]!.x);
          if (hasTemp) cell(["temperature"], cols[6]!.x, 1);
          y -= 15;
        });
      rule(y + 10);
      y -= 3;
    }
    footer();
  }

  const name = `${data.name || "Home readings"} - readings ${day(from, { day: "numeric", month: "short" })} to ${day(today, { day: "numeric", month: "short", year: "numeric" })}.pdf`;
  return new Response(Buffer.from(await pdf.save()), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name.replace(/[^\w .-]/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}
