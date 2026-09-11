export function credentialAutocomplete(
  signedOut: boolean,
  kind: "email" | "password",
) {
  if (signedOut) {
    return "off";
  }

  return kind === "email" ? "email" : "current-password";
}
