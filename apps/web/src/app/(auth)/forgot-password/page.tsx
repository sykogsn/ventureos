import type { Metadata } from "next";
import { ForgotPasswordScreen } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
