"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { applyIdsBrand, brandFromDefinitionId } from "@repo/ids/themes/bind";
import { useShell } from "@/core/context/shell-context";

export function IdsBrandBinder() {
  const params = useParams<{ ventureId?: string; slug?: string }>();
  const { ventures, activeVentureId } = useShell();

  useEffect(() => {
    const byId =
      ventures.find((venture) => venture.id === activeVentureId) ??
      (params.ventureId
        ? ventures.find((venture) => venture.id === params.ventureId)
        : undefined);
    const bySlug = params.slug
      ? ventures.find((venture) => venture.slug === params.slug)
      : undefined;
    const venture = byId ?? bySlug;
    applyIdsBrand(
      document.documentElement,
      brandFromDefinitionId(venture?.definitionId),
    );
  }, [activeVentureId, params.slug, params.ventureId, ventures]);

  return null;
}
