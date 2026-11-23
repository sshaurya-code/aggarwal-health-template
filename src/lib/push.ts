import "server-only";
import webpush, { WebPushError } from "web-push";
import { db } from "./supabase";
import { SITE_URL } from "./brand";

export const pushEnabled = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export type PushSub = { id: string; endpoint: string; p256dh: string; auth: string; member_id: string | null };

/** Sends one notification. A phone that turned reminders off (404/410) is forgotten. */
export async function sendPush(sub: PushSub, msg: { title: string; body: string; url: string }) {
  webpush.setVapidDetails(SITE_URL, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 24 });
    return true;
  } catch (err) {
    if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
      await db().from("push_subscriptions").delete().eq("id", sub.id);
      return false;
    }
    throw err;
  }
}
