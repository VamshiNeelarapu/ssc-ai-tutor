import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import FlashcardSet from "@/models/FlashcardSet";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { aiErrorResponse, aiNotConfiguredResponse, aiRateLimitResponse } from "@/lib/ai-errors";
import type { ChapterTopicNotes } from "@/lib/ai";
import { getChapterStatus, getTopicStatus } from "@/lib/chapter-notes";
import { buildChapterFlashcards, buildTopicFlashcards } from "@/lib/flashcard-builder";
import { MIN_FLASHCARDS } from "@/lib/flashcards";
import type { IStudyNote } from "@/models/StudyNote";

// What the AI reads from a topic's saved notes
function toTopicNotes(topic: string, notes: IStudyNote[]): ChapterTopicNotes {
  return {
    topic,
    notes: notes.map((n) => ({
      title: n.title,
      overview: n.content.overview,
      coreConcepts: n.content.coreConcepts ?? [],
      keyFacts: n.content.keyFacts ?? [],
      shortcuts: n.content.shortcuts ?? [],
      commonConfusions: n.content.commonConfusions ?? [],
      markdown: n.content.markdown,
      mcqs: n.content.mcqs ?? [],
    })),
  };
}

function publicSet(set: InstanceType<typeof FlashcardSet> | null) {
  return set
    ? {
        id: set._id.toString(),
        title: set.title,
        cards: set.cards.map((c) => ({ front: c.front, back: c.back, topic: c.topic, tag: c.tag })),
        updatedAt: set.updatedAt,
      }
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const topicId = request.nextUrl.searchParams.get("topicId") || "";
    const sectionId = request.nextUrl.searchParams.get("sectionId") || "";

    await connectToDatabase();

    if (topicId) {
      const topic = await getTopicStatus(session.userId, topicId);
      if (!topic) return apiError("Topic not found", 404);
      const set = await FlashcardSet.findOne({ userId: session.userId, level: "topic", topicId });
      return apiSuccess({
        level: "topic",
        name: topic.topicName,
        sectionId: topic.sectionId,
        sectionName: topic.sectionName,
        totalTopics: 1,
        coveredTopics: topic.noteCount > 0 ? 1 : 0,
        ready: topic.noteCount > 0,
        set: publicSet(set),
      });
    }

    const status = await getChapterStatus(session.userId, sectionId);
    if (!status) return apiError("Chapter not found", 404);
    const set = await FlashcardSet.findOne({ userId: session.userId, level: "chapter", sectionId });
    return apiSuccess({
      level: "chapter",
      name: status.sectionName,
      sectionId: status.sectionId,
      sectionName: status.sectionName,
      totalTopics: status.totalTopics,
      coveredTopics: status.coveredTopics,
      ready: status.ready,
      set: publicSet(set),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const PostSchema = z
  .object({
    sectionId: z.string().min(1).optional(),
    topicId: z.string().min(1).optional(),
    model: z.string().max(100).optional(),
  })
  .refine((v) => v.sectionId || v.topicId, { message: "A chapter or a topic is required" });

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const limit = aiRateLimit(session.userId);
    if (!limit.success) return aiRateLimitResponse();

    const validation = PostSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);
    const { sectionId, topicId, model } = validation.data;

    if (!process.env.AI_API_KEY) return aiNotConfiguredResponse();

    await connectToDatabase();

    let level: "chapter" | "topic";
    let scopeSectionId: string;
    let subjectId: string | null;
    let title: string;
    let built;

    try {
      if (topicId) {
        const topic = await getTopicStatus(session.userId, topicId);
        if (!topic) return apiError("Topic not found", 404);
        if (topic.noteCount === 0) {
          return apiError("Make a note for this topic first. Flashcards are built from your own notes.", 409);
        }
        level = "topic";
        scopeSectionId = topic.sectionId;
        subjectId = topic.subjectId;
        title = `${topic.topicName} - Recall & Flashcards`;
        built = await buildTopicFlashcards(
          toTopicNotes(topic.topicName, topic.notes),
          [topic.subjectName, topic.sectionName].filter(Boolean).join(" > ") || undefined,
          model
        );
      } else {
        const status = await getChapterStatus(session.userId, sectionId!);
        if (!status) return apiError("Chapter not found", 404);

        // Enforced here too, so the button being disabled is not the only guard
        if (!status.ready) {
          const missing = status.topics.filter((t) => t.noteCount === 0).map((t) => t.name);
          return apiError(
            `Flashcards unlock once every topic has a note. Still missing: ${missing.slice(0, 5).join(", ")}${
              missing.length > 5 ? ` and ${missing.length - 5} more` : ""
            }.`,
            409
          );
        }
        level = "chapter";
        scopeSectionId = status.sectionId;
        subjectId = status.subjectId;
        title = `${status.sectionName} - Recall & Flashcards`;
        built = await buildChapterFlashcards(
          status.notesByTopic.map((entry) => toTopicNotes(entry.topic, entry.notes)),
          status.subjectName,
          model
        );
      }
    } catch (err) {
      console.error("Flashcard generation error:", err);
      return aiErrorResponse(err, model);
    }

    if (built.cards.length < MIN_FLASHCARDS) {
      return apiError("The AI did not return enough usable flashcards. Try again or pick another model.", 502);
    }

    const filter =
      level === "topic"
        ? { userId: session.userId, level, topicId }
        : { userId: session.userId, level, sectionId: scopeSectionId };

    const set = await FlashcardSet.findOneAndUpdate(
      filter,
      {
        $set: {
          title,
          sectionId: scopeSectionId,
          subjectId: subjectId ?? undefined,
          cards: built.cards,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return apiSuccess({ id: set._id.toString(), count: built.cards.length, shortTopics: built.shortTopics }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
