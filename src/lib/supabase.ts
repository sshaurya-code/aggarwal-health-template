import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./auth";

export const BUCKET = "records";

export function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export async function getRole() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

// Proxy is only an optimistic check; every server action and route calls one of these too.
export async function requireAuth() {
  if ((await getRole()) !== "family") throw new Error("Not signed in");
}

/** Family, or the helper acting on the one person they care for. Returns the role. */
export async function requireCare(memberId: string) {
  const role = await getRole();
  if (role === "family" || (role === "helper" && memberId === process.env.HELPER_MEMBER_ID)) return role;
  throw new Error("Not signed in");
}
