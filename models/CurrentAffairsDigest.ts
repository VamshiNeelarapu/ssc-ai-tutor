import mongoose, { Document, Model, Schema } from "mongoose";
import { CA_CATEGORY_IDS } from "@/lib/current-affairs-config";

export interface ICurrentAffairsItem {
  point: string;
  category: string;
  division: "gs" | "static";
  staticLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
}

export interface ICurrentAffairsDigest extends Document {
  userId: string;
  date: string;
  monthKey: string;
  items: ICurrentAffairsItem[];
  coveredUrls: string[];
  inMonthly: boolean;
  aiModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<ICurrentAffairsItem>(
  {
    point: { type: String, required: true, trim: true },
    category: { type: String, enum: CA_CATEGORY_IDS, required: true },
    division: { type: String, enum: ["gs", "static"], required: true },
    staticLink: { type: String, trim: true },
    sourceTitle: { type: String },
    sourceUrl: { type: String },
    sourcePublisher: { type: String },
  },
  { _id: false }
);

const CurrentAffairsDigestSchema = new Schema<ICurrentAffairsDigest>(
  {
    userId: { type: String, required: true },
    date: { type: String, required: true },
    monthKey: { type: String, required: true },
    items: { type: [ItemSchema], default: [] },
    coveredUrls: { type: [String], default: [] },
    inMonthly: { type: Boolean, default: false },
    aiModel: { type: String },
  },
  { timestamps: true }
);

CurrentAffairsDigestSchema.index({ userId: 1, date: 1 }, { unique: true });
CurrentAffairsDigestSchema.index({ userId: 1, monthKey: 1 });

const CurrentAffairsDigest: Model<ICurrentAffairsDigest> =
  mongoose.models.CurrentAffairsDigest ||
  mongoose.model<ICurrentAffairsDigest>("CurrentAffairsDigest", CurrentAffairsDigestSchema);

export default CurrentAffairsDigest;
