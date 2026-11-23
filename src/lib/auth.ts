export const SESSION_COOKIE = "ah_session";
const MAX_AGE_DAYS = 30;
export const SESSION_MAX_AGE = MAX_AGE_DAYS * 24 * 60 * 60;

/** family = everything; helper = only the care screen for HELPER_MEMBER_ID. */
export type Role = "family" | "helper";

// The PINs are part of the key, so changing FAMILY_PIN signs every phone out and
// changing HELPER_PIN signs the helper out.
async function hmac(message: string, role: Role) {
  const enc = new TextEncoder();
  const secret = `${process.env.AUTH_SECRET}:${process.env.FAMILY_PIN}${role === "helper" ? `:${process.env.HELPER_PIN}` : ""}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(sig).toString("base64url");
}

// Family tokens keep the original "expires.sig" shape so phones already signed in stay signed in.
export async function createSession(role: Role) {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const message = role === "helper" ? `${expires}.helper` : String(expires);
  return `${message}.${await hmac(message, role)}`;
}

export async function verifySession(token: string | undefined): Promise<Role | null> {
  if (!token || !process.env.AUTH_SECRET || !process.env.FAMILY_PIN) return null;
  const parts = token.split(".");
  const role: Role = parts.length === 3 && parts[1] === "helper" ? "helper" : "family";
  if (role === "helper" && (!process.env.HELPER_PIN || !process.env.HELPER_MEMBER_ID)) return null;
  if (parts.length !== (role === "helper" ? 3 : 2)) return null;
  const sig = parts.pop()!;
  const message = parts.join(".");
  // Tokens issued for longer than today's limit (the old 180 days) no longer count.
  if (!sig || Number(parts[0]) < Date.now() || Number(parts[0]) > Date.now() + SESSION_MAX_AGE * 1000) return null;
  const expected = await hmac(message, role);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? role : null;
}
