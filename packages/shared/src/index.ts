export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type AsyncJobStatus = "queued" | "running" | "succeeded" | "failed";

export const AI_PROVIDERS = ["xfyun_spark", "openai", "anthropic", "gemini"] as const;
export const SEARCH_PROVIDERS = [
  "tavily",
  "exa",
  "google",
  "bing",
  "wikipedia",
  "github",
  "youtube",
] as const;
