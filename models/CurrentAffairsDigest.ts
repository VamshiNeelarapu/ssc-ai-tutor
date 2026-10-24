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

// One digest per calendar day, shared by every user so the AI only has to run once.
export interface ICurrentAffairsDigest extends Document {
  date: string;
  monthKey: string;
  items: ICurrentAffairsItem[];
  coveredUrls: string[];
  /** Users who added this day to their own monthly note. */
  savedBy: string[];
  generatedBy?: string;
  aiModel?: string;
  lastCheckedAt?: Date;
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
    date: { type: String, required: true },
    monthKey: { type: String, required: true },
    items: { type: [ItemSchema], default: [] },
    coveredUrls: { type: [String], default: [] },
    savedBy: { type: [String], default: [] },
    generatedBy: { type: String },
    aiModel: { type: String },
    lastCheckedAt: { type: Date },
  },
  { timestamps: true }
);

CurrentAffairsDigestSchema.index({ date: 1 }, { unique: true });
CurrentAffairsDigestSchema.index({ monthKey: 1 });

const CurrentAffairsDigest: Model<ICurrentAffairsDigest> =
  mongoose.models.CurrentAffairsDigest ||
  mongoose.model<ICurrentAffairsDigest>("CurrentAffairsDigest", CurrentAffairsDigestSchema);

export default CurrentAffairsDigest;
