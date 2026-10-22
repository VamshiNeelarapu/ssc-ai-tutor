export interface AIModel {
  id: string;
  label: string;
  badge: string;
  description: string;
  dailyLimit: boolean; // true = has daily rate limit (free tier)
  paid?: boolean; // billed per use; never used as an automatic fallback
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
    id: "nvidia/nemotron-3.5-lightning:free",
    label: "Nemotron Lightning",
    badge: "Free",
    description: "NVIDIA fast model — good for quick Q&A",
    dailyLimit: true,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    label: "Laguna S 2.1",
    badge: "Free",
    description: "Poolside's instruction-tuned model",
    dailyLimit: true,
  },
  {
    id: "deepseek/deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
    badge: "Paid",
    description: "Fixed snapshot, best value — about 4,000 chats per $1",
    dailyLimit: false,
    paid: true,
  },
  {
    id: "deepseek/deepseek-v4.1-flash-1017",
    label: "DeepSeek V4.1 Flash",
    badge: "Paid",
    description: "Newest DeepSeek flash model — about 1,100 chats per $1",
    dailyLimit: false,
    paid: true,
  },
  {
    id: "openai/gpt-5-nano",
    label: "GPT-5 Nano",
    badge: "Paid",
    description: "OpenAI's smallest GPT-5 — about 2,000 chats per $1",
    dailyLimit: false,
    paid: true,
  },
  {
    id: "openai/gpt-4.1-nano",
    label: "GPT-4.1 Nano",
    badge: "Paid",
    description: "OpenAI, answers straight away without a thinking delay — about 1,600 chats per $1",
    dailyLimit: false,
    paid: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    badge: "Paid",
    description: "OpenAI's dependable all-rounder — about 1,100 chats per $1",
    dailyLimit: false,
    paid: true,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    badge: "Paid",
    description: "Google's budget model with a very large context — about 1,600 chats per $1",
    dailyLimit: false,
    paid: true,
  },
];

export interface CustomModel {
  id: string;
  label: string;
}

export const MODELS_CHANGED_EVENT = "models:changed";
export const MAX_CUSTOM_MODELS = 20;
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:/_.-]*$/;

export const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const MODEL_STORAGE_KEY = "ssc_ai_model";

export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY);
    return stored || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setStoredModel(modelId: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  } catch {}
}
