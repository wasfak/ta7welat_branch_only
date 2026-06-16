import { NextResponse } from "next/server";
import { buildAdminCookie } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    adminId?: string;
    password?: string;
  } | null;

  const adminId = body?.adminId?.trim();
  const password = body?.password;

  if (
    adminId !== process.env.ADMIN_ID ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": buildAdminCookie() } },
  );
}
