"use client";

import { useEffect, useState } from "react";
import { backupManifest, pushSubscriptionOwner, removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions";
import { Spinner } from "@/components/client";
import { FAMILY_NAME } from "@/lib/brand";

const key = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const button = "tap flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold disabled:opacity-50";

export function Reminders({ members, vapidKey }: { members: { id: string; name: string }[]; vapidKey: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "off" | "on">("loading");
  const [who, setWho] = useState("everyone");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      const owner = sub && (await pushSubscriptionOwner(sub.endpoint));
      if (sub && owner) {
        setEndpoint(sub.endpoint);
        setWho(owner.memberId ?? "everyone");
        return setState("on");
      }
      setState("off");
    })().catch((e) => (setNote(message(e)), setState("off")));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote(message(e));
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      // Ask first, while iOS still counts this as the tap that started it.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(vapidKey) }));
      await savePushSubscription(sub.toJSON(), who === "everyone" ? null : who);
      setEndpoint(sub.endpoint);
      setState("on");
      setNote("Reminders are on. Tap Send a test to check.");
    });

  const turnOff = () =>
    run(async () => {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      await sub?.unsubscribe();
      if (endpoint) await removePushSubscription(endpoint);
      setEndpoint(null);
      setState("off");
    });

  const choose = (value: string) => {
    setWho(value);
    if (state === "on")
      run(async () => {
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (sub) await savePushSubscription(sub.toJSON(), value === "everyone" ? null : value);
      });
  };

  if (state === "loading") return <p className="flex items-center gap-2 px-4 py-3 text-[15px] text-ink2"><Spinner /> Checking this phone…</p>;
  if (state === "unsupported")
    return (
      <p className="px-4 py-3 text-[15px] leading-relaxed">
        On iPhone, reminders only work once the app is on your Home Screen. In Safari tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, open
        {FAMILY_NAME} from the new icon, and come back to this page.
      </p>
    );
  if (state === "denied")
    return <p className="px-4 py-3 text-[15px] leading-relaxed">Notifications are blocked for this app. Turn them on in iPhone Settings → Notifications → {FAMILY_NAME}, then reopen this page.</p>;

  return (
    <div className="space-y-3 px-4 py-3">
      <label className="flex items-center justify-between gap-3 text-[17px]">
        This phone is for
        <select value={who} onChange={(e) => choose(e.target.value)} disabled={busy} className="min-w-0 appearance-none bg-transparent text-right text-accent outline-none" dir="rtl">
          <option value="everyone">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[13px] text-ink2">{who === "everyone" ? "Gets every family reminder." : "Gets this person's reminders and the household's."}</p>
      {state === "off" ? (
        <button type="button" onClick={turnOn} disabled={busy} className={`${button} bg-accent text-white`}>
          {busy && <Spinner />} Turn on reminders
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => endpoint && run(() => sendTestPush(endpoint))} disabled={busy} className={`${button} bg-accent/12 text-accent`}>
            Send a test
          </button>
          <button type="button" onClick={turnOff} disabled={busy} className={`${button} bg-card2 text-bad`}>
            Turn off
          </button>
        </div>
      )}
      {note && <p className="text-[13px] text-ink2">{note}</p>}
    </div>
  );
}

/** Builds the zip on the phone: files come straight from storage, so there's no server size limit. */
export function Backup() {
  const [status, setStatus] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function build() {
    setBusy(true);
    setFile(null);
    try {
      setStatus("Gathering records…");
      const { data, files } = await backupManifest();
      const { downloadZip } = await import("client-zip");
      let done = 0;
      let missing = 0;
      async function* entries() {
        yield { name: "records.json", input: JSON.stringify(data, null, 2) };
        for (const f of files) {
          const res = f.url ? await fetch(f.url).catch(() => null) : null;
          setStatus(`Downloading ${++done} of ${files.length}…`);
          if (res?.ok) yield { name: f.name, input: res };
          else missing++;
        }
      }
      const blob = await downloadZip(entries()).blob();
      setFile(new File([blob], `family-records-${new Date().toISOString().slice(0, 10)}.zip`, { type: "application/zip" }));
      setStatus(`${files.length - missing} files ready (${(blob.size / 1e6).toFixed(1)} MB)${missing ? `. ${missing} couldn't be fetched; try again later.` : "."}`);
    } catch (e) {
      setStatus(message(e));
    } finally {
      setBusy(false);
    }
  }

  // Sharing needs a fresh tap on iOS, so saving is its own button once the zip is built.
  async function save() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
    else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {file ? (
        <button type="button" onClick={save} className={`${button} bg-accent text-white`}>
          Save backup
        </button>
      ) : (
        <button type="button" onClick={build} disabled={busy} className={`${button} bg-accent/12 text-accent`}>
          {busy && <Spinner />} Download everything
        </button>
      )}
      {status && <p className="text-[13px] text-ink2">{status}</p>}
    </div>
  );
}
