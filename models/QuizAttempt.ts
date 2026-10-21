import mongoose, { Document, Model, Schema } from "mongoose";

export interface IQuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  userAnswerIndex?: number;
}

export interface IQuizAttempt extends Document {
  userId: string;
  noteId: string;
  questions: IQuizQuestion[];
  score: number;
  totalQuestions: number;
  completedAt: Date;
  createdAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String, required: true },
    userAnswerIndex: { type: Number },
  },
  { _id: false }
);

const QuizAttemptSchema = new Schema<IQuizAttempt>(
  {
    userId: {
      type: String,
      required: true,
      ref: "User",
    },
    noteId: {
      type: String,
      required: true,
      ref: "StudyNote",
    },
    questions: {
      type: [QuizQuestionSchema],
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

QuizAttemptSchema.index({ userId: 1 });
QuizAttemptSchema.index({ noteId: 1 });
QuizAttemptSchema.index({ userId: 1, noteId: 1 });

const QuizAttempt: Model<IQuizAttempt> =
  mongoose.models.QuizAttempt ||
  mongoose.model<IQuizAttempt>("QuizAttempt", QuizAttemptSchema);

export default QuizAttempt;
