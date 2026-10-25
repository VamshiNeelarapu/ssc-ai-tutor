import mongoose, { Document, Model, Schema } from "mongoose";

export type FlashcardLevel = "chapter" | "topic";

export interface IFlashcard {
  front: string;
  back: string;
  topic?: string;
  tag?: string;
}

export interface IFlashcardSet extends Document {
  userId: string;
  level: FlashcardLevel;
  sectionId: string;
  topicId?: string;
  subjectId?: string;
  title: string;
  cards: IFlashcard[];
  createdAt: Date;
  updatedAt: Date;
}

const FlashcardSchema = new Schema<IFlashcard>(
  {
    front: { type: String, required: true },
    back: { type: String, required: true },
    topic: { type: String },
    tag: { type: String },
  },
  { _id: false }
);

const FlashcardSetSchema = new Schema<IFlashcardSet>(
  {
    userId: { type: String, required: true, ref: "User" },
    level: { type: String, enum: ["chapter", "topic"], required: true },
    sectionId: { type: String, required: true, ref: "SyllabusNode" },
    topicId: { type: String, ref: "SyllabusNode" },
    subjectId: { type: String, ref: "SyllabusNode" },
    title: { type: String, required: true, trim: true },
    cards: { type: [FlashcardSchema], default: [] },
  },
  { timestamps: true }
);

// One set per user and chapter, and one per user and topic (regenerating replaces it)
FlashcardSetSchema.index(
  { userId: 1, sectionId: 1 },
  { unique: true, partialFilterExpression: { level: "chapter" } }
);
FlashcardSetSchema.index(
  { userId: 1, topicId: 1 },
  { unique: true, partialFilterExpression: { level: "topic" } }
);

const FlashcardSet: Model<IFlashcardSet> =
  mongoose.models.FlashcardSet ||
  mongoose.model<IFlashcardSet>("FlashcardSet", FlashcardSetSchema);

export default FlashcardSet;
