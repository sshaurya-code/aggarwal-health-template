import type { Doc, Member, Reading } from "@/lib/data";
import { pushEnabled, sendPush, type PushSub } from "@/lib/push";
import { reminders, stageOf } from "@/lib/reminders";
import { db } from "@/lib/supabase";
import { syncAllToDrive } from "@/lib/drive";

export const maxDuration = 300;

// Vercel calls this once a day (vercel.json). It also keeps the free Supabase project from pausing
// and copies to Google Drive anything that missed its copy at upload time.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "Unauthorised" }, { status: 401 });

  const [members, docs, readings, subs, sent] = await Promise.all([
    db().from("members").select("*"),
    db().from("documents").select("*").eq("status", "ready"),
    db().from("readings").select("*").order("taken_at").order("created_at"),
    db().from("push_subscriptions").select("*"),
    db().from("reminders_sent").select("subscription_id, key"),
  ]);
  const err = [members, docs, readings, subs, sent].find((r) => r.error)?.error;
  if (err) return Response.json({ error: err.message }, { status: 500 });

  const items = reminders(docs.data as Doc[], members.data as Member[], readings.data as Reading[]);
  if (!pushEnabled()) return Response.json({ reminders: items.length, phones: 0, drive: await syncAllToDrive() });
  const already = new Set(sent.data!.map((s) => `${s.subscription_id}|${s.key}`));
  let phones = 0;

  for (const sub of subs.data as PushSub[]) {
    const fresh = items
      .filter((r) => !sub.member_id || r.memberId === sub.member_id || r.memberId === null)
      .map((r) => ({ r, key: `${r.key}:${stageOf(r)}` }))
      .filter(({ r, key }) => stageOf(r) != null && !already.has(`${sub.id}|${key}`));
    if (!fresh.length) continue;
    const [one] = fresh;
    const msg =
      fresh.length === 1
        ? { title: one!.r.title, body: one!.r.body, url: one!.r.href }
        : { title: `${fresh.length} things coming up`, body: fresh.slice(0, 3).map((f) => f.r.title).join(" · ") + (fresh.length > 3 ? " · …" : ""), url: "/" };
    try {
      if (!(await sendPush(sub, msg))) continue;
    } catch (e) {
      console.error("push failed", sub.id, e);
      continue;
    }
    await db().from("reminders_sent").insert(fresh.map((f) => ({ subscription_id: sub.id, key: f.key })));
    phones++;
  }
  return Response.json({ reminders: items.length, phones, drive: await syncAllToDrive() });
}
