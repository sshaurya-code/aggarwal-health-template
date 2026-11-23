import { logout } from "@/app/actions";
import { LargeTitle, Page, Section } from "@/components/ui";
import { getMembers } from "@/lib/data";
import { pushEnabled } from "@/lib/push";
import { Backup, Reminders } from "./client";

export default async function SettingsPage() {
  const members = await getMembers();
  return (
    <Page>
      <LargeTitle title="Settings" />
      <Section
        title="Reminders"
        icon={{ color: "#ff3b30", icon: "M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0" }}
        footer="Checked every morning around 9. You'll get a notification as an ID nears expiry, a policy comes up for renewal, a warranty or return window is ending, or a test is due."
      >
        {pushEnabled() ? (
          <Reminders members={members.map((m) => ({ id: m.id, name: m.name }))} vapidKey={process.env.VAPID_PUBLIC_KEY!} />
        ) : (
          <p className="px-4 py-3 text-[15px] text-ink2">Notifications aren&apos;t set up on the server yet (missing VAPID keys).</p>
        )}
      </Section>
      <Section
        title="Backup"
        icon={{ color: "#34c759", icon: "M12 3v12M7 10l5 5 5-5M5 21h14" }}
        footer="Saves every document and record as one zip. Keep a copy in iCloud Drive or Google Drive every few months."
      >
        <Backup />
      </Section>
      <form action={logout} className="mt-7">
        <button className="tap card h-[50px] w-full rounded-2xl bg-card text-[17px] font-semibold text-bad">Lock app</button>
      </form>
    </Page>
  );
}
