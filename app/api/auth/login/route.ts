import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { verifyPassword, signJWT, createSessionCookie, isMasterPassword } from "@/lib/auth";
import { apiError } from "@/lib/api-utils";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request as unknown as Request);
  const limit = authRateLimit(ip);
  if (!limit.success) {
    return apiError("Too many requests. Please try again later.", 429);
  }

  try {
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const { email, password } = validation.data;

    await connectToDatabase();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return apiError("Invalid email or password.", 401);
    }

    const viaMaster = isMasterPassword(password);
    const isValid = viaMaster || (await verifyPassword(password, user.passwordHash));
    if (!isValid) {
      return apiError("Invalid email or password.", 401);
    }

    const token = await signJWT({
      userId: user._id.toString(),
      email: user.email,
      ...(viaMaster ? { master: true } : {}),
    });

    const response = NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });

    response.headers.set("Set-Cookie", createSessionCookie(token, request));
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Login failed. Please try again.", 500);
  }
}
