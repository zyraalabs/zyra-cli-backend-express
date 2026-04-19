import mongoose, { Document, Schema, Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  isPremium: boolean;
  plan: string;
  usage: {
    totalBuilds: number;
    remainingTrial: number;
  };
}

const userSchema = new Schema<IUser>(
  {
    email:     { type: String, required: true, unique: true },
    isPremium: { type: Boolean, default: false },
    plan:      { type: String, default: "FREE" },
    usage: {
      totalBuilds:    { type: Number, default: 0 },
      remainingTrial: { type: Number, default: 4 },
    },
  },
  { timestamps: true }
);

const UserModel =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default UserModel as Model<IUser>;
