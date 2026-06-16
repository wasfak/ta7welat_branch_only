import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, ADMIN_COOKIE } from "@/lib/session";

const BRANCH_PUBLIC = ["/login", "/api/auth/login"];
const ADMIN_PUBLIC = ["/adm/login", "/api/admin/auth/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── admin routes (/adm/*) ─────────────────────────────────────────────────
  if (pathname.startsWith("/adm")) {
    if (ADMIN_PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
    const adminSession = req.cookies.get(ADMIN_COOKIE)?.value;
    if (adminSession !== "1") {
      const url = req.nextUrl.clone();
      url.pathname = "/adm/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── admin API ─────────────────────────────────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    if (ADMIN_PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
    const adminSession = req.cookies.get(ADMIN_COOKIE)?.value;
    if (adminSession !== "1") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // ── branch routes (everything else) ──────────────────────────────────────
  if (BRANCH_PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|.*\\.svg).*)"] };
