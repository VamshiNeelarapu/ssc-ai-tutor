import mongoose, { Document, Model, Schema } from "mongoose";

export type RevisionStatus = "not_started" | "learning" | "needs_revision" | "revised";
export type ExamRelevance = "tier1" | "tier2" | "ckt" | "dest" | "stats" | "finance";

export interface ICoreConcept {
  heading: string;
  body: string;
}

export interface IMCQ {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  sourceStatus: "verified" | "unverified" | "generated";
}

export interface IWorkedExample {
  question: string;
  approach?: string;
  steps?: string[];
}

export interface IReference {
  title: string;
  url?: string;
  publisher?: string;
  verificationStatus: "verified" | "unverified";
}

export interface IStudyNoteContent {
  overview?: string;
  coreConcepts: ICoreConcept[];
  keyFacts: string[];
  shortcuts: string[];
  revisionTips: string[];
  commonConfusions: string[];
  mcqs: IMCQ[];
  workedExamples: IWorkedExample[];
  references: IReference[];
}

export interface IStudyNote extends Document {
  userId: string;
  title: string;
  subjectId?: string;
  sectionId?: string;
  topicId?: string;
  examRelevance: ExamRelevance[];
  content: IStudyNoteContent;
  revisionStatus: RevisionStatus;
  sourceConversationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CoreConceptSchema = new Schema<ICoreConcept>(
  {
    heading: { type: String, required: true },
    body: { type: String, required: true },
  },
  { _id: false }
);

const MCQSchema = new Schema<IMCQ>(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String, required: true },
    sourceStatus: {
      type: String,
      enum: ["verified", "unverified", "generated"],
      default: "generated",
    },
  },
  { _id: false }
);

const WorkedExampleSchema = new Schema<IWorkedExample>(
  {
    question: { type: String, required: true },
    approach: { type: String },
    steps: { type: [String] },
  },
  { _id: false }
);

const ReferenceSchema = new Schema<IReference>(
  {
    title: { type: String, required: true },
    url: { type: String },
    publisher: { type: String },
    verificationStatus: {
      type: String,
      enum: ["verified", "unverified"],
      required: true,
    },
  },
  { _id: false }
);

const StudyNoteContentSchema = new Schema<IStudyNoteContent>(
  {
    overview: { type: String },
    coreConcepts: { type: [CoreConceptSchema], default: [] },
    keyFacts: { type: [String], default: [] },
    shortcuts: { type: [String], default: [] },
    revisionTips: { type: [String], default: [] },
    commonConfusions: { type: [String], default: [] },
    mcqs: { type: [MCQSchema], default: [] },
    workedExamples: { type: [WorkedExampleSchema], default: [] },
    references: { type: [ReferenceSchema], default: [] },
  },
  { _id: false }
);

const StudyNoteSchema = new Schema<IStudyNote>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subjectId: {
      type: String,
      ref: "SyllabusNode",
    },
    sectionId: {
      type: String,
      ref: "SyllabusNode",
    },
    topicId: {
      type: String,
      ref: "SyllabusNode",
    },
    examRelevance: {
      type: [String],
      enum: ["tier1", "tier2", "ckt", "dest", "stats", "finance"],
      default: ["tier1"],
    },
    content: {
      type: StudyNoteContentSchema,
      required: true,
    },
    revisionStatus: {
      type: String,
      enum: ["not_started", "learning", "needs_revision", "revised"],
      default: "not_started",
    },
    sourceConversationId: {
      type: String,
      ref: "Conversation",
    },
  },
  {
    timestamps: true,
  }
);

StudyNoteSchema.index({ userId: 1 });
StudyNoteSchema.index({ userId: 1, subjectId: 1 });
StudyNoteSchema.index({ userId: 1, revisionStatus: 1 });
StudyNoteSchema.index({ title: "text", "content.overview": "text" });

const StudyNote: Model<IStudyNote> =
  mongoose.models.StudyNote ||
  mongoose.model<IStudyNote>("StudyNote", StudyNoteSchema);

export default StudyNote;
