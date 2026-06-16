import { Schema, model, models } from "mongoose";

const BranchSchema = new Schema(
  {
    branchId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const Branch = models.Branch ?? model("Branch", BranchSchema);
