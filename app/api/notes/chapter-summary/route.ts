import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { aiErrorResponse, aiNotConfiguredResponse, aiRateLimitResponse } from "@/lib/ai-errors";
import { generateChapterNote } from "@/lib/ai";
import { getChapterStatus } from "@/lib/chapter-notes";

const MAX_MCQS = 80;
const MAX_EXAMPLES = 40;

function publicStatus(s: NonNullable<Awaited<ReturnType<typeof getChapterStatus>>>) {
  return {
    sectionId: s.sectionId,
    sectionName: s.sectionName,
    topics: s.topics,
    totalTopics: s.totalTopics,
    coveredTopics: s.coveredTopics,
    ready: s.ready,
    existingNoteId: s.existingNoteId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const sectionId = request.nextUrl.searchParams.get("sectionId") || "";

    await connectToDatabase();
    const status = await getChapterStatus(session.userId, sectionId);
    if (!status) return apiError("Chapter not found", 404);

    return apiSuccess(publicStatus(status));
  } catch (error) {
    return handleApiError(error);
  }
}

const PostSchema = z.object({
  sectionId: z.string().min(1),
  model: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const limit = aiRateLimit(session.userId);
    if (!limit.success) return aiRateLimitResponse();

    const validation = PostSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);
    const { sectionId, model } = validation.data;

    if (!process.env.AI_API_KEY) return aiNotConfiguredResponse();

    await connectToDatabase();

    const status = await getChapterStatus(session.userId, sectionId);
    if (!status) return apiError("Chapter not found", 404);

    // Enforced here too, so the button being disabled is not the only guard
    if (!status.ready) {
      const missing = status.topics.filter((t) => t.noteCount === 0).map((t) => t.name);
      return apiError(
        `Chapter notes unlock once every topic has a note. Still missing: ${missing.slice(0, 5).join(", ")}${
          missing.length > 5 ? ` and ${missing.length - 5} more` : ""
        }.`,
        409
      );
    }

    let draft;
    try {
      draft = await generateChapterNote(
        status.sectionName,
        status.subjectName,
        status.notesByTopic.map((entry) => ({
          topic: entry.topic,
          notes: entry.notes.map((n) => ({
            title: n.title,
            overview: n.content.overview,
            coreConcepts: n.content.coreConcepts ?? [],
            keyFacts: n.content.keyFacts ?? [],
            shortcuts: n.content.shortcuts ?? [],
            commonConfusions: n.content.commonConfusions ?? [],
          })),
        })),
        model
      );
    } catch (err) {
      console.error("Chapter note generation error:", err);
      return aiErrorResponse(err, model);
    }

    // Quiz questions, worked examples and references are copied as they are in the topic
    // notes, so their answers and sources are never rewritten by the AI.
    const allNotes = status.notesByTopic.flatMap((e) => e.notes);
    const mcqs = allNotes.flatMap((n) => n.content.mcqs ?? []).slice(0, MAX_MCQS);
    const workedExamples = allNotes.flatMap((n) => n.content.workedExamples ?? []).slice(0, MAX_EXAMPLES);
    const seenRefs = new Set<string>();
    const references = allNotes
      .flatMap((n) => n.content.references ?? [])
      .filter((r) => {
        const key = r.title.trim().toLowerCase();
        if (seenRefs.has(key)) return false;
        seenRefs.add(key);
        return true;
      });
    const examRelevance = Array.from(new Set(allNotes.flatMap((n) => n.examRelevance ?? []))) as Array<
      "tier1" | "tier2" | "ckt"
    >;

    const content = {
      overview: draft.overview,
      coreConcepts: draft.coreConcepts,
      keyFacts: draft.keyFacts,
      shortcuts: draft.shortcuts,
      revisionTips: draft.revisionTips,
      commonConfusions: draft.commonConfusions,
      mcqs: mcqs.map((q) => ({
        question: q.question,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation,
        sourceStatus: q.sourceStatus,
      })),
      workedExamples: workedExamples.map((w) => ({
        question: w.question,
        approach: w.approach,
        steps: w.steps,
      })),
      references: references.map((r) => ({
        title: r.title,
        url: r.url,
        publisher: r.publisher,
        verificationStatus: r.verificationStatus,
      })),
    };

    const note = await StudyNote.findOneAndUpdate(
      { userId: session.userId, kind: "chapter_summary", sectionId },
      {
        $set: {
          title: `${status.sectionName} - Chapter Notes`,
          subjectId: status.subjectId ?? undefined,
          examRelevance: examRelevance.length ? examRelevance : ["tier1"],
          content,
        },
        $setOnInsert: { revisionStatus: "not_started" },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return apiSuccess({ id: note._id.toString(), title: note.title, replaced: Boolean(status.existingNoteId) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
