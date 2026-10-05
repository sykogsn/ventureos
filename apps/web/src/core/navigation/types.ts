import type { ReactNode } from "react";

export type EntityNavigationDestination = string | null | undefined;

export type EntityTrailItem = {
  key: string;
  label: ReactNode;
  href?: EntityNavigationDestination;
  current?: boolean;
};
