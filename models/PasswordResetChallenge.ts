import mongoose, { Document, Model, Schema } from "mongoose";

export interface IPasswordResetChallenge extends Document {
  destination: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  nextAllowedAt: Date;
  attempts: number;
  usedAt: Date | null;
}

const PasswordResetChallengeSchema = new Schema<IPasswordResetChallenge>(
  {
    destination: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    nextAllowedAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PasswordResetChallengeSchema.index({ destination: 1 }, { unique: true });
PasswordResetChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetChallenge: Model<IPasswordResetChallenge> =
  mongoose.models.PasswordResetChallenge ||
  mongoose.model<IPasswordResetChallenge>("PasswordResetChallenge", PasswordResetChallengeSchema);

export default PasswordResetChallenge;
