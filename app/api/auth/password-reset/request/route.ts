import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import PasswordResetChallenge from "@/models/PasswordResetChallenge";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  createResetCode,
  getConfiguredRecoveryEmail,
  hashResetCode,
  RESET_CODE_RESEND_DELAY_MS,
  RESET_CODE_TTL_MS,
  sendResetCodeEmail,
} from "@/lib/password-reset";

const RequestSchema = z.object({ email: z.string().email().max(254) });
const GENERIC_RESPONSE = {
  message: "If that account can be recovered, a code will be sent to the configured recovery email.",
};

export async function POST(request: NextRequest) {
  const limit = authRateLimit(getClientIp(request));
  if (!limit.success) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const destination = getConfiguredRecoveryEmail();
    await connectToDatabase();
    const email = parsed.data.email.toLowerCase();
    const user = await User.findOne({ email }).select("_id");
    if (!user) return NextResponse.json(GENERIC_RESPONSE);

    const now = new Date();
    const code = createResetCode();
    try {
      await PasswordResetChallenge.findOneAndUpdate(
        { destination, nextAllowedAt: { $lte: now } },
        {
          $set: {
            email,
            codeHash: hashResetCode(destination, email, code),
            expiresAt: new Date(now.getTime() + RESET_CODE_TTL_MS),
            nextAllowedAt: new Date(now.getTime() + RESET_CODE_RESEND_DELAY_MS),
            attempts: 0,
            usedAt: null,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        // Keep the response identical for existing and unknown accounts.
        return NextResponse.json(GENERIC_RESPONSE);
      }
      throw error;
    }

    try {
      await sendResetCodeEmail(destination, email, code);
    } catch (error) {
      await PasswordResetChallenge.updateOne(
        { destination, email, usedAt: null },
        { $set: { usedAt: new Date() } }
      );
      console.error("Password recovery email could not be sent:", error);
      return NextResponse.json(GENERIC_RESPONSE);
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("Password recovery request failed:", error);
    return NextResponse.json({ error: "Password recovery is not available right now." }, { status: 503 });
  }
}
