import mongoose, { Document, Model, Schema } from "mongoose";
import { CA_CATEGORY_IDS } from "@/lib/current-affairs-config";

export interface IImportantPoint extends Document {
  userId: string;
  key: string;
  date: string;
  monthKey: string;
  point: string;
  category: string;
  division: "gs" | "static";
  staticLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
  background?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImportantPointSchema = new Schema<IImportantPoint>(
  {
    userId: { type: String, required: true },
    key: { type: String, required: true },
    date: { type: String, required: true },
    monthKey: { type: String, required: true },
    point: { type: String, required: true, trim: true },
    category: { type: String, enum: CA_CATEGORY_IDS, required: true },
    division: { type: String, enum: ["gs", "static"], required: true },
    staticLink: { type: String, trim: true },
    sourceTitle: { type: String },
    sourceUrl: { type: String },
    sourcePublisher: { type: String },
    background: { type: String },
  },
  { timestamps: true }
);

ImportantPointSchema.index({ userId: 1, key: 1 }, { unique: true });
ImportantPointSchema.index({ userId: 1, date: -1 });

const ImportantPoint: Model<IImportantPoint> =
  mongoose.models.ImportantPoint ||
  mongoose.model<IImportantPoint>("ImportantPoint", ImportantPointSchema);

export default ImportantPoint;
