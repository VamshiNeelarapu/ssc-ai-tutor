import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import Conversation from "@/models/Conversation";
import { requireAuth, apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    await connectToDatabase();

    const [notes, chatTopicIds] = await Promise.all([
      StudyNote.find({ userId: session.userId, topicId: { $exists: true, $ne: "" } })
        .sort({ updatedAt: -1 })
        .select("topicId revisionStatus"),
      // Topics that have at least one chat with messages in it
      Conversation.distinct("topicId", {
        userId: session.userId,
        topicId: { $exists: true, $nin: [null, ""] },
        "messages.0": { $exists: true },
      }),
    ]);

    // Most recently updated note wins when a topic has more than one
    const map: Record<string, string> = {};
    for (const n of notes) {
      if (n.topicId && !map[n.topicId]) map[n.topicId] = n.revisionStatus;
    }

    return apiSuccess({ map, chatTopicIds });
  } catch (error) {
    return handleApiError(error);
  }
}
