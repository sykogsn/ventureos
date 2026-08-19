import type { IsoDateTime, VentureId } from "../shared";

export type FounderIdentity = {
  id: string;
  name: string;
  title: string;
  posture: string;
  worldLine: string;
};

export type CompanyIdentity = {
  id: VentureId;
  slug: string;
  name: string;
  href: string;
  foundedAt: IsoDateTime;
  category: string;
  stage: string;
  owner: string;
  hqSummary: string;
};
