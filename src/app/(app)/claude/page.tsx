import { DocRow } from "@/components/DocRow";
import { ActionButton, AutoRefresh } from "@/components/client";
import { Empty, LargeTitle, Page, Row, Section } from "@/components/ui";
import { claudeEnabled, SPEND_CAP_INR } from "@/lib/claude";
import { getDocs, getMembers, getReadings } from "@/lib/data";
import { secondLook } from "@/lib/draft";
import { db } from "@/lib/supabase";
import { readAllUnread, readWithClaude } from "./actions";

export default async function ClaudePage() {
  const [docs, members, readings, spend] = await Promise.all([getDocs(), getMembers(), getReadings(), db().from("claude_spend").select("inr, settled")]);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const owner = (id: string | null) => (id ? (names.get(id) ?? null) : null);
  const rows = spend.data ?? [];
  const spent = rows.reduce((s, r) => s + Number(r.inr), 0);
  const settled = rows.filter((r) => r.settled && Number(r.inr) > 0);
  const each = settled.length ? settled.reduce((s, r) => s + Number(r.inr), 0) / settled.length : null;

  const drafts = docs.filter((d) => d.draft && !d.claude_state);
  const reading = docs.filter((d) => d.claude_state === "queued" || d.claude_state === "reading");
  const failed = docs.filter((d) => d.claude_state === "failed");
  const flagged = docs.map((d) => ({ d, n: secondLook(d, readings, names).length })).filter((x) => x.n > 0);
  const unread = docs.filter((d) => !d.claude_read && !d.draft && !d.claude_state);

  return (
    <Page>
      <LargeTitle title="Claude" subtitle="Details Claude read from your documents" back={{ href: "/records", label: "Records" }} />
      {!claudeEnabled() ? (
        <Empty title="Claude isn't set up" body="Add ANTHROPIC_API_KEY in Vercel to have Claude read uploads." />
      ) : (
        <>
          <div className="card rounded-2xl bg-card px-4 py-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] font-semibold">Spending</p>
              <p className="text-[15px] tabular-nums">
                ₹{Math.round(spent)} <span className="text-ink2">of ₹{SPEND_CAP_INR}</span>
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-card2">
              <div className={`h-full rounded-full ${spent / SPEND_CAP_INR > 0.8 ? "bg-bad" : "bg-accent"}`} style={{ width: `${Math.min(100, (spent / SPEND_CAP_INR) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[13px] text-ink2">
              {each ? `About ₹${Math.round(each)} per document so far. ` : ""}Claude stops reading before the total would pass ₹{SPEND_CAP_INR}.
            </p>
          </div>

          {reading.length > 0 && (
            <Section title={`Reading now · ${reading.length}`} footer="One at a time. You can close the app; it carries on.">
              <AutoRefresh every={6000} />
              {reading.map((d) => (
                <DocRow key={d.id} doc={d} owner={owner(d.member_id)} />
              ))}
            </Section>
          )}

          <Section title={`Check Claude's details · ${drafts.length}`} footer={drafts.length ? "Nothing Claude read is saved until you check it and tap Save." : undefined}>
            {drafts.length ? (
              drafts.map((d) => (
                <Row key={d.id} href={`/d/${d.id}?from=check`}>
                  <p className="truncate text-[17px]">{d.draft?.title ?? d.title}</p>
                  <p className="truncate text-[13px] text-ink2">{[owner(d.member_id) ?? "Household", d.title].join(" · ")}</p>
                  {d.draft?.owner && d.draft.owner !== d.member_id && d.draft.category !== "car" && (
                    <p className="text-[13px] text-warn">⚠ Looks like {owner(d.draft.owner)?.split(" ")[0]}&apos;s</p>
                  )}
                </Row>
              ))
            ) : (
              <Row>
                <p className="text-[15px] text-ink2">Nothing waiting.</p>
              </Row>
            )}
          </Section>

          {flagged.length > 0 && (
            <Section title={`Needs a second look · ${flagged.length}`} footer="A saved value differs from what Claude read on the document.">
              {flagged.map(({ d, n }) => (
                <Row key={d.id} href={`/d/${d.id}`}>
                  <p className="truncate text-[17px]">{d.title}</p>
                  <p className="text-[13px] text-warn">
                    {n} value{n === 1 ? "" : "s"} to check
                  </p>
                </Row>
              ))}
            </Section>
          )}

          {failed.length > 0 && (
            <Section title={`Couldn't read · ${failed.length}`}>
              {failed.map((d) => (
                <Row key={d.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px]">{d.title}</p>
                      <p className="text-[13px] text-ink2">{d.claude_error}</p>
                    </div>
                    <ActionButton action={readWithClaude.bind(null, d.id)} className="shrink-0 text-[15px] font-semibold text-accent">
                      Try again
                    </ActionButton>
                  </div>
                </Row>
              ))}
            </Section>
          )}

          {unread.length > 0 && (
            <Section footer={`${unread.length} document${unread.length === 1 ? " has" : "s have"} never been read${each ? `; about ₹${Math.round(each * unread.length)} for all of them` : ""}. Each one waits for you to check it.`}>
              <ActionButton action={readAllUnread} className="h-[50px] w-full text-[17px] font-semibold text-accent">
                Read all unread · {unread.length}
              </ActionButton>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}
