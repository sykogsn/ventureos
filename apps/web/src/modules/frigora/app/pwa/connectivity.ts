import { isFrigoraFieldPath } from "./paths";

export function shouldBlockFrigoraFieldMutation(
  online: boolean,
  pathname: string,
): boolean {
  return !online && isFrigoraFieldPath(pathname);
}
