import { createHmac, randomInt, timingSafeEqual } from "crypto";

export const RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 5;
export const RESET_CODE_RESEND_DELAY_MS = 5 * 60 * 1000;

function getOtpPepper(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured to use password recovery.");
  }
  return "development-only-password-reset-pepper";
}

export function createResetCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashResetCode(destination: string, email: string, code: string): string {
  return createHmac("sha256", getOtpPepper())
    .update(`${destination}:${email}:${code}`)
    .digest("hex");
}

export function resetCodeHashesMatch(expected: string, candidate: string): boolean {
  const expectedBytes = Buffer.from(expected, "hex");
  const candidateBytes = Buffer.from(candidate, "hex");
  return expectedBytes.length === candidateBytes.length && timingSafeEqual(expectedBytes, candidateBytes);
}

export async function sendResetCodeEmail(destination: string, accountEmail: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Resend password recovery settings are incomplete.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [destination],
      subject: "SSC AI Tutor password reset code",
      text: [
        `An OTP was requested to reset the password for ${accountEmail}.`,
        "",
        `Your code is ${code}.`,
        "This code expires in 10 minutes and can be used once.",
        "If you did not request this, you can ignore this email.",
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    // Do not log provider response bodies, which can include recipient details.
    throw new Error(`Email provider returned status ${response.status}.`);
  }
}

export function getConfiguredRecoveryEmail(): string {
  const email = process.env.PASSWORD_RESET_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("PASSWORD_RESET_EMAIL must be configured with a valid email address.");
  }
  return email;
}
