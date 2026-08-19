"use client";

import { useParams } from "next/navigation";

export function useVentureId() {
  const params = useParams<{ ventureId?: string }>();
  return params.ventureId;
}
