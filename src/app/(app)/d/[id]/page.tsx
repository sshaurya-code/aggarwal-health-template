import { notFound } from "next/navigation";
import { deleteDoc, moveDoc, setDocDate, setNotRenewing } from "@/app/actions";
import { confirmSaved, readWithClaude, useClaude } from "@/app/(app)/claude/actions";
import { CheckCard } from "@/components/CheckCard";
import { ActionButton, AutoRefresh, ConfirmButton, FilterList, ShareButton, Spinner } from "@/components/client";
import { KIND_STYLE } from "@/components/theme";
import { Flag, fmtValue, IconTile, KIND_LABEL, LargeTitle, NameTag, Page, Row, Section } from "@/components/ui";
import { docDateLabel, ExpiryChip, VaultCard, VaultForm } from "@/components/VaultDetails";
import { getDoc, getMedications, getMember, getMembers, getReadings, markerName } from "@/lib/data";
import { claudeEnabled } from "@/lib/claude";
import { mainResults, secondLook } from "@/lib/draft";
import { istToday } from "@/lib/reminders";

// Papers that matter after they expire (unlike a bill's warranty or an investment's maturity).
const LASTING = new Set(["id", "insurance", "car", "other"]);

const firstName = (s: string) => s.trim().split(/\s+/)[0]!.toLowerCase();

