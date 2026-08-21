import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Not found",
};

export default function AppCatchAll() {
  notFound();
}
