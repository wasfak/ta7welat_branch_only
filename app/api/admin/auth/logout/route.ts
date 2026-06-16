import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/session";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearAdminCookie() } },
  );
}
