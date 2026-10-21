import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { hashPassword, signJWT, createSessionCookie } from "@/lib/auth";
import { apiError } from "@/lib/api-utils";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request as unknown as Request);
  const limit = authRateLimit(ip);
  if (!limit.success) {
    return apiError("Too many requests. Please try again later.", 429);
  }

  try {
    const body = await request.json();
    const validation = RegisterSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const { name, email, password } = validation.data;

    await connectToDatabase();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return apiError("An account with this email already exists.", 409);
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash });

    const token = await signJWT({
      userId: user._id.toString(),
      email: user.email,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    );

    response.headers.set("Set-Cookie", createSessionCookie(token, request));
    return response;
  } catch (error) {
    console.error("Register error:", error);
    return apiError("Registration failed. Please try again.", 500);
  }
}
