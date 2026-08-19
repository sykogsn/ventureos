export function resolveVentureProjectionWorkspace(input: {
  ventureWorkspaceId: string | null;
  cookieWorkspaceId: string | null;
}): string | null {
  return input.ventureWorkspaceId;
}
