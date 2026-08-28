import type { UserId, VentureId, WorkspaceId } from "@/contracts";

export type FrigoraCustomerId = string & { readonly __brand: "FrigoraCustomerId" };
export type FrigoraSiteId = string & { readonly __brand: "FrigoraSiteId" };
export type FrigoraAssetId = string & { readonly __brand: "FrigoraAssetId" };

export type FrigoraCustomerStatus = "active" | "archived";
export type FrigoraSiteStatus = "active" | "archived";
export type FrigoraAssetStatus = "active" | "decommissioned";

export const FRIGORA_ASSET_KINDS = [
  "display_freezer",
  "cold_room",
  "condensing_unit",
  "evaporator",
  "packaged_unit",
  "cabinet",
  "other",
] as const;

export type FrigoraAssetKind = (typeof FRIGORA_ASSET_KINDS)[number];

export type FrigoraScope = {
  userId: UserId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
};

export type FrigoraCustomer = {
  id: FrigoraCustomerId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  code: string;
  displayName: string;
  legalName: string | null;
  status: FrigoraCustomerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrigoraSite = {
  id: FrigoraSiteId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  code: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  status: FrigoraSiteStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FrigoraAsset = {
  id: FrigoraAssetId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  siteId: FrigoraSiteId;
  tag: string;
  name: string | null;
  assetKind: FrigoraAssetKind | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  status: FrigoraAssetStatus;
  designTargetCelsius: number | null;
  refrigerantType: string | null;
  locationOnSite: string | null;
  installedOn: string | null;
  commissionedOn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCustomerInput = {
  code: string;
  displayName: string;
  legalName?: string | null;
  notes?: string | null;
};

export type UpdateCustomerInput = {
  code?: string;
  displayName?: string;
  legalName?: string | null;
  notes?: string | null;
};

export type CreateSiteInput = {
  customerId: string;
  code: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
};

export type UpdateSiteInput = {
  code?: string;
  name?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
};

export type CreateAssetInput = {
  siteId: string;
  tag: string;
  name?: string | null;
  assetKind?: FrigoraAssetKind | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  designTargetCelsius?: number | null;
  refrigerantType?: string | null;
  locationOnSite?: string | null;
  installedOn?: string | null;
  commissionedOn?: string | null;
  notes?: string | null;
};

export type UpdateAssetInput = {
  siteId?: string;
  tag?: string;
  name?: string | null;
  assetKind?: FrigoraAssetKind | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  designTargetCelsius?: number | null;
  refrigerantType?: string | null;
  locationOnSite?: string | null;
  installedOn?: string | null;
  commissionedOn?: string | null;
  notes?: string | null;
};
