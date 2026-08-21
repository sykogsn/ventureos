import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { authSecretKey } from "@/lib/auth/session-token";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type GoogleOAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  remember: boolean;
};

export type GoogleProfile = {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

function base64Url(bytes: Buffer) {
  return bytes.toString("base64url");
}

export function googleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createOAuthStateValue() {
  return base64Url(randomBytes(24));
}

export async function signOAuthState(payload: GoogleOAuthState) {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(authSecretKey());
}

export async function readOAuthState(token: string): Promise<GoogleOAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    if (
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.verifier !== "string" ||
      typeof payload.next !== "string"
    ) {
      return null;
    }

    return {
      state: payload.state,
      nonce: payload.nonce,
      verifier: payload.verifier,
      next: payload.next,
      remember: payload.remember === true,
    };
  } catch {
    return null;
  }
}

export async function signGoogleLink(payload: {
  subject: string;
  email: string;
  name: string;
}) {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(authSecretKey());
}

export async function readGoogleLink(token: string) {
  try {
    const { payload } = await jwtVerify(token, authSecretKey());
    if (
      typeof payload.subject !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }

    return {
      subject: payload.subject,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export function googleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  challenge: string;
}) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  url.searchParams.set("code_challenge", input.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
  verifier: string;
}) {
  const body = new URLSearchParams({
    code: input.code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.verifier,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  const json = (await response.json()) as { id_token?: string };
  if (!json.id_token) {
    throw new Error("Google did not return an ID token.");
  }

  return json.id_token;
}

export async function readGoogleProfile(idToken: string, nonce: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  if (payload.nonce !== nonce) {
    throw new Error("Google nonce did not match.");
  }

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Google profile was incomplete.");
  }

  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : payload.email.split("@")[0] ?? "Founder";

  return {
    subject: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name,
  };
}
