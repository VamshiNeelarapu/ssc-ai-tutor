import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISyllabusNode extends Document {
  name: string;
  slug: string;
  parentId: string | null;
  nodeType: "subject" | "section" | "topic";
  order: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SyllabusNodeSchema = new Schema<ISyllabusNode>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    parentId: {
      type: String,
      default: null,
      ref: "SyllabusNode",
    },
    nodeType: {
      type: String,
      enum: ["subject", "section", "topic"],
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

SyllabusNodeSchema.index({ parentId: 1 });

const SyllabusNode: Model<ISyllabusNode> =
  mongoose.models.SyllabusNode ||
  mongoose.model<ISyllabusNode>("SyllabusNode", SyllabusNodeSchema);

export default SyllabusNode;
