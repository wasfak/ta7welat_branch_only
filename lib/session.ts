export const SESSION_COOKIE = "branch_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function cookieOptions(maxAge = SESSION_MAX_AGE) {
  return [
    `${SESSION_COOKIE}=`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildSessionCookie(branchId: string) {
  return [
    `${SESSION_COOKIE}=${branchId}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ].join("; ");
}

export function getBranchIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v ?? null;
  }
  return null;
}

// ── Admin session ────────────────────────────────────────────────────────────
export const ADMIN_COOKIE = "adm_session";

export function buildAdminCookie() {
  return [
    `${ADMIN_COOKIE}=1`,
    `Max-Age=${SESSION_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAdminCookie() {
  return [`${ADMIN_COOKIE}=`, "Max-Age=0", "Path=/", "HttpOnly", "SameSite=Lax"].join("; ");
}

export function isAdminFromCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === ADMIN_COOKIE) return v === "1";
  }
  return false;
}
