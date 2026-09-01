export type {
  ApiResult,
  UserId,
  VentureId,
  WorkspaceId,
  AgentId,
  StoredObjectId,
} from "@/contracts";

import type { UserId, VentureId } from "@/contracts";

export type User = {
  id: UserId;
  email: string;
  name: string;
};

export type Venture = {
  id: VentureId;
  name: string;
  workspaceId: string;
};

export type AuthSession = {
  user: User;
};
