import Link from "next/link";
import { CATEGORY_KINDS, CATEGORY_LABEL, Empty, KIND_LABEL, LargeTitle, Page } from "@/components/ui";
import type { Category } from "@/lib/data";
import { getMembers } from "@/lib/data";
import { Uploader } from "./Uploader";

export default async function UploadPage({ searchParams }: PageProps<"/upload">) {
  const { member, category, kind, vehicle } = await searchParams;
  const members = await getMembers();
  const cat = typeof category === "string" && category in CATEGORY_LABEL ? (category as Category) : member === "household" ? "bill" : "health";
  const k = typeof kind === "string" && CATEGORY_KINDS[cat]?.includes(kind) ? kind : undefined;
  const plate = typeof vehicle === "string" && /^[A-Z0-9]{4,12}$/i.test(vehicle) ? vehicle.toUpperCase() : undefined;
  return (
    <Page>
      <LargeTitle title="Add to the vault" subtitle="Health records, IDs, bills, insurance, car papers and investments" />
      {members.length ? (
        <Uploader
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          initial={member === "household" ? null : typeof member === "string" ? member : members[0]!.id}
          initialCategory={cat}
          preset={{ kind: k, vehicle_no: plate, label: k ? [KIND_LABEL[k], plate].filter(Boolean).join(" · ") : undefined }}
          anon={{ url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }}
        />
      ) : (
        <Empty
          title="Add a family member first"
          body="Every document is filed under someone."
          action={
            <Link href="/m/new" className="tap inline-block rounded-xl bg-accent px-5 py-3 text-[17px] font-semibold text-white">
              Add a family member
            </Link>
          }
        />
      )}
    </Page>
  );
}
