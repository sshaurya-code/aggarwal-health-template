"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Two-tap destructive button: first tap arms it, second tap runs the action. */
export function ConfirmButton({ action, label, confirmLabel = "Tap again to confirm", className = "" }: { action: () => Promise<void>; label: string; confirmLabel?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? start(action) : (setArmed(true), setTimeout(() => setArmed(false), 3000)))}
      className={`tap text-bad disabled:opacity-40 ${className}`}
    >
      {pending ? "Working…" : armed ? confirmLabel : label}
    </button>
  );
}

/** POSTs to an API route that may run for a minute (Claude), then refreshes the page. */
export function RunButton({ url, label, busyLabel, className = "" }: { url: string; label: string; busyLabel: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(url, { method: "POST" }).catch(() => null);
          if (!res?.ok) setError((await res?.json().catch(() => null))?.error ?? "Couldn't reach the server");
          setBusy(false);
          router.refresh();
        }}
        className={`tap flex items-center justify-center gap-2 disabled:opacity-60 ${className}`}
      >
        {busy && <Spinner />}
        {busy ? busyLabel : label}
      </button>
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ActionButton({ action, children, className = "" }: { action: () => Promise<void>; children: React.ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(action)} className={`tap disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}

/**
 * Sends the document itself (not a link) through the phone's share sheet: WhatsApp, Mail, AirDrop…
 * Files are fetched up front because iOS only opens the sheet straight from a tap, not after a slow download.
 */
const NO_PATHS: string[] = []; // one shared empty list, so the effect below doesn't re-run every render

export function ShareButton({
  paths = NO_PATHS,
  url,
  title,
  label = "Share",
}: {
  paths?: string[];
  url?: string; // a file the app makes on request (a PDF), instead of stored files
  title: string;
  label?: string;
}) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const safe = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Document";
    const sources = url ? [{ src: url, ext: "pdf" }] : paths.map((p) => ({ src: `/api/file?path=${encodeURIComponent(p)}`, ext: p.split(".").pop() }));
    Promise.all(
      sources.map(async ({ src, ext }, i) => {
        const res = await fetch(src);
        if (!res.ok) throw new Error("Couldn't load the file");
        const blob = await res.blob();
        return new File([blob], `${safe}${sources.length > 1 ? ` p${i + 1}` : ""}.${ext}`, { type: blob.type });
      }),
    )
      .then((f) => live && setFiles(f))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [paths, url, title]);

  async function share() {
    if (!files) return;
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, title });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Couldn't open sharing");
      }
      return;
    }
    // Computers without a share sheet: save the files instead.
    for (const f of files) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    }
  }

  return (
    <button type="button" onClick={share} disabled={!files} title={error ?? undefined} className="tap flex items-center gap-1 text-[17px] text-accent disabled:opacity-40">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
      {error ? "Unavailable" : files ? label : "Preparing…"}
    </button>
  );
}

/** Puts a value into the named field of the surrounding form: "Claude read 1234 · Use". */
export function UseValue({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const field = e.currentTarget.closest("form")?.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = value;
      }}
      className="tap block w-full px-4 pb-2 text-left text-[13px] text-accent"
    >
      {label}
    </button>
  );
}

/** Refreshes the page every few seconds while Claude is reading, so the draft appears on its own. */
export function AutoRefresh({ every = 4000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}

export type FilterItem = { key: string; label: string; main: boolean; node: React.ReactNode };

/** A long list (a report's test values) with a search box: the main items show, the rest wait under "Show all". */
export function FilterList({ items, noun = "values" }: { items: FilterItem[]; noun?: string }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const query = q.trim().toLowerCase();
  const shown = (i: FilterItem) => (query ? i.label.toLowerCase().includes(query) : all || i.main);
  const hidden = items.filter((i) => !i.main).length;
  const matches = items.filter(shown).length;
  return (
    <>
      {items.length > 6 && (
        <div className="border-b border-sep px-4 py-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${items.length} ${noun}`}
            className="h-9 w-full rounded-[10px] bg-card2 px-3 text-[15px] outline-none placeholder:text-ink2"
          />
        </div>
      )}
      {/* Hidden rows stay in the page, so their inputs are still sent with the form. */}
      {items.map((i) => (
        <div key={i.key} className={shown(i) ? "" : "hidden"}>
          {i.node}
        </div>
      ))}
      {query && !matches && <p className="px-4 py-3 text-[15px] text-ink2">No {noun} match “{q}”.</p>}
      {!query && hidden > 0 && (
        <button type="button" onClick={() => setAll(!all)} className="tap w-full border-t border-sep px-4 py-3 text-left text-[15px] font-semibold text-accent">
          {all ? "Show fewer" : `Show all ${items.length} ${noun}`}
        </button>
      )}
    </>
  );
}
