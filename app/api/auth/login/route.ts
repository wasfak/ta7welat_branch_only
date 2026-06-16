import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Branch } from "@/lib/models/branch";
import { buildSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    branchId?: string;
    password?: string;
  } | null;

  const branchId = body?.branchId?.trim();
  const password = body?.password;

  if (!branchId || !password)
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });

  await connectDB();
  const branch = await Branch.findOne({ branchId }).lean();

  if (!branch || !(await bcrypt.compare(password, branch.passwordHash)))
    return NextResponse.json({ error: "Invalid ID or password" }, { status: 401 });

  return NextResponse.json(
    { ok: true, branchId: branch.branchId, name: branch.name },
    { headers: { "Set-Cookie": buildSessionCookie(branch.branchId) } },
  );
}
