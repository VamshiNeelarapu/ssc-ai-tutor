import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import Conversation from "@/models/Conversation";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);

    await connectToDatabase();

    const conversation = await Conversation.findOne({
      _id: params.id,
      userId: session.userId,
    });

    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    return apiSuccess({
      id: conversation._id.toString(),
      title: conversation.title,
      topicHint: conversation.topicHint,
      subject: conversation.subject,
      topic: conversation.topic,
      section: conversation.section,
      topicId: conversation.topicId,
      messages: conversation.messages,
      updatedAt: conversation.updatedAt,
      createdAt: conversation.createdAt,
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

    const conversation = await Conversation.findOneAndDelete({
      _id: params.id,
      userId: session.userId,
    });

    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    return apiSuccess({ message: "Conversation deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
