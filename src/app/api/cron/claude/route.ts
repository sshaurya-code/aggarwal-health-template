import { after } from "next/server";
import { drainQueue } from "@/lib/claude";

export const maxDuration = 300;

// Reads queued documents in the background. Called by the app itself (with CRON_SECRET) after an upload
// or "Read all", and again by each run that leaves documents in the queue.
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  after(() => drainQueue(new URL(req.url).origin));
  return Response.json({ started: true }, { status: 202 });
}
