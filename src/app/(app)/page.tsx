import Link from "next/link";
import { DueRow } from "@/components/DueRow";
import { HouseholdCards, type CareSummary } from "@/components/HouseholdCards";
import { CATEGORY_STYLE, PANEL_STYLE } from "@/components/theme";
import { Empty, fmtValue, HouseholdAvatar, IconTile, LargeTitle, Page, Section } from "@/components/ui";
import { getCare } from "@/lib/care";
import { dueTests, flagged, getDocs, getMembers, getReadings } from "@/lib/data";
import { family } from "@/lib/family";
import { reminders } from "@/lib/reminders";
import { FAMILY_NAME } from "@/lib/brand";

export default async function FamilyPage() {
  const [members, readings, docs] = await Promise.all([getMembers(), getReadings(), getDocs()]);

  const rows = members.map((m) => {
    const mine = readings.filter((r) => r.member_id === m.id);
    return { m, flags: flagged(mine), due: dueTests(mine, m.sex).filter((d) => d.overdue && d.last) };
  });
  const status = new Map(rows.map(({ m, flags, due }) => [m.id, { flags: flags.length, due: due.length }]));
  const { units, others } = family(members);
  const care = await careSummary(members.some((m) => m.id === process.env.HELPER_MEMBER_ID) ? process.env.HELPER_MEMBER_ID! : null);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  // Tests due already show on each person's card, so this list is the vault's dates.
  const coming = reminders(docs, members, readings).filter((r) => r.type !== "test");
  const householdDocs = docs.filter((d) => !d.member_id).length;
  const cars = new Set(docs.filter((d) => d.category === "car" && d.details.vehicle_no).map((d) => d.details.vehicle_no)).size;
  const drafts = docs.filter((d) => d.draft && !d.claude_state).length;

  return (
    <Page>
      <LargeTitle
        eyebrow={today}
        title={FAMILY_NAME}
        action={
          <Link href="/m/new" aria-label="Add family member" className="tap flex h-8 w-8 items-center justify-center rounded-full bg-accent/12 text-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        }
      />

      {!members.length && (
        <Empty
          title="Start the family file"
          body="Add each family member first. Then upload their reports and the app files every value for you."
          action={
            <Link href="/m/new" className="tap inline-block rounded-2xl bg-accent px-5 py-3 text-[17px] font-semibold text-white">
              Add a family member
            </Link>
          }
        />
      )}

      {drafts > 0 && (
        <Link href="/claude" className="tap card mt-2 mb-4 flex items-center gap-3 rounded-2xl bg-accent/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Check Claude&apos;s details · {drafts}</p>
            <p className="text-[13px] text-ink2">Claude read {drafts === 1 ? "a document" : `${drafts} documents`}. Nothing is saved until you check.</p>
          </div>
          <span className="text-ink3">›</span>
        </Link>
      )}

      {members.length > 0 && <HouseholdCards units={units} others={others} status={status} coming={coming} care={care} />}

      {coming.length > 0 && (
        <Section
          title="Needs attention"
          action={
            <Link href="/due" className="tap text-[15px] text-accent">
              All dates
            </Link>
          }
        >
          {coming.slice(0, 8).map((r) => (
            <DueRow key={r.key} r={r} />
          ))}
          {coming.length > 8 && (
            <Link href="/due" className="tap block px-4 py-3 text-[15px] text-accent">
              {coming.length - 8} more
            </Link>
          )}
        </Section>
      )}

      {members.length > 0 && (
        <Section bare>
          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/map" className="tap card rounded-2xl bg-card p-3.5">
              <IconTile style={PANEL_STYLE.Inflammation} size={40} />
              <p className="mt-2.5 text-[17px] font-semibold">Health map</p>
              <p className="text-[13px] text-ink2">What runs in the family</p>
            </Link>
            <Link href="/due" className="tap card rounded-2xl bg-card p-3.5">
              <IconTile style={CATEGORY_STYLE.id!} size={40} />
              <p className="mt-2.5 text-[17px] font-semibold">Due dates</p>
              <p className="text-[13px] text-ink2">Every expiry and payment</p>
            </Link>
            <Link href="/records?cat=car" className="tap card rounded-2xl bg-card p-3.5">
              <IconTile style={CATEGORY_STYLE.car!} size={40} />
              <p className="mt-2.5 text-[17px] font-semibold">Cars</p>
              <p className="text-[13px] text-ink2">{cars ? `${cars} car${cars === 1 ? "" : "s"} · RC, insurance, PUC` : "RC, insurance, PUC"}</p>
            </Link>
            <Link href="/records?owner=household" className="tap card rounded-2xl bg-card p-3.5">
              <HouseholdAvatar size={40} />
              <p className="mt-2.5 text-[17px] font-semibold">Household</p>
              <p className="text-[13px] text-ink2">{householdDocs ? `${householdDocs} shared document${householdDocs === 1 ? "" : "s"}` : "Shared bills and policies"}</p>
            </Link>
          </div>
        </Section>
      )}
    </Page>
  );
}

async function careSummary(memberId: string | null): Promise<CareSummary | null> {
  if (!memberId) return null;
  const { readings } = await getCare(memberId);
  const temp = readings.find((r) => r.marker_key === "temperature");
  return {
    memberId,
    temp: temp ? `${fmtValue(temp.value)} °F` : null,
  };
}
