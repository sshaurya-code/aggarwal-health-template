import { notFound } from "next/navigation";
import { deleteMember } from "@/app/actions";
import { ConfirmButton } from "@/components/client";
import { MemberForm } from "@/components/MemberForm";
import { LargeTitle, Page } from "@/components/ui";
import { getMember, getMembers } from "@/lib/data";

export default async function EditMemberPage({ params }: PageProps<"/m/[id]/edit">) {
  const { id } = await params;
  const [member, members] = await Promise.all([getMember(id), getMembers()]);
  if (!member) notFound();
  return (
    <Page>
      <LargeTitle title="Edit profile" back={{ href: `/m/${id}`, label: member.name.split(" ")[0]! }} />
      <MemberForm member={member} members={members} />
      <ConfirmButton
        action={deleteMember.bind(null, id)}
        label="Remove from family"
        confirmLabel="Tap again — deletes all their records"
        className="card mt-3 h-[50px] w-full rounded-2xl bg-card text-[17px] font-semibold"
      />
    </Page>
  );
}
