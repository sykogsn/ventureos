import type { Metadata } from "next";
import Link from "next/link";
import {
  ExecutiveDocument,
  ExecutiveFit,
  ExecutiveStack,
} from "@/core/layout";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordSentPage() {
  return (
    <ExecutiveStack gap="section">
      <ExecutiveDocument
        kicker="Authentication"
        title="Forgot password"
        description="If an account exists for that email, a reset link is on its way. The link expires in one hour."
      />
      <ExecutiveFit>
        <Link href="/login" className="vos-btn-primary">
          Return to sign in
        </Link>
      </ExecutiveFit>
    </ExecutiveStack>
  );
}
