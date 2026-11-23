import { MemberForm } from "@/components/MemberForm";
import { LargeTitle, Page } from "@/components/ui";
import { getMembers } from "@/lib/data";

export default async function NewMemberPage() {
  const members = await getMembers();
  return (
    <Page>
      <LargeTitle title="New member" back={{ href: "/", label: "Family" }} />
      <MemberForm members={members} />
    </Page>
  );
}
