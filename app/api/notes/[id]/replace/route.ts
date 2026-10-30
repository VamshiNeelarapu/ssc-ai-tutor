import { NextRequest } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import StudyNote from "@/models/StudyNote";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { planReplacement, type ExistingContent } from "@/lib/notes-import";

const ReplaceSchema = z.object({
  text: z.string().min(10, "Paste the new text first").max(400_000),
  full: z.boolean(),
  revision: z.boolean(),
  mcq: z.boolean(),
  mcqMode: z.enum(["replace", "add"]).default("replace"),
  answerKey: z.string().max(20_000).optional(),
});

// Replaces the parts of a pasted note that you choose, and leaves the others alone
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const validation = ReplaceSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);
    const { text, full, revision, mcq, mcqMode, answerKey } = validation.data;

    if (!mongoose.isValidObjectId(params.id)) return apiError("Note not found", 404);
    await connectToDatabase();

    const note = await StudyNote.findOne({ _id: params.id, userId: session.userId });
    if (!note || !note.content.markdown) return apiError("Note not found", 404);

    const existing = note.toObject().content as ExistingContent;
    const plan = planReplacement(existing, text, { full, revision, mcq, mcqMode, answerKey });
    if (!plan.ok) return apiError(plan.error, 400);

    note.content.markdown = plan.content.markdown;
    note.content.quickRevisionMarkdown = plan.content.quickRevisionMarkdown;
    note.content.practiceNote = plan.content.practiceNote;
    note.content.practiceQuestions = plan.content.practiceQuestions as typeof note.content.practiceQuestions;
    note.markModified("content");
    await note.save();

    return apiSuccess({ id: note._id.toString(), lines: plan.lines });
  } catch (error) {
    return handleApiError(error);
  }
}
