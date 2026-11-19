import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isFrigoraDirectAccessRequest } from "@/modules/frigora/app/direct-access";
import { FRIGORA_DIRECT_ENTRY_PATH } from "@/modules/frigora/app/pwa/paths";

export default async function RootPage() {
  const headerList = await headers();
  if (
    isFrigoraDirectAccessRequest(
      headerList.get("host"),
      headerList.get("x-forwarded-host"),
    )
  ) {
    redirect(FRIGORA_DIRECT_ENTRY_PATH);
  }

  redirect("/dashboard");
}
