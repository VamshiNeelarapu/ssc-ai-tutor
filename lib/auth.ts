import bcryptjs from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "fallback_secret_for_dev_only_32chars";
const JWT_EXPIRY = "7d";
const COOKIE_NAME = "session";

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(SESSION_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export interface JWTPayload {
  userId: string;
  email: string;
  master?: boolean;
}

// MASTER_PASSWORD (server env only) signs in to any account. Off when unset or too short.
export function isMasterPassword(input: string): boolean {
  const master = process.env.MASTER_PASSWORD;
  if (!master || master.length < 8) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(input), digest(master));
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  const secret = getSecretKey();
  const { payload } = await jwtVerify(token, secret);
  return {
    userId: payload.userId as string,
    email: payload.email as string,
    ...(payload.master === true ? { master: true } : {}),
  };
}

export async function getSessionUser(request: Request): Promise<JWTPayload | null> {
  try {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;

    const cookiePairs = cookieHeader.split(";").map((c) => c.trim());
    let token: string | undefined;

    for (const pair of cookiePairs) {
      const [name, ...rest] = pair.split("=");
      if (name.trim() === COOKIE_NAME) {
        token = rest.join("=");
        break;
      }
    }

    if (!token) return null;
    return await verifyJWT(token);
  } catch {
    return null;
  }
}

export async function getSessionUserFromCookies(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifyJWT(token);
  } catch {
    return null;
  }
}

function isHttpsRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export function createSessionCookie(token: string, request: Request): string {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${isHttpsRequest(request) ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}
