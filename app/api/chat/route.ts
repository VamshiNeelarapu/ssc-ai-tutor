import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import Conversation from "@/models/Conversation";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { chat, Message, buildSubjectSystemPrompt } from "@/lib/ai";
import { aiRateLimit } from "@/lib/rate-limit";
import { aiErrorResponse, aiRateLimitResponse, aiNotConfiguredResponse } from "@/lib/ai-errors";

const ChatSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  conversationId: z.string().optional(),
  subject: z.string().max(100).optional(),
  topic: z.string().max(150).optional(),
  topicId: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const limit = aiRateLimit(session.userId);
    if (!limit.success) {
      return aiRateLimitResponse();
    }

    const body = await request.json();
    const validation = ChatSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const { message, conversationId, subject, topic, topicId, model } = validation.data;

    if (!process.env.AI_API_KEY) {
      return aiNotConfiguredResponse();
    }

    await connectToDatabase();

    let conversation;
    let createdNew = false;
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: session.userId,
      });
      if (!conversation) {
        return apiError("Conversation not found", 404);
      }
    } else {
      const title = message.length > 60 ? message.substring(0, 60) + "..." : message;
      createdNew = true;
      conversation = await Conversation.create({
        userId: session.userId,
        title,
        subject,
        topic,
        topicId,
        messages: [],
      });
    }

    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    const activeSubject = subject || conversation.subject;
    const activeTopic = topic || conversation.topic;
    const aiMessages: Message[] = [
      { role: "system", content: buildSubjectSystemPrompt(activeSubject, activeTopic) },
      ...conversation.messages.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    let aiResponse: string;
    try {
      aiResponse = await chat(aiMessages, { model });
    } catch (aiError) {
      console.error("AI error:", aiError);

      // Don't leave an empty conversation behind when the very first reply fails
      if (createdNew) {
        await Conversation.deleteOne({ _id: conversation._id }).catch(() => {});
      }

      return aiErrorResponse(aiError, model);
    }

    conversation.messages.push({
      role: "assistant",
      content: aiResponse,
      timestamp: new Date(),
    });

    await conversation.save();

    return apiSuccess({
      conversationId: conversation._id.toString(),
      message: {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
