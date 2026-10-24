import mongoose, { Document, Model, Schema } from "mongoose";

// Shared by every user: a background is generated once per point.
export interface ICurrentAffairsExplanation extends Document {
  key: string;
  point: string;
  content: string;
  generatedBy?: string;
  aiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CurrentAffairsExplanationSchema = new Schema<ICurrentAffairsExplanation>(
  {
    key: { type: String, required: true },
    point: { type: String, required: true },
    content: { type: String, required: true },
    generatedBy: { type: String },
    aiModel: { type: String },
  },
  { timestamps: true }
);

CurrentAffairsExplanationSchema.index({ key: 1 }, { unique: true });

const CurrentAffairsExplanation: Model<ICurrentAffairsExplanation> =
  mongoose.models.CurrentAffairsExplanation ||
  mongoose.model<ICurrentAffairsExplanation>(
    "CurrentAffairsExplanation",
    CurrentAffairsExplanationSchema
  );

export default CurrentAffairsExplanation;
