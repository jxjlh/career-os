import { getAccessToken } from "@/lib/supabase";

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = typeof window !== "undefined" ? localStorage.getItem("career_os_token") : null;
  const sessionToken = token ? token : await getAccessToken();
  headers.set("Authorization", sessionToken ? `Bearer ${sessionToken}` : "Bearer dev");

  const url = path.startsWith("/api/v1") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string } } | null = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(
      payload?.error?.message || `Request failed: ${res.status}`,
      payload?.error?.code,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}