export default async function DocPage({ params, searchParams }: PageProps<"/d/[id]">) {
  const { id } = await params;
  const doc = await getDoc(id);
  if (!doc) notFound();
  const health = doc.category === "health";
  const [member, members, readings, meds] = await Promise.all([
    doc.member_id ? getMember(doc.member_id) : null,
    getMembers(),
    health && doc.member_id ? getReadings(doc.member_id) : [],
    health && doc.member_id ? getMedications(doc.member_id) : [],
  ]);
  const results = readings.filter((r) => r.document_id === id);
  const main = mainResults(results);
  const rx = meds.filter((m) => m.document_id === id);
  const nameMismatch = !doc.claude_read && !doc.draft && health && doc.patient_name && member && !doc.patient_name.toLowerCase().includes(firstName(member.name));
  const suggested = nameMismatch ? members.find((m) => doc.patient_name!.toLowerCase().includes(firstName(m.name))) : undefined;
  const sp = await searchParams;
  const reading = doc.claude_state === "queued" || doc.claude_state === "reading";
  const busy = reading || Boolean(doc.draft);
  const editOpen = !busy && (sp.edit === "1" || (doc.category === "id" && !doc.details.number));
  const flags = secondLook(doc, readings, new Map(members.map((m) => [m.id, m.name])));
  const flagged = new Map(flags.filter((f) => f.field.startsWith("reading:")).map((f) => [f.field.slice(8), f.claude]));

  return (
    <Page>
      <LargeTitle
        title={doc.title}
        back={member ? { href: `/m/${member.id}?tab=docs`, label: member.name.split(" ")[0]! } : { href: "/records?owner=household", label: "Household" }}
        action={doc.files.length > 0 && <ShareButton paths={doc.files} title={doc.title} />}
      />
      <div className="-mt-1 flex items-center gap-2.5">
        <IconTile style={KIND_STYLE[doc.kind] ?? KIND_STYLE.other!} size={30} />
        <NameTag name={member?.name ?? null} />
        <p className="min-w-0 flex-1 text-[15px] text-ink2">
          {[KIND_LABEL[doc.kind], health && docDateLabel(doc), doc.lab_name, doc.doctor].filter(Boolean).join(" · ")}
        </p>
        <ExpiryChip doc={doc} />
      </div>

      {reading && (
        <div className="card mt-4 flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
          <AutoRefresh />
          <Spinner size={22} />
          <div>
            <p className="text-[15px] font-semibold">Claude is reading this…</p>
            <p className="text-[13px] text-ink2">Usually under a minute. You can leave this screen; it carries on.</p>
          </div>
        </div>
      )}

      {doc.claude_state === "failed" && (
        <div className="mt-4 rounded-2xl bg-warn/15 px-4 py-3 text-[15px]">
          <p>
            <strong>Claude couldn&apos;t read this.</strong> {doc.claude_error}
          </p>
          {claudeEnabled() && (
            <ActionButton action={readWithClaude.bind(null, id)} className="mt-2 font-semibold text-accent">
              Try again
            </ActionButton>
          )}
        </div>
      )}

      {doc.draft && !reading && <CheckCard doc={doc} members={members} fromCheck={sp.from === "check"} />}

      {flags.length > 0 && !doc.draft && (
        <Section title="Needs a second look" footer="Where a saved value differs from what Claude read on the document. Check the original, then pick the right one.">
          {flags.map((f) => (
            <Row key={f.field}>
              <p className="text-[15px] font-semibold">{f.label}</p>
              <p className="text-[15px]">
                Saved <strong>{f.saved || "—"}</strong> · <span className="text-warn">⚠ Claude read {f.claude}</span>
              </p>
              <div className="mt-1.5 flex gap-4 text-[15px] font-semibold text-accent">
                <ActionButton action={confirmSaved.bind(null, id, f.field)}>Saved value is right</ActionButton>
                <ActionButton action={useClaude.bind(null, id, f.field)}>Use Claude&apos;s</ActionButton>
              </div>
            </Row>
          ))}
        </Section>
      )}

      {!busy && !doc.doc_date && (health || doc.category === "bill") && (
        <form action={setDocDate.bind(null, id)} className="card mt-4 rounded-2xl bg-card px-4 py-3">
          <p className="text-[15px] font-semibold">{health ? "When was this report done?" : "What date is on this bill?"}</p>
          <p className="mt-0.5 text-[13px] text-ink2">Use the date printed on it, not the day it was uploaded.</p>
          <div className="mt-2.5 flex items-center gap-2">
            <input name="doc_date" type="date" required max={istToday()} className="h-10 min-w-0 flex-1 rounded-xl bg-card2 px-3 text-accent outline-none" />
            <button className="tap h-10 shrink-0 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">Save</button>
          </div>
        </form>
      )}

      {nameMismatch && (
        <div className="mt-4 rounded-2xl bg-warn/15 px-4 py-3 text-[15px]">
          <p>
            This report is for <strong>{doc.patient_name}</strong>, but it&apos;s filed under {member?.name}.
          </p>
          {suggested && (
            <form action={moveDoc.bind(null, id, suggested.id)} className="mt-2">
              <button className="tap font-semibold text-accent">Move to {suggested.name}</button>
            </form>
          )}
        </div>
      )}

      {!health && (
        <Section title="Details">
          <VaultCard doc={doc} />
        </Section>
      )}

      {doc.summary && (
        <Section title="Summary">
          <p className="px-4 py-3 text-[15px] leading-relaxed">{doc.summary}</p>
        </Section>
      )}

      {results.length > 0 && (
        <Section title={`Results · ${results.length}`}>
          <FilterList
            items={results.map((r) => ({
              key: r.id,
              label: markerName(r),
              main: results.length <= 6 || main.has(r),
              node: (
            <Row key={r.id} href={`/m/${r.member_id}/marker/${encodeURIComponent(r.marker_key)}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[17px]">{markerName(r)}</p>
                  {(r.ref_low != null || r.ref_high != null) && (
                    <p className="text-[13px] text-ink2">
                      Ref {r.ref_low != null ? fmtValue(r.ref_low) : "<"}
                      {r.ref_low != null && r.ref_high != null ? "–" : r.ref_low != null ? "+" : ""}
                      {r.ref_high != null ? fmtValue(r.ref_high) : ""}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[17px] font-semibold tabular-nums">
                    {r.value != null ? fmtValue(r.value) : r.value_text} <span className="text-[12px] font-normal text-ink2">{r.unit}</span>
                  </p>
                  <Flag flag={r.flag} />
                  {flagged.has(r.marker_key) && <p className="text-[12px] text-warn">⚠ Claude read {flagged.get(r.marker_key)}</p>}
                </div>
              </div>
            </Row>
              ),
            }))}
          />
        </Section>
      )}

      {rx.length > 0 && (
        <Section title="Medications">
          {rx.map((m) => (
            <Row key={m.id}>
              <p className="text-[17px]">{m.name}</p>
              <p className="text-[13px] text-ink2">{[m.dose, m.frequency].filter(Boolean).join(" · ") || "—"}</p>
            </Row>
          ))}
        </Section>
      )}

      <Section title={doc.files.length > 1 ? `Pages · ${doc.files.length}` : "Original"}>
        {doc.files.map((path, i) =>
          path.endsWith(".pdf") ? (
            <Row key={path} href={`/api/file?path=${encodeURIComponent(path)}`}>
              <p className="text-[17px] text-accent">Open PDF</p>
            </Row>
          ) : (
            <a key={path} href={`/api/file?path=${encodeURIComponent(path)}`} className="block border-b border-sep last:border-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL, not optimisable */}
              <img src={`/api/file?path=${encodeURIComponent(path)}`} alt={`Page ${i + 1}`} className="w-full" loading="lazy" />
            </a>
          ),
        )}
      </Section>

      {doc.expires_on && doc.expires_on < istToday() && LASTING.has(doc.category) && (
        <div className="card mt-6 rounded-2xl bg-card px-4 py-3">
          <p className="text-[15px] font-semibold">{doc.details.not_renewing ? "Marked as not renewing" : "This has expired"}</p>
          <p className="mt-0.5 text-[13px] text-ink2">
            {doc.details.not_renewing
              ? "It no longer shows on Home or in Due dates."
              : "It stays on Home until a newer one is uploaded. If it won't be renewed, say so and it stops asking."}
          </p>
          <ActionButton action={setNotRenewing.bind(null, id, !doc.details.not_renewing)} className="mt-2.5 h-10 w-full rounded-xl bg-card2 text-[15px] font-semibold text-accent">
            {doc.details.not_renewing ? "Remind me again" : "Not renewing"}
          </ActionButton>
        </div>
      )}

      <details open={editOpen} className="mt-7 [&[open]>summary]:mb-2">
        <summary className="tap cursor-pointer list-none px-1 text-[17px] font-semibold text-accent">{doc.category === "id" ? "Number & expiry" : "Edit details"}</summary>
        <VaultForm doc={doc} />
      </details>

      {doc.category !== "car" && (
      <Section title="File under">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {!health && (
            <form action={moveDoc.bind(null, id, null)}>
              <button disabled={!doc.member_id} className={`tap rounded-full px-3 py-1.5 text-[15px] ${!doc.member_id ? "bg-accent text-white" : "bg-card2 text-ink"}`}>
                Household
              </button>
            </form>
          )}
          {members.map((m) => (
            <form key={m.id} action={moveDoc.bind(null, id, m.id)}>
              <button
                disabled={m.id === doc.member_id}
                className={`tap rounded-full px-3 py-1.5 text-[15px] ${m.id === doc.member_id ? "bg-accent text-white" : "bg-card2 text-ink"}`}
              >
                {m.name.split(" ")[0]}
              </button>
            </form>
          ))}
        </div>
      </Section>
      )}

      <div className="mt-6 space-y-3">
        {claudeEnabled() && !busy && (
          <ActionButton action={readWithClaude.bind(null, id)} className="card h-[50px] w-full rounded-2xl bg-card text-[17px] font-semibold text-accent">
            {doc.claude_read ? "Read again with Claude" : "Read with Claude"}
          </ActionButton>
        )}
        <ConfirmButton action={deleteDoc.bind(null, id)} label="Delete document" confirmLabel={health ? "Tap again to delete it and its results" : "Tap again to delete it"} className="card h-[50px] w-full rounded-2xl bg-card text-[17px] font-semibold" />
      </div>
    </Page>
  );
}
