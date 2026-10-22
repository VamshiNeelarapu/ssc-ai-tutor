import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

const CreateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  subjectId: z.string().optional(),
  sectionId: z.string().optional(),
  topicId: z.string().optional(),
  examRelevance: z
    .array(z.enum(["tier1", "tier2", "ckt", "dest", "stats", "finance"]))
    .default(["tier1"]),
  content: z.object({
    overview: z.string().optional(),
    coreConcepts: z
      .array(z.object({ heading: z.string(), body: z.string() }))
      .default([]),
    keyFacts: z.array(z.string()).default([]),
    shortcuts: z.array(z.string()).default([]),
    revisionTips: z.array(z.string()).default([]),
    commonConfusions: z.array(z.string()).default([]),
    mcqs: z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()),
          correctOptionIndex: z.number(),
          explanation: z.string(),
          sourceStatus: z
            .enum(["verified", "unverified", "generated"])
            .default("generated"),
        })
      )
      .default([]),
    workedExamples: z
      .array(
        z.object({
          question: z.string(),
          approach: z.string().optional(),
          steps: z.array(z.string()).optional(),
        })
      )
      .default([]),
    references: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().optional(),
          publisher: z.string().optional(),
          verificationStatus: z.enum(["verified", "unverified"]),
        })
      )
      .default([]),
  }),
  revisionStatus: z
    .enum(["not_started", "learning", "needs_revision", "revised"])
    .default("not_started"),
  sourceConversationId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const body = await request.json();
    const validation = CreateNoteSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    await connectToDatabase();

    const note = await StudyNote.create({
      userId: session.userId,
      ...validation.data,
    });

    return apiSuccess(
      {
        id: note._id.toString(),
        title: note.title,
        subjectId: note.subjectId,
        sectionId: note.sectionId,
        topicId: note.topicId,
        examRelevance: note.examRelevance,
        content: note.content,
        revisionStatus: note.revisionStatus,
        sourceConversationId: note.sourceConversationId,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const subjectId = searchParams.get("subjectId") ?? undefined;
    const sectionId = searchParams.get("sectionId") ?? undefined;
    const topicId = searchParams.get("topicId") ?? undefined;
    const revisionStatus = searchParams.get("revisionStatus") ?? undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    await connectToDatabase();

    const query: Record<string, unknown> = { userId: session.userId };

    if (subjectId) query.subjectId = subjectId;
    if (sectionId) query.sectionId = sectionId;
    if (topicId) query.topicId = topicId;
    if (revisionStatus) query.revisionStatus = revisionStatus;
    if (q) query.$text = { $search: q };

    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      StudyNote.find(query)
        .sort(q ? { score: { $meta: "textScore" } } : { updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "title subjectId sectionId topicId examRelevance revisionStatus sourceConversationId kind monthKey createdAt updatedAt"
        ),
      StudyNote.countDocuments(query),
    ]);

    return apiSuccess({
      notes: notes.map((note) => ({
        id: note._id.toString(),
        title: note.title,
        subjectId: note.subjectId,
        sectionId: note.sectionId,
        topicId: note.topicId,
        examRelevance: note.examRelevance,
        revisionStatus: note.revisionStatus,
        sourceConversationId: note.sourceConversationId,
        kind: note.kind ?? "note",
        monthKey: note.monthKey,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
