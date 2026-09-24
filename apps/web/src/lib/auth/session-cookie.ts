const cookieBase = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function sessionCookieOptions(remember: boolean) {
  return {
    ...cookieBase,
    ...(remember ? { maxAge: 60 * 60 * 24 * 14 } : {}),
  };
}

export function expiredAuthCookieOptions() {
  return {
    ...cookieBase,
    maxAge: 0,
  };
}
