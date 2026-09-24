import type { Metadata } from "next";
import { ForgotPasswordSentScreen } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordSentPage() {
  return <ForgotPasswordSentScreen />;
}
