"use server";

import { revalidatePath } from "next/cache";
import { db, requireCare } from "@/lib/supabase";

export async function deleteCareReading(memberId: string, id: string) {
  await requireCare(memberId);
  await db().from("readings").delete().eq("id", id).eq("member_id", memberId).eq("source", "manual");
  revalidatePath("/", "layout");
}
