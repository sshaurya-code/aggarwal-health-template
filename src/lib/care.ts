import "server-only";
import { db, requireCare } from "./supabase";
import type { Doc, Member, Reading } from "./data";

const TZ = "Asia/Kolkata";
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const nowIST = () => new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

const LOOKBACK_DAYS = 7;

export async function getCare(memberId: string) {
  const role = await requireCare(memberId);
  const since = shift(todayIST(), -LOOKBACK_DAYS);
  const [member, readings, docs] = await Promise.all([
    db().from("members").select("*").eq("id", memberId).maybeSingle(),
    db().from("readings").select("*").eq("member_id", memberId).eq("source", "manual").gte("taken_at", since).order("taken_at", { ascending: false }).order("taken_time", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    db().from("documents").select("*").eq("member_id", memberId).eq("category", "health").order("doc_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
  ]);
  for (const r of [member, readings, docs]) if (r.error) throw new Error(r.error.message);
  return {
    role,
    member: member.data as Member | null,
    readings: readings.data as Reading[],
    docs: docs.data as Doc[],
  };
}

/** Home readings over the last `days` days, oldest first, for the trend sheet. */
export async function getTrends(memberId: string, days: number) {
  const role = await requireCare(memberId);
  const since = shift(todayIST(), -(days - 1));
  const [member, readings] = await Promise.all([
    db().from("members").select("name").eq("id", memberId).maybeSingle(),
    db().from("readings").select("*").eq("member_id", memberId).eq("source", "manual").gte("taken_at", since).order("taken_at").order("taken_time", { nullsFirst: true }).order("created_at"),
  ]);
  for (const r of [member, readings]) if (r.error) throw new Error(r.error.message);
  return { role, name: (member.data?.name as string | undefined) ?? "", readings: readings.data as Reading[] };
}

export const fmtTime = (hm: string) =>
  new Date(`2000-01-01T${hm.slice(0, 5)}:00`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
