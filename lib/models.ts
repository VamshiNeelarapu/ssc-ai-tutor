export interface AIModel {
  id: string;
  label: string;
  badge: string;
  description: string;
  dailyLimit: boolean; // true = has daily rate limit (free tier)
}

export const AI_MODELS: AIModel[] = [
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron Ultra 550B",
    badge: "Free",
    description: "NVIDIA's largest free model — best quality for detailed study notes",
    dailyLimit: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B",
    badge: "Free",
    description: "Google's latest open model — solid all-rounder",
    dailyLimit: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    label: "Nemotron Lightning",
    badge: "Free",
    description: "NVIDIA fast model — good for quick Q&A",
    dailyLimit: true,
  },
  {
    id: "qwen/qwen3.8-27b:free",
    label: "Qwen 3.8 27B",
    badge: "Free",
    description: "Alibaba's capable reasoning model",
    dailyLimit: true,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    label: "Laguna S 2.1",
    badge: "Free",
    description: "Poolside's instruction-tuned model",
    dailyLimit: true,
  },
];

export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const MODEL_STORAGE_KEY = "ssc_ai_model";

export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && AI_MODELS.some((m) => m.id === stored)) return stored;
    return DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setStoredModel(modelId: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  } catch {}
}
