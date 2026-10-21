import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import QuizAttempt from "@/models/QuizAttempt";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

const CreateAttemptSchema = z.object({
  noteId: z.string().min(1),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctOptionIndex: z.number(),
      explanation: z.string(),
      userAnswerIndex: z.number().optional(),
    })
  ),
  score: z.number().min(0),
  totalQuestions: z.number().min(1),
  completedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const body = await request.json();
    const validation = CreateAttemptSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    await connectToDatabase();

    const attempt = await QuizAttempt.create({
      userId: session.userId,
      noteId: validation.data.noteId,
      questions: validation.data.questions,
      score: validation.data.score,
      totalQuestions: validation.data.totalQuestions,
      completedAt: validation.data.completedAt
        ? new Date(validation.data.completedAt)
        : new Date(),
    });

    return apiSuccess(
      {
        id: attempt._id.toString(),
        noteId: attempt.noteId,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        completedAt: attempt.completedAt,
        createdAt: attempt.createdAt,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId") ?? undefined;

    await connectToDatabase();

    const query: Record<string, unknown> = { userId: session.userId };
    if (noteId) query.noteId = noteId;

    const attempts = await QuizAttempt.find(query)
      .sort({ completedAt: -1 })
      .limit(50)
      .select("noteId score totalQuestions completedAt createdAt");

    return apiSuccess(
      attempts.map((a) => ({
        id: a._id.toString(),
        noteId: a.noteId,
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: Math.round((a.score / a.totalQuestions) * 100),
        completedAt: a.completedAt,
        createdAt: a.createdAt,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
