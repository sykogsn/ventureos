export type GoogleSignInDecision =
  | { action: "sign-in"; userId: string }
  | { action: "create" }
  | { action: "link-after-password"; userId: string }
  | { action: "reject"; reason: "unverified-email" | "email-in-use" };

export function decideGoogleSignIn(input: {
  emailVerified: boolean;
  googleSubjectOwnerId: string | null;
  emailOwner: { id: string; hasPasswordIdentity: boolean } | null;
}): GoogleSignInDecision {
  if (!input.emailVerified) {
    return { action: "reject", reason: "unverified-email" };
  }

  if (input.googleSubjectOwnerId) {
    return { action: "sign-in", userId: input.googleSubjectOwnerId };
  }

  if (!input.emailOwner) {
    return { action: "create" };
  }

  if (input.emailOwner.hasPasswordIdentity) {
    return { action: "link-after-password", userId: input.emailOwner.id };
  }

  return { action: "reject", reason: "email-in-use" };
}
