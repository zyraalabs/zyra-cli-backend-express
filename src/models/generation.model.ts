import mongoose, { Document, Schema } from "mongoose";

export interface IGeneration extends Document {
  userId: string;
  prompt: string;
  framework: string;
  filesGenerated: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  projectName: string;
  createdAt: Date;
}

const generationSchema = new Schema<IGeneration>(
  {
    userId:         { type: String, required: true, index: true },
    prompt:         { type: String, required: true },
    framework:      { type: String, required: true },
    filesGenerated: { type: Number, default: 0 },
    inputTokens:    { type: Number, default: 0 },
    outputTokens:   { type: Number, default: 0 },
    durationMs:     { type: Number, default: 0 },
    projectName:    { type: String, default: "" },
  },
  { timestamps: true }
);

export const Generation =
  mongoose.models.Generation ||
  mongoose.model<IGeneration>("Generation", generationSchema);
