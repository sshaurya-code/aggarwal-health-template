import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const role = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  if (role === "family") return NextResponse.next();
  // The helper only ever sees the care screen and the files it links to.
  if (role === "helper" && (path === "/care" || path.startsWith("/care/") || path === "/api/file")) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.redirect(new URL(role === "helper" ? "/care" : "/login", request.url));
}

export const config = {
  matcher: ["/((?!login|_next/|manifest.webmanifest|icon|apple-icon|favicon.ico|robots.txt|privacy|sw.js|lock.jpg|api/cron/).*)"],
};
