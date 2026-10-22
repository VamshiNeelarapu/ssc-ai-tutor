import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import Conversation from "@/models/Conversation";
import QuizAttempt from "@/models/QuizAttempt";
import { requireAuth, apiSuccess, handleApiError } from "@/lib/api-utils";

interface TopicProgress {
  chatCount: number;
  chatMessages: number;
  noteId?: string;
  noteStatus?: string;
  quizAttempts: number;
  lastAccuracy?: number;
  avgAccuracy?: number;
  lastActivity?: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    await connectToDatabase();

    const [notes, chats, attempts] = await Promise.all([
      StudyNote.find({ userId: session.userId, topicId: { $exists: true, $nin: [null, ""] } })
        .sort({ updatedAt: -1 })
        .select("topicId revisionStatus updatedAt"),
      Conversation.aggregate<{ _id: string; chats: number; messages: number; last: Date }>([
        {
          $match: {
            userId: session.userId,
            topicId: { $exists: true, $nin: [null, ""] },
            "messages.0": { $exists: true },
          },
        },
        {
          $group: {
            _id: "$topicId",
            chats: { $sum: 1 },
            messages: { $sum: { $size: "$messages" } },
            last: { $max: "$updatedAt" },
          },
        },
      ]),
      QuizAttempt.find({ userId: session.userId })
        .sort({ completedAt: -1 })
        .select("noteId score totalQuestions completedAt"),
    ]);

    const topics: Record<string, TopicProgress> = {};
    const entry = (id: string): TopicProgress =>
      (topics[id] ??= { chatCount: 0, chatMessages: 0, quizAttempts: 0 });
    const touch = (t: TopicProgress, when?: Date) => {
      if (when && (!t.lastActivity || when.toISOString() > t.lastActivity)) t.lastActivity = when.toISOString();
    };

    const topicByNote = new Map<string, string>();
    for (const n of notes) {
      if (!n.topicId) continue;
      topicByNote.set(n._id.toString(), n.topicId);
      const t = entry(n.topicId);
      if (!t.noteId) {
        // newest note per topic decides the status
        t.noteId = n._id.toString();
        t.noteStatus = n.revisionStatus;
      }
      touch(t, n.updatedAt);
    }

    for (const c of chats) {
      const t = entry(c._id);
      t.chatCount = c.chats;
      t.chatMessages = c.messages;
      touch(t, c.last);
    }

    const accuracySums = new Map<string, number>();
    for (const a of attempts) {
      const topicId = topicByNote.get(a.noteId);
      if (!topicId || !a.totalQuestions) continue;
      const t = entry(topicId);
      const accuracy = Math.round((a.score / a.totalQuestions) * 100);
      if (t.lastAccuracy === undefined) t.lastAccuracy = accuracy; // attempts arrive newest first
      t.quizAttempts += 1;
      accuracySums.set(topicId, (accuracySums.get(topicId) ?? 0) + accuracy);
      touch(t, a.completedAt);
    }
    for (const [topicId, sum] of accuracySums) {
      const t = topics[topicId];
      t.avgAccuracy = Math.round(sum / t.quizAttempts);
    }

    return apiSuccess({ topics });
  } catch (error) {
    return handleApiError(error);
  }
}
