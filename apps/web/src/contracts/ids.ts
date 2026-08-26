export type UserId = string & { readonly __brand: "UserId" };
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type VentureId = string & { readonly __brand: "VentureId" };
export type AgentId = string & { readonly __brand: "AgentId" };
export type AgentDefinitionId = string & { readonly __brand: "AgentDefinitionId" };
export type AgentInstanceId = string & { readonly __brand: "AgentInstanceId" };
export type DocumentId = string & { readonly __brand: "DocumentId" };
export type EventId = string & { readonly __brand: "EventId" };
export type JobId = string & { readonly __brand: "JobId" };
export type WorkforceRunId = string & { readonly __brand: "WorkforceRunId" };
export type WorkflowRunId = string & { readonly __brand: "WorkflowRunId" };
export type NotificationId = string & { readonly __brand: "NotificationId" };

export type Actor = {
  userId: UserId;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
};
