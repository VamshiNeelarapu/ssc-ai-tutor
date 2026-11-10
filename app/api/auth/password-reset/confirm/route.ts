import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import PasswordResetChallenge from "@/models/PasswordResetChallenge";
import { hashPassword } from "@/lib/auth";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  getConfiguredRecoveryEmail,
  hashResetCode,
  RESET_CODE_MAX_ATTEMPTS,
  resetCodeHashesMatch,
} from "@/lib/password-reset";

const ConfirmSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(100),
});

const INVALID_CODE = "The code is invalid or expired. Request a new code and try again.";

export async function POST(request: NextRequest) {
  const limit = authRateLimit(getClientIp(request));
  if (!limit.success) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const parsed = ConfirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email, six-digit code, and password of at least 8 characters." }, { status: 400 });
  }

  try {
    const destination = getConfiguredRecoveryEmail();
    const email = parsed.data.email.toLowerCase();
    await connectToDatabase();

    const challenge = await PasswordResetChallenge.findOne({
      destination,
      email,
      expiresAt: { $gt: new Date() },
      usedAt: null,
      attempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
    });
    if (!challenge) return NextResponse.json({ error: INVALID_CODE }, { status: 400 });

    const candidateHash = hashResetCode(destination, email, parsed.data.code);
    if (!resetCodeHashesMatch(challenge.codeHash, candidateHash)) {
      await PasswordResetChallenge.updateOne(
        {
          _id: challenge._id,
          usedAt: null,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
        },
        { $inc: { attempts: 1 } }
      );
      return NextResponse.json({ error: INVALID_CODE }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const consumed = await PasswordResetChallenge.findOneAndUpdate(
      {
        _id: challenge._id,
        codeHash: candidateHash,
        expiresAt: { $gt: new Date() },
        usedAt: null,
        attempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
      },
      { $set: { usedAt: new Date() } },
      { new: true }
    );
    if (!consumed) return NextResponse.json({ error: INVALID_CODE }, { status: 400 });

    const result = await User.updateOne({ email }, { $set: { passwordHash } });
    if (result.matchedCount !== 1) return NextResponse.json({ error: INVALID_CODE }, { status: 400 });

    return NextResponse.json({ message: "Your password has been reset. You can now sign in." });
  } catch (error) {
    console.error("Password recovery confirmation failed:", error);
    return NextResponse.json({ error: "Password recovery is not available right now." }, { status: 503 });
  }
}
