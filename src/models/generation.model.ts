import mongoose, { Document, Schema } from "mongoose";

export interface IReprompt {
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  filesChanged: number;
  createdAt: Date;
}

export interface IGeneration extends Document {
  userId: string;
  prompt: string;
  framework: string;
  filesGenerated: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  projectName: string;
  reprompts: IReprompt[];
  createdAt: Date;
}

const repromptSchema = new Schema<IReprompt>(
  {
    prompt:       { type: String, required: true },
    inputTokens:  { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    durationMs:   { type: Number, default: 0 },
    filesChanged: { type: Number, default: 0 },
    createdAt:    { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    reprompts:      { type: [repromptSchema], default: [] },
  },
  { timestamps: true }
);

export const Generation =
  mongoose.models.Generation ||
  mongoose.model<IGeneration>("Generation", generationSchema);
