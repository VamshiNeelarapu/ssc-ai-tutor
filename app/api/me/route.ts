import { NextRequest } from "next/server";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    await connectToDatabase();
    const user = await User.findById(session.userId).select("-passwordHash");

    if (!user) {
      return apiError("User not found", 404);
    }

    return apiSuccess({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
