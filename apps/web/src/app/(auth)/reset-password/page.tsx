import type { Metadata } from "next";
import { ResetPasswordMissingScreen, ResetPasswordScreen } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return <ResetPasswordMissingScreen />;
  }

  return <ResetPasswordScreen token={token} />;
}
