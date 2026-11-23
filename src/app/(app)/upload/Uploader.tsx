"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { startUpload, uploadsDone } from "@/app/actions";
import { Spinner } from "@/components/client";
import { CATEGORY_STYLE } from "@/components/theme";
import { Avatar, HouseholdAvatar, IconTile } from "@/components/ui";
import type { Category } from "@/lib/data";

type Picked = { file: File; preview: string | null };

const MAX_EDGE = 2000;

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: "health", label: "Health record", hint: "Reports, prescriptions, scans" },
  { key: "id", label: "ID", hint: "Aadhaar, PAN, passport, licence" },
  { key: "bill", label: "Bill", hint: "Shopping bills, warranty cards" },
  { key: "insurance", label: "Insurance", hint: "Health, home, travel policies" },
  { key: "car", label: "Car paper", hint: "RC, PUC, car insurance" },
  { key: "investment", label: "Investment", hint: "Life cover, SIPs, FDs, PPF" },
  { key: "other", label: "Other", hint: "Anything else" },
];

/** Phone photos are 3–8 MB HEIC/JPEG; a 2000px JPEG keeps lab text legible at ~10% of the size. */
async function optimise(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process photo"))), "image/jpeg", 0.85));
}

export function Uploader({
  members,
  initial,
  initialCategory,
  preset,
  anon,
}: {
  members: { id: string; name: string }[];
  initial: string | null;
  initialCategory: Category;
  preset: { kind?: string; vehicle_no?: string; label?: string };
  anon: { url: string; key: string };
}) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>(initialCategory);
  // "Add PUC for HR51AB1234" only holds while the section it was opened for is still picked.
  const slot = category === initialCategory ? preset : {};
  const [chosen, setMemberId] = useState<string | null>(initial);
  const household = category === "bill" || category === "insurance" || category === "car" || category === "other";
  // Health records and IDs always belong to a person.
  // Cars belong to the household.
  const memberId = category === "car" ? null : chosen === null && !household ? members[0]!.id : chosen;
  const [picked, setPicked] = useState<Picked[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docDate, setDocDate] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    // Copy now: the input is cleared right after, which empties the live FileList before the state updater runs.
    const files = [...list].map((file) => ({ file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }));
    setPicked((p) => [...p, ...files]);
  };

  // Photos together are pages of one document; each PDF is its own document.
  const photos = picked.filter((p) => p.file.type !== "application/pdf");
  const pdfs = picked.filter((p) => p.file.type === "application/pdf");
  const groups = [...(photos.length ? [photos] : []), ...pdfs.map((p) => [p])];
  // One date only makes sense for one document; with several, each gets its date on its own page.
  const dated = groups.length === 1 && category !== "id";
  const dateLabel = category === "health" ? "Date of report" : category === "bill" ? "Bill date" : category === "insurance" ? "Policy starts" : "Date on it";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  async function submit() {
    setError(null);
    try {
      const storage = createClient(anon.url, anon.key).storage.from("records");
      const ids: string[] = [];
      for (const [gi, group] of groups.entries()) {
        const label = groups.length > 1 ? ` ${gi + 1} of ${groups.length}` : "";
        setStatus(`Optimising${label}…`);
        const name = group[0]!.file.name.replace(/\.[^.]+$/, "");
        const blobs: Blob[] = group[0]!.file.type === "application/pdf" ? [group[0]!.file] : await Promise.all(group.map((p) => optimise(p.file)));
        const { id, uploads } = await startUpload(
          category,
          memberId,
          blobs.map((b) => ({ name, type: b.type || "image/jpeg" })),
          dated ? docDate || null : null,
          { kind: slot.kind, vehicle_no: slot.vehicle_no },
        );
        setStatus(`Uploading${label}…`);
        for (const [i, u] of uploads.entries()) {
          const { error } = await storage.uploadToSignedUrl(u.path, u.token, blobs[i]!, { contentType: blobs[i]!.type || "image/jpeg", cacheControl: "0" });
          if (error) throw new Error(error.message);
        }
        ids.push(id);
      }
      await uploadsDone(ids);
      router.push(ids.length === 1 ? `/d/${ids[0]}?edit=1` : memberId ? `/m/${memberId}?tab=docs` : "/records?owner=household");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    }
  }

  if (status)
    return (
      <div className="mt-16 flex flex-col items-center text-center">
        <Spinner size={36} />
        <p className="mt-4 text-[17px] font-semibold">{status}</p>
        <p className="mt-1 max-w-xs text-[15px] text-ink2">Keep this screen open.</p>
      </div>
    );

  return (
    <>
      {slot.label && <p className="card mb-4 rounded-2xl bg-accent/10 px-4 py-3 text-[15px] font-semibold">Adding: {slot.label}</p>}
      <p className="mb-2 px-1 text-[20px] font-bold tracking-tight">What is it?</p>
      <div className="grid grid-cols-2 gap-2.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`tap card flex items-start gap-2.5 rounded-2xl bg-card p-3 text-left outline-2 -outline-offset-2 ${c.key === category ? "outline-accent" : "outline-transparent"}`}
          >
            <IconTile style={CATEGORY_STYLE[c.key]!} size={30} />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{c.label}</span>
              <span className="block text-[12px] leading-snug text-ink2">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {category !== "car" && <p className="mt-6 mb-2 px-1 text-[20px] font-bold tracking-tight">Whose is it?</p>}
      <div className={`-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 ${category === "car" ? "hidden" : ""}`}>
        {household && (
          <button type="button" onClick={() => setMemberId(null)} className="tap flex w-16 shrink-0 flex-col items-center gap-1">
            <span className={`rounded-full p-0.5 ${memberId === null ? "ring-2 ring-accent" : ""}`}>
              <HouseholdAvatar size={52} />
            </span>
            <span className={`w-full truncate text-center text-[12px] ${memberId === null ? "font-semibold text-accent" : "text-ink2"}`}>Household</span>
          </button>
        )}
        {members.map((m) => (
          <button key={m.id} type="button" onClick={() => setMemberId(m.id)} className="tap flex w-16 shrink-0 flex-col items-center gap-1">
            <span className={`rounded-full p-0.5 ${m.id === memberId ? "ring-2 ring-accent" : ""}`}>
              <Avatar name={m.name} size={52} />
            </span>
            <span className={`w-full truncate text-center text-[12px] ${m.id === memberId ? "font-semibold text-accent" : "text-ink2"}`}>{m.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => cameraRef.current?.click()} className="tap flex h-32 flex-col items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white [background:linear-gradient(145deg,#5ab0ff,#007aff)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Scan with camera
        </button>
        <button type="button" onClick={() => libraryRef.current?.click()} className="tap flex h-32 flex-col items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white [background:linear-gradient(145deg,#d78cf5,#af52de)]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
            <path d="M14 3v5h5M12 11v6M9 14l3-3 3 3" strokeLinecap="round" />
          </svg>
          Photos or PDF
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      <input ref={libraryRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />

      {picked.length > 0 && (
        <>
          <p className="mt-7 mb-2 px-1 text-[20px] font-bold tracking-tight">
            {groups.length === 1 ? (photos.length > 1 ? `${photos.length} pages · one document` : "1 document") : `${groups.length} documents`}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {picked.map((p, i) => (
              <div key={i} className="card relative aspect-[3/4] overflow-hidden rounded-xl bg-card">
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                  <img src={p.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <span className="text-[28px]">📄</span>
                    <span className="line-clamp-2 text-[11px] text-ink2">{p.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setPicked((all) => all.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[13px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[13px] text-ink2">Photos are kept together as one document: the pages of a report, or the front and back of an ID. Use the camera again to add a page.</p>
          {dated && (
            <label className="card mt-4 flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-card px-4 py-1">
              <span className="text-[17px]">{dateLabel}</span>
              <input type="date" value={docDate} max={today} onChange={(e) => setDocDate(e.target.value)} className="min-w-0 bg-transparent text-right text-accent outline-none" />
            </label>
          )}
          {dated && <p className="mt-1.5 px-1 text-[13px] text-ink2">The date printed on it. Leave blank if you don&apos;t know; you can add it later.</p>}
          {error && <p className="mt-3 text-center text-[15px] text-bad">{error}</p>}
          <button type="button" onClick={submit} className="tap mt-5 h-[50px] w-full rounded-2xl bg-accent text-[17px] font-semibold text-white">
            Upload
          </button>
        </>
      )}
    </>
  );
}
