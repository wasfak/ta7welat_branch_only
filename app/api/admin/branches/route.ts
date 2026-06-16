import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Branch } from "@/lib/models/branch";

// GET — list all branches
export async function GET() {
  await connectDB();
  const branches = await Branch.find({}, { passwordHash: 0 }).sort({ name: 1 }).lean();
  return NextResponse.json({ branches });
}

// POST — create or update a branch (upsert by branchId)
// Body: { branchId, name, password }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    branchId?: string;
    name?: string;
    password?: string;
  } | null;

  const branchId = body?.branchId?.trim();
  const name = body?.name?.trim();
  const password = body?.password?.trim();

  if (!branchId || !name || !password)
    return NextResponse.json(
      { error: "branchId, name, and password are required" },
      { status: 400 },
    );

  const passwordHash = await bcrypt.hash(password, 10);
  await connectDB();
  await Branch.findOneAndUpdate(
    { branchId },
    { branchId, name, passwordHash },
    { upsert: true, new: true },
  );

  return NextResponse.json({ ok: true });
}

// PATCH — update name and/or password for an existing branch
// Body: { branchId, name?, password? }
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    branchId?: string;
    name?: string;
    password?: string;
  } | null;

  const branchId = body?.branchId?.trim();
  if (!branchId)
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  const update: Record<string, string> = {};
  if (body?.name?.trim()) update.name = body.name.trim();
  if (body?.password?.trim()) update.passwordHash = await bcrypt.hash(body.password.trim(), 10);

  if (!Object.keys(update).length)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  await connectDB();
  const branch = await Branch.findOneAndUpdate({ branchId }, { $set: update }, { new: true });
  if (!branch)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE — remove a branch
// Body: { branchId }
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { branchId?: string } | null;
  const branchId = body?.branchId?.trim();
  if (!branchId)
    return NextResponse.json({ error: "branchId is required" }, { status: 400 });

  await connectDB();
  const res = await Branch.deleteOne({ branchId });
  if (!res.deletedCount)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
