import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordScreen } from "@/modules/auth";
import {
  ExecutiveDocument,
  ExecutiveFit,
  ExecutiveStack,
} from "@/core/layout";

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
    return (
      <ExecutiveStack gap="section">
        <ExecutiveDocument
          kicker="Authentication"
          title="Reset password"
          description="This reset link is missing or invalid."
        />
        <ExecutiveFit>
          <Link href="/forgot-password" className="vos-btn-primary">
            Request a new link
          </Link>
        </ExecutiveFit>
      </ExecutiveStack>
    );
  }

  return <ResetPasswordScreen token={token} />;
}
