import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import SyllabusNode from "@/models/SyllabusNode";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

const RenameSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request as unknown as Request);

    const body = await request.json();
    const validation = RenameSchema.safeParse(body);
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    const { name } = validation.data;
    const { id } = params;

    await connectToDatabase();
    const node = await SyllabusNode.findByIdAndUpdate(id, { name }, { new: true });
    if (!node) return apiError("Node not found", 404);
    return apiSuccess({ id: node._id.toString(), name: node.name });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request as unknown as Request);

    const { id } = params;

    await connectToDatabase();

    // Cascade-delete all descendants first
    async function deleteDescendants(parentId: string) {
      const children = await SyllabusNode.find({ parentId });
      for (const child of children) {
        await deleteDescendants(child._id.toString());
        await SyllabusNode.findByIdAndDelete(child._id);
      }
    }
    await deleteDescendants(id);
    const node = await SyllabusNode.findByIdAndDelete(id);
    if (!node) return apiError("Node not found", 404);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
