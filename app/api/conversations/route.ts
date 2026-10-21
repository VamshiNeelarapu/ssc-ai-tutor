import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import Conversation from "@/models/Conversation";
import { requireAuth, apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    await connectToDatabase();

    const conversations = await Conversation.find({ userId: session.userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("title topicHint topicId updatedAt createdAt messages");

    return apiSuccess(
      conversations.map((conv) => ({
        id: conv._id.toString(),
        title: conv.title,
        topicHint: conv.topicHint,
        topicId: conv.topicId,
        messageCount: conv.messages.length,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
