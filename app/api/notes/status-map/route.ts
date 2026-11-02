import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    await connectToDatabase();

    const notes = await StudyNote.find({ userId: session.userId, topicId: { $exists: true, $ne: "" } })
      .sort({ updatedAt: -1 })
      .select("topicId revisionStatus");

    // Most recently updated note wins when a topic has more than one
    const map: Record<string, string> = {};
    for (const n of notes) {
      if (n.topicId && !map[n.topicId]) map[n.topicId] = n.revisionStatus;
    }

    return apiSuccess({ map });
  } catch (error) {
    return handleApiError(error);
  }
}
