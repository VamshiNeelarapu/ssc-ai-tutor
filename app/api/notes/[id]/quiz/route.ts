import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { generateQuiz, StudyNoteContent } from "@/lib/ai";
import { aiRateLimit } from "@/lib/rate-limit";
import { aiErrorResponse, aiRateLimitResponse, aiNotConfiguredResponse } from "@/lib/ai-errors";

const QuizSchema = z.object({
  count: z.number().min(1).max(20).default(5),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const limit = aiRateLimit(session.userId);
    if (!limit.success) {
      return aiRateLimitResponse();
    }

    const body = await request.json().catch(() => ({}));
    const validation = QuizSchema.safeParse(body);
    const count = validation.success ? validation.data.count : 5;

    if (!process.env.AI_API_KEY) {
      return aiNotConfiguredResponse();
    }

    await connectToDatabase();

    const note = await StudyNote.findOne({
      _id: params.id,
      userId: session.userId,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    const existingMcqs = note.content.mcqs || [];

    if (existingMcqs.length >= count) {
      const shuffled = [...existingMcqs].sort(() => Math.random() - 0.5);
      return apiSuccess({ questions: shuffled.slice(0, count) });
    }

    const noteContent: StudyNoteContent = {
      title: note.title,
      overview: note.content.overview,
      coreConcepts: note.content.coreConcepts,
      keyFacts: note.content.keyFacts,
      shortcuts: note.content.shortcuts,
      revisionTips: note.content.revisionTips,
      commonConfusions: note.content.commonConfusions,
      mcqs: note.content.mcqs,
      workedExamples: note.content.workedExamples,
      pyqs: [],
      references: note.content.references,
      examRelevance: note.examRelevance as ("tier1" | "tier2" | "ckt")[],
    };

    try {
      const generatedQuestions = await generateQuiz(noteContent, count);
      return apiSuccess({ questions: generatedQuestions });
    } catch (aiError) {
      console.error("Quiz generation error:", aiError);

      if (existingMcqs.length > 0) {
        return apiSuccess({ questions: existingMcqs });
      }

      return aiErrorResponse(aiError);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
