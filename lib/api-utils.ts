import { NextResponse } from "next/server";
import { getSessionUser, JWTPayload } from "./auth";

export async function requireAuth(request: Request): Promise<JWTPayload> {
  const user = await getSessionUser(request);
  if (!user) {
    throw new AuthError("Authentication required");
  }
  return user;
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function apiError(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess(data: unknown, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (error instanceof AuthError) {
    return apiError(error.message, 401);
  }

  if (error instanceof Error) {
    const message =
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message;
    return apiError(message, 500);
  }

  return apiError("An unexpected error occurred", 500);
}
