import type { Reminder } from "@/lib/reminders";
import { CATEGORY_STYLE, PANEL_STYLE } from "./theme";
import { IconTile, Row } from "./ui";

const STYLE: Record<Reminder["type"], (typeof CATEGORY_STYLE)[string]> = {
  id: CATEGORY_STYLE.id!,
  insurance: CATEGORY_STYLE.insurance!,
  warranty: CATEGORY_STYLE.bill!,
  return: CATEGORY_STYLE.bill!,
  test: PANEL_STYLE["Blood Count"],
  puc: CATEGORY_STYLE.car!,
  car_paper: CATEGORY_STYLE.car!,
  investment: CATEGORY_STYLE.investment!,
  maturity: CATEGORY_STYLE.investment!,
  other: CATEGORY_STYLE.other!,
};

export function DuePill({ days }: { days: number }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${days < 0 ? "bg-bad/14 text-bad" : days <= 30 ? "bg-warn/15 text-warn" : "bg-card2 text-ink2"}`}
    >
      {days < 0 ? "Expired" : days === 0 ? "Today" : days <= 60 ? `${days}d` : days < 730 ? `${Math.round(days / 30)}mo` : `${Math.round(days / 365)}y`}
    </span>
  );
}

export function DueRow({ r }: { r: Reminder }) {
  return (
    <Row href={r.href}>
      <div className="flex items-center gap-3">
        <IconTile style={STYLE[r.type]} size={30} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-semibold">{r.title}</p>
          <p className="truncate text-[13px] text-ink2">{r.body}</p>
        </div>
        <DuePill days={r.days} />
      </div>
    </Row>
  );
}
