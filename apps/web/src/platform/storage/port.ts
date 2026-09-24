import type { PermissionService, StoredObjectPort } from "@/contracts";
import type { AuditLog } from "@/platform/audit/log";
import { createStoredObjectService } from "./service";
import type { BlobStorageAdapter } from "./types";

export function createStoredObjectPort(deps: {
  adapter: BlobStorageAdapter;
  audit: AuditLog;
  permissions: PermissionService;
}): StoredObjectPort {
  return createStoredObjectService(deps);
}
