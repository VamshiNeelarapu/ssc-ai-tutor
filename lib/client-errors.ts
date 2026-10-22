export interface AppError {
  message: string;
  code?: string;
  suggestion?: string;
  detail?: string;
  model?: string;
  status?: number;
}

export async function readApiError(
  res: Response,
  fallback: string,
  model?: string
): Promise<AppError> {
  const data = await res.json().catch(() => ({}));
  return {
    message: typeof data?.error === "string" && data.error ? data.error : fallback,
    code: typeof data?.code === "string" ? data.code : undefined,
    suggestion: typeof data?.suggestion === "string" ? data.suggestion : undefined,
    detail: typeof data?.detail === "string" ? data.detail : undefined,
    model: (typeof data?.model === "string" && data.model) || model,
    status: res.status,
  };
}

export function toAppError(err: unknown, fallback: string, model?: string): AppError {
  if (err instanceof TypeError) {
    return {
      message: "Could not reach the server.",
      code: "NETWORK_CLIENT",
      suggestion: "Check your internet connection and try again.",
      detail: err.message,
      model,
    };
  }
  return {
    message: err instanceof Error && err.message ? err.message : fallback,
    model,
  };
}
