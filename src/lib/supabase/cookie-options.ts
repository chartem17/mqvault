/** The session lives only in httpOnly cookies: browser scripts never see the tokens (ADR 0017). */
export const SESSION_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
