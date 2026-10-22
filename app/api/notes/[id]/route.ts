import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  subjectId: z.string().optional(),
  sectionId: z.string().optional(),
  topicId: z.string().optional(),
  examRelevance: z
    .array(z.enum(["tier1", "tier2", "ckt"]))
    .optional(),
  content: z
    .object({
      overview: z.string().optional(),
      coreConcepts: z
        .array(z.object({ heading: z.string(), body: z.string() }))
        .optional(),
      keyFacts: z.array(z.string()).optional(),
      shortcuts: z.array(z.string()).optional(),
      revisionTips: z.array(z.string()).optional(),
      commonConfusions: z.array(z.string()).optional(),
      mcqs: z
        .array(
          z.object({
            question: z.string(),
            options: z.array(z.string()),
            correctOptionIndex: z.number(),
            explanation: z.string(),
            sourceStatus: z
              .enum(["verified", "unverified", "generated"])
              .default("generated"),
          })
        )
        .optional(),
      workedExamples: z
        .array(
          z.object({
            question: z.string(),
            approach: z.string().optional(),
            steps: z.array(z.string()).optional(),
          })
        )
        .optional(),
      references: z
        .array(
          z.object({
            title: z.string(),
            url: z.string().optional(),
            publisher: z.string().optional(),
            verificationStatus: z.enum(["verified", "unverified"]),
          })
        )
        .optional(),
    })
    .optional(),
  revisionStatus: z
    .enum(["not_started", "learning", "needs_revision", "revised"])
    .optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);

    await connectToDatabase();

    const note = await StudyNote.findOne({
      _id: params.id,
      userId: session.userId,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    return apiSuccess({
      id: note._id.toString(),
      userId: note.userId,
      title: note.title,
      subjectId: note.subjectId,
      sectionId: note.sectionId,
      topicId: note.topicId,
      examRelevance: note.examRelevance,
      content: note.content,
      revisionStatus: note.revisionStatus,
      sourceConversationId: note.sourceConversationId,
      kind: note.kind ?? "note",
      monthKey: note.monthKey,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const body = await request.json();
    const validation = UpdateNoteSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    await connectToDatabase();

    if (validation.data.content) {
      const existing = await StudyNote.findOne({ _id: params.id, userId: session.userId }).select("kind");
      if (existing?.kind === "current_affairs_month") {
        return apiError(
          "This monthly current affairs note is rebuilt automatically from your daily digests, so its content can't be edited by hand. Add or refresh a day on the Current Affairs page instead.",
          400
        );
      }
    }

    const note = await StudyNote.findOneAndUpdate(
      { _id: params.id, userId: session.userId },
      { $set: validation.data },
      { new: true }
    );

    if (!note) {
      return apiError("Note not found", 404);
    }

    return apiSuccess({
      id: note._id.toString(),
      title: note.title,
      subjectId: note.subjectId,
      sectionId: note.sectionId,
      topicId: note.topicId,
      examRelevance: note.examRelevance,
      content: note.content,
      revisionStatus: note.revisionStatus,
      sourceConversationId: note.sourceConversationId,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);

    await connectToDatabase();

    const note = await StudyNote.findOneAndDelete({
      _id: params.id,
      userId: session.userId,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    return apiSuccess({ message: "Note deleted successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
