import Link from "next/link";
import { HOUSEHOLD, personColors } from "./theme";

export { CATEGORY_KINDS, CATEGORY_LABEL, KIND_LABEL } from "@/lib/kinds";

export function Page({ children }: { children: React.ReactNode }) {
  return <main className="pt-safe pb-tabbar mx-auto max-w-xl px-4">{children}</main>;
}

export function LargeTitle({
  title,
  subtitle,
  eyebrow,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  back?: { href: string; label: string };
  action?: React.ReactNode;
}) {
  return (
    <header className="pt-3 pb-3">
      <div className="flex h-9 items-center justify-between">
        {back ? (
          <Link href={back.href} className="tap -ml-1 flex items-center text-[17px] text-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {back.label}
          </Link>
        ) : (
          <span />
        )}
        {action}
      </div>
      {eyebrow && <p className="mt-1 text-[13px] font-semibold tracking-wide text-ink2 uppercase">{eyebrow}</p>}
      <h1 className="mt-0.5 text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-[15px] text-ink2">{subtitle}</p>}
    </header>
  );
}

type IconStyle = { color: string; icon: string; fill?: boolean };

export function IconTile({ style, size = 28 }: { style: IconStyle; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[8px] text-white" style={{ width: size, height: size, background: style.color }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill={style.fill ? "currentColor" : "none"} stroke={style.fill ? "none" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={style.icon} />
      </svg>
    </span>
  );
}

export function Section({
  title,
  icon,
  children,
  footer,
  action,
  bare,
}: {
  title?: string;
  icon?: IconStyle;
  children: React.ReactNode;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  bare?: boolean;
}) {
  return (
    <section className="mt-7">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          {title && (
            <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight">
              {icon && <IconTile style={icon} size={24} />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {bare ? children : <div className="card overflow-hidden rounded-2xl bg-card">{children}</div>}
      {footer && <p className="mt-2 px-1 text-[13px] text-ink2">{footer}</p>}
    </section>
  );
}

export function Row({ href, children, chevron = true }: { href?: string; children: React.ReactNode; chevron?: boolean }) {
  const inner = (
    <div className="flex min-h-11 items-center gap-3 py-2.5 pr-4 pl-4">
      <div className="min-w-0 flex-1">{children}</div>
      {href && chevron && (
        <svg width="8" height="14" viewBox="0 0 8 14" className="shrink-0 text-ink3">
          <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
  const cls = "block border-b border-sep last:border-0 [&:last-child>div]:border-0";
  return href ? (
    <Link href={href} className={`tap ${cls}`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Avatar({ name, size = 44, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const initials = name
    .replace(/\./g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const [from, to] = personColors(name);
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? "ring-[3px] ring-white/70" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(145deg, ${to}, ${from})` }}
    >
      {initials}
    </div>
  );
}

/** Whose document this is, so five PAN cards in one list are told apart at a glance. */
export function NameTag({ name }: { name: string | null }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-px text-[12px] font-semibold text-white"
      style={{ background: name ? personColors(name)[0] : "#8e8e93" }}
    >
      {name ? name.split(" ")[0] : "Household"}
    </span>
  );
}

export function HouseholdAvatar({ size = 44 }: { size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full text-white" style={{ width: size, height: size, background: "linear-gradient(145deg, #aeaeb2, #8e8e93)" }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={HOUSEHOLD.icon} />
      </svg>
    </div>
  );
}

export function Flag({ flag }: { flag: "low" | "high" | "normal" | null }) {
  if (!flag) return null;
  const map = {
    high: { label: "High", icon: "↑", cls: "text-bad bg-bad/14" },
    low: { label: "Low", icon: "↓", cls: "text-bad bg-bad/14" },
    normal: { label: "Normal", icon: "✓", cls: "text-good bg-good/14" },
  }[flag];
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold ${map.cls}`}>
      <span aria-hidden>{map.icon}</span>
      {map.label}
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card mt-6 rounded-2xl bg-card px-6 py-10 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="mt-1 text-[15px] text-ink2">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const fmtDate = (iso: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", opts) : "—";

export function fmtValue(v: number | null) {
  if (v == null) return "—";
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return String(Math.round(v * 10 ** digits) / 10 ** digits);
}

export const rupees = (n: number | null | undefined) => (n == null ? null : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
