import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { aiErrorResponse, aiNotConfiguredResponse, aiRateLimitResponse } from "@/lib/ai-errors";
import { generatePracticeAnswers, generateQuickRevision } from "@/lib/ai";
import { parseAnswerKey, parseNotesDocument } from "@/lib/notes-import";

// Follow-up actions on a note made from pasted content
const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quick-revision-generate"), model: z.string().max(100).optional() }),
  z.object({ action: z.literal("quick-revision-save"), text: z.string().min(1).max(200_000) }),
  z.object({ action: z.literal("answer-key"), key: z.string().min(1).max(20_000) }),
  z.object({ action: z.literal("answers-ai"), model: z.string().max(100).optional() }),
]);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const validation = ActionSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);
    const body = validation.data;

    if (!mongoose.isValidObjectId(params.id)) return apiError("Note not found", 404);
    await connectToDatabase();

    const note = await StudyNote.findOne({ _id: params.id, userId: session.userId });
    if (!note || !note.content.markdown) return apiError("Note not found", 404);
    const content = note.content;

    // AI actions: same limits and errors as the other AI features
    const usesAI = body.action === "quick-revision-generate" || body.action === "answers-ai";
    if (usesAI) {
      const limit = aiRateLimit(session.userId);
      if (!limit.success) return aiRateLimitResponse();
      if (!process.env.AI_API_KEY) return aiNotConfiguredResponse();
    }

    if (body.action === "quick-revision-save") {
      const markdown = parseNotesDocument(body.text, { extractRevision: false }).fullMarkdown;
      if (!markdown) return apiError("Nothing to save", 400);
      content.quickRevisionMarkdown = markdown;
      note.markModified("content");
      await note.save();
      return apiSuccess({ quickRevisionMarkdown: markdown });
    }

    if (body.action === "quick-revision-generate") {
      let markdown: string;
      try {
        markdown = await generateQuickRevision(content.markdown!, body.model);
      } catch (err) {
        console.error("Quick revision error:", err);
        return aiErrorResponse(err, body.model);
      }
      content.quickRevisionMarkdown = markdown;
      note.markModified("content");
      await note.save();
      return apiSuccess({ quickRevisionMarkdown: markdown });
    }

    const questions = content.practiceQuestions ?? [];
    if (questions.length === 0) return apiError("This note has no practice questions", 400);

    if (body.action === "answer-key") {
      const key = parseAnswerKey(body.key, questions.length);
      const found = Object.keys(key).length;
      if (found === 0) return apiError("Could not read any answers. Use a format like: 1-B, 2-C, 3-A", 400);
      questions.forEach((q, i) => {
        const idx = key[i + 1];
        if (idx !== undefined && idx < q.options.length) {
          q.correctOptionIndex = idx;
          q.answerSource = "pasted";
        }
      });
      note.markModified("content");
      await note.save();
      return apiSuccess({ practiceQuestions: questions, applied: found });
    }

    // answers-ai: only for the questions that still have no answer
    const missing = questions
      .map((q, i) => ({ n: i + 1, question: q.question, options: q.options, has: q.correctOptionIndex !== undefined }))
      .filter((q) => !q.has);
    if (missing.length === 0) return apiSuccess({ practiceQuestions: questions, applied: 0 });

    let answers;
    try {
      answers = await generatePracticeAnswers(content.markdown!, missing, body.model);
    } catch (err) {
      console.error("Practice answers error:", err);
      return aiErrorResponse(err, body.model);
    }
    for (const a of answers) {
      const q = questions[a.n - 1];
      if (!q || q.correctOptionIndex !== undefined) continue;
      q.correctOptionIndex = a.answerIndex;
      if (a.explanation) q.explanation = a.explanation;
      q.answerSource = "ai";
    }
    note.markModified("content");
    await note.save();
    return apiSuccess({ practiceQuestions: questions, applied: answers.length, asked: missing.length });
  } catch (error) {
    return handleApiError(error);
  }
}
