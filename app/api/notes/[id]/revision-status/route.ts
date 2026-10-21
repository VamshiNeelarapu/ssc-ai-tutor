import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

const RevisionStatusSchema = z.object({
  revisionStatus: z.enum(["not_started", "learning", "needs_revision", "revised"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const body = await request.json();
    const validation = RevisionStatusSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    await connectToDatabase();

    const note = await StudyNote.findOneAndUpdate(
      { _id: params.id, userId: session.userId },
      { $set: { revisionStatus: validation.data.revisionStatus } },
      { new: true }
    );

    if (!note) {
      return apiError("Note not found", 404);
    }

    return apiSuccess({
      id: note._id.toString(),
      revisionStatus: note.revisionStatus,
      updatedAt: note.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
