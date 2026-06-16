import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TransferPlan } from "@/lib/models/transfer-plan";
import { getBranchIdFromCookie } from "@/lib/session";
import { Branch } from "@/lib/models/branch";

// GET /api/moves — return all tarsed-done moves for the logged-in branch
export async function GET(req: Request) {
  const branchId = getBranchIdFromCookie(req.headers.get("cookie"));
  if (!branchId)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectDB();

  // resolve branchId -> clean branch name (what's stored in TransferPlan rows)
  const branch = await Branch.findOne({ branchId }).lean();
  if (!branch)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  const branchName = branch.name;

  // fetch plans that have at least one tarsed-done row with this branch as source
  const plans = await TransferPlan.find({ "rows.tarsedDone": true, "rows.from": branchName })
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  type Move = {
    planId: string;
    rowIndex: number;
    destIndex: number;
    code: string;
    name: string;
    dest: string;
    qty: number;
    done: boolean;
    skipped: boolean;
    note: string;
    createdAt: string;
  };

  const moves: Move[] = [];
  for (const plan of plans) {
    plan.rows.forEach((row, rowIndex) => {
      if (row.from !== branchName || !row.tarsedDone) return;
      row.dests.forEach((dest, destIndex) => {
        moves.push({
          planId: String(plan._id),
          rowIndex,
          destIndex,
          code: row.code,
          name: row.name,
          dest: dest.branch,
          qty: dest.qty,
          done: !!dest.transferDone,
          skipped: !!dest.skipped,
          note: dest.note ?? "",
          createdAt: plan.createdAt ? new Date(plan.createdAt).toISOString() : "",
        });
      });
    });
  }

  return NextResponse.json({ branchName, moves });
}

// PATCH /api/moves — mark transfer done or skip
type Update = {
  planId: string;
  rowIndex: number;
  destIndex: number;
  value?: boolean;
  skipped?: boolean;
  note?: string;
};

export async function PATCH(req: Request) {
  const branchId = getBranchIdFromCookie(req.headers.get("cookie"));
  if (!branchId)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await connectDB();
  const branch = await Branch.findOne({ branchId }).lean();
  if (!branch)
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });

  const branchName = branch.name;

  const body = (await req.json().catch(() => null)) as { updates?: Update[] } | null;
  const updates = body?.updates;
  if (!Array.isArray(updates) || !updates.length)
    return NextResponse.json({ error: "No updates" }, { status: 400 });

  const ops = [];
  const now = new Date();

  for (const u of updates) {
    if (!u?.planId || typeof u.rowIndex !== "number" || typeof u.destIndex !== "number")
      continue;

    if (u.skipped !== undefined) {
      // skip / undo skip
      ops.push({
        updateOne: {
          filter: { _id: u.planId, [`rows.${u.rowIndex}.from`]: branchName },
          update: {
            $set: {
              [`rows.${u.rowIndex}.dests.${u.destIndex}.skipped`]: u.skipped,
              [`rows.${u.rowIndex}.dests.${u.destIndex}.skippedAt`]: u.skipped ? now : null,
              [`rows.${u.rowIndex}.dests.${u.destIndex}.skippedBy`]: u.skipped ? branchName : null,
              [`rows.${u.rowIndex}.dests.${u.destIndex}.note`]: u.skipped ? (u.note ?? "") : "",
            },
          },
        },
      });
    } else {
      // mark transfer done
      const value = !!u.value;
      ops.push({
        updateOne: {
          filter: { _id: u.planId, [`rows.${u.rowIndex}.from`]: branchName },
          update: {
            $set: {
              [`rows.${u.rowIndex}.dests.${u.destIndex}.transferDone`]: value,
              [`rows.${u.rowIndex}.dests.${u.destIndex}.transferDoneAt`]: value ? now : null,
              [`rows.${u.rowIndex}.dests.${u.destIndex}.transferDoneBy`]: value ? branchName : null,
            },
          },
        },
      });
    }
  }

  if (!ops.length)
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });

  const res = await TransferPlan.bulkWrite(ops, { ordered: false });
  return NextResponse.json({ ok: true, modified: res.modifiedCount });
}
