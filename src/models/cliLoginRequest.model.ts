import mongoose, { Document, Schema } from "mongoose";

export interface ICliLoginRequest extends Document {
  requestId: string;
  status: "pending" | "approved" | "expired";
  userId?: string;
  token?: string;
  createdAt: Date;
  expiresAt: Date;
}

const cliLoginRequestSchema = new Schema<ICliLoginRequest>(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "expired"],
      default: "pending",
    },
    userId: {
      type: String,
    },
    token: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

cliLoginRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CliLoginRequest =
  mongoose.models.CliLoginRequest ||
  mongoose.model<ICliLoginRequest>("CliLoginRequest", cliLoginRequestSchema);
