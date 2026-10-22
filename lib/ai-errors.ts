import { NextResponse } from "next/server";
import { EmptyAIResponseError, DraftGenerationError } from "./ai";
import { DigestGenerationError } from "./ai-digest";
import { NewsFetchError } from "./news-feeds";

export type AIErrorCode =
  | "RATE_LIMITED"
  | "RATE_LIMITED_APP"
  | "NO_CREDITS"
  | "AUTH"
  | "MODEL_NOT_FOUND"
  | "INVALID_REQUEST"
  | "CONTEXT_TOO_LONG"
  | "EMPTY_RESPONSE"
  | "INCOMPLETE_RESPONSE"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK"
  | "NOT_CONFIGURED"
  | "NO_SOURCES"
  | "UNKNOWN";

export interface AIErrorPayload {
  error: string;
  code: AIErrorCode;
  status: number;
  suggestion?: string;
  detail?: string;
  model?: string;
}

interface ProviderErrorLike {
  status?: number;
  message?: string;
  code?: string;
  error?: { message?: string; code?: unknown; metadata?: { provider_name?: string; raw?: unknown } };
}

function truncate(text: string, max = 400): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function buildDetail(e: ProviderErrorLike): string | undefined {
  const lines: string[] = [];
  if (e.status) lines.push(`HTTP status: ${e.status}`);
  const provider = e.error?.metadata?.provider_name;
  if (provider) lines.push(`Provider: ${provider}`);
  const providerMessage = e.error?.message || e.message;
  if (providerMessage) lines.push(`Message: ${truncate(String(providerMessage))}`);
  const raw = e.error?.metadata?.raw;
  if (raw) lines.push(`Raw: ${truncate(typeof raw === "string" ? raw : JSON.stringify(raw))}`);
  return lines.length ? lines.join("\n") : undefined;
}

