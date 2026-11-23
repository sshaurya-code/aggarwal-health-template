import "server-only";
import { BUCKET, db } from "./supabase";
import { FAMILY_NAME } from "./brand";

// Keeps a copy of every uploaded file in the family's Google Drive, sorted by person and section.
// The app only has the drive.file scope: it sees the files and folders it made, nothing else.

const ROOT = FAMILY_NAME;
const DELETED = `${ROOT}/Deleted from app`;
const API = "https://www.googleapis.com/drive/v3/files";
const FOLDER = "application/vnd.google-apps.folder";
const SECTION: Record<string, string> = { health: "Health", id: "IDs", bill: "Bills", insurance: "Insurance", car: "Cars", investment: "Investments", other: "Others" };

export const driveEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

type Copy = { id: string; folder: string; name: string };
type DriveDoc = {
  id: string;
  member_id: string | null;
  category: string;
  title: string;
  doc_date: string | null;
  created_at: string;
  files: string[];
  drive: Record<string, Copy>;
};

let cached: { token: string; until: number } | null = null;
async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google sign-in failed: ${body.error ?? res.status}`);
  cached = { token: body.access_token, until: Date.now() + (body.expires_in - 120) * 1000 };
  return cached.token;
}

async function google(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, ...init.headers } });
  if (!res.ok) throw Object.assign(new Error(`Google Drive ${res.status}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  return res;
}

/** Drive folder id for "<Family>/<Person>/Health", creating any missing level. */
async function folderId(path: string): Promise<string> {
  const { data } = await db().from("drive_folders").select("id").eq("path", path).maybeSingle();
  if (data) return data.id;
  const parts = path.split("/");
  const parent = parts.length > 1 ? await folderId(parts.slice(0, -1).join("/")) : "root";
  const res = await google(`${API}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: parts.at(-1), mimeType: FOLDER, parents: [parent] }),
  });
  const { id } = await res.json();
  await db().from("drive_folders").upsert({ path, id });
  return id;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80);

/** Where each file of a document belongs in Drive right now. */
async function targets(doc: DriveDoc, folderPath?: string) {
  let owner = "Household";
  if (doc.member_id) {
    const { data } = await db().from("members").select("name").eq("id", doc.member_id).maybeSingle();
    owner = data?.name ?? "Unknown";
  }
  const folder = folderPath ?? `${ROOT}/${safe(owner)}/${SECTION[doc.category] ?? "Other"}`;
  return doc.files.map((path, i) => ({
    path,
    folder,
    name: `${doc.doc_date ?? doc.created_at.slice(0, 10)} ${safe(doc.title)}${doc.files.length > 1 ? ` p${i + 1}` : ""}.${path.split(".").pop()}`,
  }));
}

async function upload(path: string, folder: string, name: string) {
  const { data: blob, error } = await db().storage.from(BUCKET).download(path);
  if (error || !blob) throw new Error(`Couldn't read ${path} from storage`);
  // Resumable upload: works for files of any size.
  const start = await google(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Upload-Content-Type": blob.type || "application/octet-stream" },
    body: JSON.stringify({ name, parents: [await folderId(folder)] }),
  });
  const res = await google(start.headers.get("location")!, { method: "PUT", body: blob });
  return (await res.json()).id as string;
}

/** Brings one document's Drive copies up to date: uploads missing files, moves and renames changed ones. */
async function sync(doc: DriveDoc, folderPath?: string) {
  const drive = { ...doc.drive };
  let changed = false;
  for (const t of await targets(doc, folderPath)) {
    const have = drive[t.path];
    if (have && have.folder === t.folder && have.name === t.name) continue;
    if (!have) drive[t.path] = { id: await upload(t.path, t.folder, t.name), folder: t.folder, name: t.name };
    else {
      const to = await folderId(t.folder);
      const from = await folderId(have.folder);
      try {
        await google(`${API}/${have.id}?addParents=${to}&removeParents=${from}&fields=id`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: t.name }),
        });
        drive[t.path] = { ...have, folder: t.folder, name: t.name };
      } catch (e) {
        // Someone deleted the Drive copy by hand: make a fresh one.
        if ((e as { status?: number }).status !== 404) throw e;
        drive[t.path] = { id: await upload(t.path, t.folder, t.name), folder: t.folder, name: t.name };
      }
    }
    changed = true;
  }
  if (changed) await db().from("documents").update({ drive }).eq("id", doc.id);
}

const COLUMNS = "id, member_id, category, title, doc_date, created_at, files, drive";

/** Copies or updates one document. Never throws: Drive trouble must not break the app; the daily run retries. */
export async function copyToDrive(docId: string) {
  if (!driveEnabled()) return;
  try {
    const { data } = await db().from("documents").select(COLUMNS).eq("id", docId).maybeSingle();
    if (data) await sync(data as DriveDoc);
  } catch (e) {
    console.error("drive copy failed", docId, e);
  }
}

/** Before a document is deleted: its Drive copy moves to "Deleted from app" (uploaded first if it never got there). */
export async function keepDeletedInDrive(docIds: string[]) {
  if (!driveEnabled() || !docIds.length) return;
  const { data } = await db().from("documents").select(COLUMNS).in("id", docIds);
  for (const doc of (data ?? []) as DriveDoc[]) {
    try {
      await sync(doc, DELETED);
    } catch (e) {
      console.error("drive keep failed", doc.id, e);
    }
  }
}

/** Daily catch-up: copies anything missed. Stops early to stay inside the function time limit. */
export async function syncAllToDrive(budgetMs = 200_000) {
  if (!driveEnabled()) return { checked: 0, left: 0 };
  const until = Date.now() + budgetMs;
  const { data } = await db().from("documents").select(COLUMNS).order("created_at");
  const docs = (data ?? []) as DriveDoc[];
  let done = 0;
  for (const doc of docs) {
    if (Date.now() > until) break;
    try {
      await sync(doc);
    } catch (e) {
      console.error("drive sync failed", doc.id, e);
    }
    done++;
  }
  return { checked: done, left: docs.length - done };
}
