import { NextRequest } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireAuth, apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";

const Schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request as unknown as Request);

    const limit = rateLimit(`chpw:${session.userId}`, { windowMs: 15 * 60 * 1000, max: 10 });
    if (!limit.success) return apiError("Too many attempts. Please try again later.", 429);

    const validation = Schema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) return apiError(validation.error.errors[0].message, 400);

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) return apiError("User not found", 404);

    // A master-password session may set a new password without knowing the old one
    if (!session.master) {
      const current = validation.data.currentPassword;
      if (!current) return apiError("Current password is required", 400);
      const ok = await verifyPassword(current, user.passwordHash);
      if (!ok) return apiError("Current password is incorrect.", 400);
    }

    user.passwordHash = await hashPassword(validation.data.newPassword);
    await user.save();

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
