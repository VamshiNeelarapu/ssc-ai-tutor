import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import QuizAttempt from "@/models/QuizAttempt";
import { requireAuth, apiSuccess, handleApiError } from "@/lib/api-utils";

interface TopicProgress {
  noteCount: number;
  noteId?: string;
  noteStatus?: string;
  hasRevision: boolean;
  practiceQuestions: number;
  quizAttempts: number;
  lastAccuracy?: number;
  avgAccuracy?: number;
  lastActivity?: string;
}

interface NoteRow {
  _id: { toString(): string };
  topicId: string;
  revisionStatus?: string;
  updatedAt?: Date;
  hasRevision: boolean;
  practiceQuestions: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    await connectToDatabase();

    const [notes, attempts] = await Promise.all([
      // Only the flags are read, not the notes themselves, which can be long
      StudyNote.aggregate<NoteRow>([
        { $match: { userId: session.userId, topicId: { $exists: true, $nin: [null, ""] } } },
        { $sort: { updatedAt: -1 } },
        {
          $project: {
            topicId: 1,
            revisionStatus: 1,
            updatedAt: 1,
            hasRevision: { $gt: [{ $strLenCP: { $ifNull: ["$content.quickRevisionMarkdown", ""] } }, 0] },
            practiceQuestions: {
              $size: {
                $ifNull: [
                  "$content.practiceQuestions",
                  { $ifNull: ["$content.mcqs", []] },
                ],
              },
            },
          },
        },
      ]),
      QuizAttempt.find({ userId: session.userId })
        .sort({ completedAt: -1 })
        .select("noteId score totalQuestions completedAt"),
    ]);

    const topics: Record<string, TopicProgress> = {};
    const entry = (id: string): TopicProgress =>
      (topics[id] ??= { noteCount: 0, hasRevision: false, practiceQuestions: 0, quizAttempts: 0 });
    const touch = (t: TopicProgress, when?: Date) => {
      if (when && (!t.lastActivity || when.toISOString() > t.lastActivity)) t.lastActivity = when.toISOString();
    };

    const topicByNote = new Map<string, string>();
    for (const n of notes) {
      if (!n.topicId) continue;
      topicByNote.set(n._id.toString(), n.topicId);
      const t = entry(n.topicId);
      t.noteCount += 1;
      if (!t.noteId) {
        // newest note per topic decides the status
        t.noteId = n._id.toString();
        t.noteStatus = n.revisionStatus;
      }
      if (n.hasRevision) t.hasRevision = true;
      t.practiceQuestions = Math.max(t.practiceQuestions, n.practiceQuestions);
      touch(t, n.updatedAt);
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
