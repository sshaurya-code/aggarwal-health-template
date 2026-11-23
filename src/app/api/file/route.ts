import { BUCKET, db, getRole } from "@/lib/supabase";

// The redirect holds a working link to a private file, so no browser or CDN may keep it.
const NO_STORE = { "Cache-Control": "private, no-store" };

// Short-lived signed link so private files never get a permanent public URL.
export async function GET(req: Request) {
  const role = await getRole();
  if (!role) return new Response("Not signed in", { status: 401, headers: NO_STORE });
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return new Response("Missing path", { status: 400, headers: NO_STORE });
  if (role === "helper") {
    // Only the health records of the person they look after, never her IDs or the family's papers.
    const { data } = await db()
      .from("documents")
      .select("id")
      .eq("member_id", process.env.HELPER_MEMBER_ID!)
      .eq("category", "health")
      .contains("files", [path])
      .maybeSingle();
    if (!data) return new Response("Not allowed", { status: 403, headers: NO_STORE });
  }
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) return new Response("File not found", { status: 404, headers: NO_STORE });
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, ...NO_STORE } });
}
