import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICurrentAffairsExplanation extends Document {
  userId: string;
  key: string;
  point: string;
  content: string;
  aiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CurrentAffairsExplanationSchema = new Schema<ICurrentAffairsExplanation>(
  {
    userId: { type: String, required: true },
    key: { type: String, required: true },
    point: { type: String, required: true },
    content: { type: String, required: true },
    aiModel: { type: String },
  },
  { timestamps: true }
);

CurrentAffairsExplanationSchema.index({ userId: 1, key: 1 }, { unique: true });

const CurrentAffairsExplanation: Model<ICurrentAffairsExplanation> =
  mongoose.models.CurrentAffairsExplanation ||
  mongoose.model<ICurrentAffairsExplanation>(
    "CurrentAffairsExplanation",
    CurrentAffairsExplanationSchema
  );

export default CurrentAffairsExplanation;
