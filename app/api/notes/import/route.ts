import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import SyllabusNode from "@/models/SyllabusNode";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { parseAnswerKey, parseNotesDocument } from "@/lib/notes-import";

const ImportSchema = z.object({
  title: z.string().max(300).optional(),
  topicId: z.string().max(100).optional(),
  notes: z.string().min(30, "Paste your notes first").max(400_000),
  // Your own quick revision content. When given, it is used instead of any detected section.
  quickRevision: z.string().max(200_000).optional(),
  // Answers for the practice questions, for example "1-B, 2-C"
  answerKey: z.string().max(20_000).optional(),
  // Move a "revision" section found inside the notes to the Quick Revision tab
  moveRevision: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const validation = ImportSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);
    const { title, topicId, notes, quickRevision, answerKey, moveRevision } = validation.data;

    await connectToDatabase();

    // The chapter and subject follow from the topic
    let subjectId: string | undefined;
    let sectionId: string | undefined;
    if (topicId) {
      if (!mongoose.isValidObjectId(topicId)) return apiError("Unknown topic", 400);
      const topic = await SyllabusNode.findById(topicId).select("parentId nodeType");
      if (!topic || topic.nodeType !== "topic") return apiError("Unknown topic", 400);
      sectionId = topic.parentId ?? undefined;
      if (sectionId) {
        const section = await SyllabusNode.findById(sectionId).select("parentId");
        subjectId = section?.parentId ?? undefined;
      }
    }

    const hasOwnRevision = Boolean(quickRevision && quickRevision.trim().length > 0);
    const parsed = parseNotesDocument(notes, { extractRevision: moveRevision !== false && !hasOwnRevision });
    if (!parsed.fullMarkdown) return apiError("Nothing was left to save after cleaning the paste", 400);

    const quickRevisionMarkdown = hasOwnRevision
      ? parseNotesDocument(quickRevision!, { extractRevision: false }).fullMarkdown
      : parsed.revision?.markdown;

    // An answer key you give wins over answers found in the paste
    const key = answerKey ? parseAnswerKey(answerKey, parsed.questions.length) : {};
    const practiceQuestions = parsed.questions.map((q, i) => {
      const fromKey = key[i + 1] !== undefined && key[i + 1] < q.options.length ? key[i + 1] : undefined;
      const answerIndex = fromKey ?? q.answerIndex;
      return {
        question: q.question,
        options: q.options,
        ...(answerIndex !== undefined ? { correctOptionIndex: answerIndex } : {}),
        ...(q.explanation ? { explanation: q.explanation } : {}),
        answerSource: answerIndex !== undefined ? ("pasted" as const) : ("none" as const),
      };
    });

    const note = await StudyNote.create({
      userId: session.userId,
      title: (title?.trim() || parsed.title).slice(0, 300),
      subjectId,
      sectionId,
      topicId,
      examRelevance: ["tier1"],
      content: {
        markdown: parsed.fullMarkdown,
        ...(quickRevisionMarkdown ? { quickRevisionMarkdown } : {}),
        ...(parsed.practiceNote ? { practiceNote: parsed.practiceNote } : {}),
        ...(practiceQuestions.length ? { practiceQuestions } : {}),
        coreConcepts: [],
        keyFacts: [],
        shortcuts: [],
        revisionTips: [],
        commonConfusions: [],
        mcqs: [],
        workedExamples: [],
        references: [],
      },
      revisionStatus: "not_started",
    });

    return apiSuccess(
      {
        id: note._id.toString(),
        title: note.title,
        questions: practiceQuestions.length,
        answered: practiceQuestions.filter((q) => q.correctOptionIndex !== undefined).length,
        quickRevision: Boolean(quickRevisionMarkdown),
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