export function classifyAIError(err: unknown, model?: string): AIErrorPayload {
  const modelName = model || process.env.AI_MODEL || "the selected model";

  if (err instanceof EmptyAIResponseError) {
    return {
      error: err.message,
      code: "EMPTY_RESPONSE",
      status: 502,
      suggestion:
        "Try sending the message again, or switch to a different model. Reasoning models sometimes run out of tokens while thinking.",
      detail: err.finishReason ? `Finish reason: ${err.finishReason}` : undefined,
      model,
    };
  }

  if (err instanceof NewsFetchError) {
    return {
      error: "Could not fetch today's news from any of the news sources.",
      code: "NO_SOURCES",
      status: 503,
      suggestion:
        "Check that the server has internet access (a firewall or VPN can block news sites), then try again.",
      detail: err.failures.join("\n"),
    };
  }

  if (err instanceof DigestGenerationError) {
    return {
      error: `The AI could not turn the news into a usable list (tried ${err.modelsTried} model${err.modelsTried === 1 ? "" : "s"}).`,
      code: "INCOMPLETE_RESPONSE",
      status: 502,
      suggestion: "Try again, or switch to a different model in the chat model picker.",
      detail: `Last problem: ${err.reason}`,
      model,
    };
  }

  if (err instanceof DraftGenerationError) {
    return {
      error: `The AI could not produce a complete study note (tried ${err.modelsTried} model${err.modelsTried === 1 ? "" : "s"}).`,
      code: "INCOMPLETE_RESPONSE",
      status: 502,
      suggestion:
        "Try again, or switch to a larger model. Very long conversations can also cause cut-off answers.",
      detail: `Last problem: ${err.reason}`,
      model,
    };
  }

  const e = (err ?? {}) as ProviderErrorLike;
  const status = typeof e.status === "number" ? e.status : undefined;
  const text = `${e.error?.message ?? ""} ${e.message ?? ""}`.toLowerCase();

  if (status === 429) {
    return {
      error: `${modelName} is rate limited right now.`,
      code: "RATE_LIMITED",
      status: 429,
      suggestion:
        "Free models have per-minute and daily limits. Wait a bit, or switch to another model.",
      detail: buildDetail(e),
      model,
    };
  }

  if (status === 402 || /insufficient (credits|funds)|payment required/.test(text)) {
    return {
      error: `Your AI provider account does not have enough credits for ${modelName}.`,
      code: "NO_CREDITS",
      status: 402,
      suggestion: "Add credits with your provider, or switch to a free model.",
      detail: buildDetail(e),
      model,
    };
  }

  if (status === 401 || status === 403) {
    return {
      error:
        status === 401
          ? "The AI provider rejected the API key."
          : `The AI provider denied access to ${modelName}.`,
      code: "AUTH",
      status,
      suggestion:
        status === 401
          ? "The AI_API_KEY on the server is missing, wrong or expired. Update it and restart the app."
          : "This model may need special access or a paid plan. Switch to another model, or check your provider account.",
      detail: buildDetail(e),
      model,
    };
  }

  if (
    status === 404 ||
    /model.*(not found|does not exist|not available|unknown)|no endpoints found/.test(text)
  ) {
    return {
      error: `The model "${modelName}" was not found by your AI provider.`,
      code: "MODEL_NOT_FOUND",
      status: 404,
      suggestion:
        "The model ID may be mistyped, renamed or retired. Check it in Account → AI Models, or switch to another model.",
      detail: buildDetail(e),
      model,
    };
  }

  if (/context|maximum.*length|too many tokens|token limit|too long/.test(text)) {
    return {
      error: "This conversation is too long for the selected model.",
      code: "CONTEXT_TOO_LONG",
      status: 400,
      suggestion: "Start a new chat, or switch to a model with a larger context window.",
      detail: buildDetail(e),
      model,
    };
  }

  if (status === 400 || status === 422) {
    return {
      error: `The AI provider rejected the request for ${modelName}.`,
      code: "INVALID_REQUEST",
      status: 400,
      suggestion:
        "The model may not support this kind of request. Try another model, or check the model ID in Account → AI Models.",
      detail: buildDetail(e),
      model,
    };
  }

  if (
    (status !== undefined && status >= 500) ||
    status === 408 ||
    /timeout|timed out|overloaded|unavailable|temporarily/.test(text)
  ) {
    return {
      error: `The AI provider is having trouble serving ${modelName} right now.`,
      code: "PROVIDER_UNAVAILABLE",
      status: 503,
      suggestion: "Try again in a moment, or switch to another model.",
      detail: buildDetail(e),
      model,
    };
  }

  if (status === undefined && /connect|network|fetch failed|enotfound|econnrefused|econnreset/.test(`${text} ${(e.code ?? "").toLowerCase()}`)) {
    return {
      error: "The server could not reach the AI provider.",
      code: "NETWORK",
      status: 503,
      suggestion: "Check the server's internet connection and try again.",
      detail: buildDetail(e),
      model,
    };
  }

  return {
    error: e.message
      ? `AI request failed: ${truncate(e.message, 200)}`
      : "The AI request failed for an unknown reason.",
    code: "UNKNOWN",
    status: 503,
    suggestion: "Try again, or switch to another model.",
    detail: buildDetail(e),
    model,
  };
}

export function aiErrorResponse(err: unknown, model?: string): NextResponse {
  const { status, ...body } = classifyAIError(err, model);
  return NextResponse.json(body, { status });
}

export function aiRateLimitResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "You are sending AI requests too quickly.",
      code: "RATE_LIMITED_APP",
      suggestion: "Wait a few seconds and try again.",
    },
    { status: 429 }
  );
}

export function aiNotConfiguredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: "AI is not configured on the server.",
      code: "NOT_CONFIGURED",
      suggestion: "Set AI_API_KEY in the server's environment variables and restart the app.",
    },
    { status: 503 }
  );
}
