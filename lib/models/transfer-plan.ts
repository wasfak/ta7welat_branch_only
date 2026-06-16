import { Schema, model, models } from "mongoose";

const DestSchema = new Schema(
  {
    branch: { type: String, required: true },
    qty: { type: Number, required: true },
    transferDone: { type: Boolean, default: false },
    transferDoneAt: { type: Date, default: null },
    transferDoneBy: { type: String, default: null },
    skipped: { type: Boolean, default: false },
    skippedAt: { type: Date, default: null },
    skippedBy: { type: String, default: null },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const RowSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, default: "" },
    from: { type: String, default: "" },
    keep: { type: Number, default: 0 },
    qty: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    tarsedDone: { type: Boolean, default: false },
    tarsedDoneAt: { type: Date, default: null },
    tarsedDoneBy: { type: String, default: null },
    dests: { type: [DestSchema], default: [] },
  },
  { _id: false },
);

const TransferPlanSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    rows: { type: [RowSchema], required: true },
    rowCount: { type: Number, default: 0 },
    totalUnits: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
  },
  { timestamps: true },
);

TransferPlanSchema.index({ createdAt: -1 });
TransferPlanSchema.index({ "rows.tarsedDone": 1 });

export const TransferPlan =
  models.TransferPlan ?? model("TransferPlan", TransferPlanSchema);
