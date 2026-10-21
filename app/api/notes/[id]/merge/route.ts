import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

const MergeContentSchema = z.object({
  content: z.object({
    overview: z.string().optional(),
    coreConcepts: z
      .array(z.object({ heading: z.string(), body: z.string() }))
      .optional(),
    keyFacts: z.array(z.string()).optional(),
    shortcuts: z.array(z.string()).optional(),
    revisionTips: z.array(z.string()).optional(),
    commonConfusions: z.array(z.string()).optional(),
    mcqs: z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()),
          correctOptionIndex: z.number(),
          explanation: z.string(),
          sourceStatus: z.enum(["verified", "unverified", "generated"]).default("generated"),
        })
      )
      .optional(),
    workedExamples: z
      .array(
        z.object({
          question: z.string(),
          approach: z.string().optional(),
          steps: z.array(z.string()).optional(),
        })
      )
      .optional(),
    references: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().optional(),
          publisher: z.string().optional(),
          verificationStatus: z.enum(["verified", "unverified"]),
        })
      )
      .optional(),
  }),
});

function mergeStringArrayUnique(existing: string[], incoming: string[] = []): string[] {
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  const result = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.trim().toLowerCase())) {
      result.push(item);
      seen.add(item.trim().toLowerCase());
    }
  }
  return result;
}

function mergeConcepts(
  existing: Array<{ heading: string; body: string }>,
  incoming: Array<{ heading: string; body: string }> = []
): Array<{ heading: string; body: string }> {
  const map = new Map(existing.map((c) => [c.heading.trim().toLowerCase(), c]));
  const result = [...existing];
  for (const concept of incoming) {
    const key = concept.heading.trim().toLowerCase();
    if (map.has(key)) {
      // Update body of existing concept
      const idx = result.findIndex((c) => c.heading.trim().toLowerCase() === key);
      if (idx !== -1) result[idx] = { ...result[idx], body: concept.body };
    } else {
      result.push(concept);
      map.set(key, concept);
    }
  }
  return result;
}

function mergeReferences(
  existing: Array<{ title: string; url?: string; publisher?: string; verificationStatus: string }>,
  incoming: Array<{ title: string; url?: string; publisher?: string; verificationStatus: string }> = []
) {
  const seen = new Set(existing.map((r) => r.title.trim().toLowerCase()));
  const result = [...existing];
  for (const ref of incoming) {
    if (!seen.has(ref.title.trim().toLowerCase())) {
      result.push(ref);
      seen.add(ref.title.trim().toLowerCase());
    }
  }
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const body = await request.json();
    const validation = MergeContentSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const { content: incoming } = validation.data;

    await connectToDatabase();

    const note = await StudyNote.findOne({ _id: params.id, userId: session.userId });
    if (!note) return apiError("Note not found", 404);

    const existing = note.content as {
      overview?: string;
      coreConcepts: Array<{ heading: string; body: string }>;
      keyFacts: string[];
      shortcuts: string[];
      revisionTips: string[];
      commonConfusions: string[];
      mcqs: Array<{ question: string; options: string[]; correctOptionIndex: number; explanation: string; sourceStatus: string }>;
      workedExamples: Array<{ question: string; approach?: string; steps?: string[] }>;
      references: Array<{ title: string; url?: string; publisher?: string; verificationStatus: string }>;
    };

    const mergedContent = {
      overview: incoming.overview ?? existing.overview,
      coreConcepts: mergeConcepts(existing.coreConcepts || [], incoming.coreConcepts),
      keyFacts: mergeStringArrayUnique(existing.keyFacts || [], incoming.keyFacts),
      shortcuts: mergeStringArrayUnique(existing.shortcuts || [], incoming.shortcuts),
      revisionTips: mergeStringArrayUnique(existing.revisionTips || [], incoming.revisionTips),
      commonConfusions: mergeStringArrayUnique(existing.commonConfusions || [], incoming.commonConfusions),
      mcqs: [...(existing.mcqs || []), ...(incoming.mcqs || [])],
      workedExamples: [...(existing.workedExamples || []), ...(incoming.workedExamples || [])],
      references: mergeReferences(existing.references || [], incoming.references),
    };

    const updated = await StudyNote.findOneAndUpdate(
      { _id: params.id, userId: session.userId },
      { $set: { content: mergedContent, updatedAt: new Date() } },
      { new: true }
    );

    if (!updated) return apiError("Note not found", 404);

    return apiSuccess({
      id: updated._id.toString(),
      title: updated.title,
      subjectId: updated.subjectId,
      sectionId: updated.sectionId,
      topicId: updated.topicId,
      examRelevance: updated.examRelevance,
      content: updated.content,
      revisionStatus: updated.revisionStatus,
      sourceConversationId: updated.sourceConversationId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
