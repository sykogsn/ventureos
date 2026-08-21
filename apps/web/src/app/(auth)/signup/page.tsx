import type { Metadata } from "next";
import { SignupScreen } from "@/modules/auth";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return <SignupScreen />;
}
