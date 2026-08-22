"use server";

import { revalidatePath } from "next/cache";
import { persistActiveVentureSelection } from "@/modules/ventures/select";

export async function selectVentureAction(ventureId: string) {
  const selected = await persistActiveVentureSelection(ventureId);
  if (!selected) {
    return;
  }

  revalidatePath("/", "layout");
}
