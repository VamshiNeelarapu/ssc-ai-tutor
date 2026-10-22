import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { AI_MODELS, MAX_CUSTOM_MODELS, MODEL_ID_PATTERN } from "@/lib/models";

const AddModelSchema = z.object({
  id: z
    .string()
    .trim()
    .min(3, "Model ID is too short")
    .max(100, "Model ID is too long")
    .regex(MODEL_ID_PATTERN, "Model ID may only contain letters, numbers and . _ - : /"),
  label: z.string().trim().max(40, "Label must be 40 characters or fewer").optional(),
});

function toPublic(models: Array<{ id: string; label: string }> | undefined) {
  return (models ?? []).map((m) => ({ id: m.id, label: m.label }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    await connectToDatabase();
    const user = await User.findById(session.userId).select("customModels");
    if (!user) return apiError("User not found", 404);
    return apiSuccess({ models: toPublic(user.customModels) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const validation = AddModelSchema.safeParse(await request.json());
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    const { id } = validation.data;
    const label = validation.data.label || id.split("/").pop() || id;

    if (AI_MODELS.some((m) => m.id === id)) {
      return apiError("This model is already in the built-in list", 409);
    }

    await connectToDatabase();
    const user = await User.findById(session.userId).select("customModels");
    if (!user) return apiError("User not found", 404);

    if (user.customModels.some((m) => m.id === id)) {
      return apiError("You have already added this model", 409);
    }
    if (user.customModels.length >= MAX_CUSTOM_MODELS) {
      return apiError(`You can add up to ${MAX_CUSTOM_MODELS} custom models`, 400);
    }

    user.customModels.push({ id, label });
    await user.save();
    return apiSuccess({ models: toPublic(user.customModels) }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("Model id is required", 400);

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(
      session.userId,
      { $pull: { customModels: { id } } },
      { new: true }
    ).select("customModels");
    if (!user) return apiError("User not found", 404);

    return apiSuccess({ models: toPublic(user.customModels) });
  } catch (error) {
    return handleApiError(error);
  }
}
