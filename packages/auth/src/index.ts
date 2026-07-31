import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AuthProvider = "email" | "google" | "github" | "microsoft" | "apple";

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
  providers?: AuthProvider[];
}

export function createSupabaseClient(config: SupabaseAuthConfig): SupabaseClient {
  return createClient(config.url, config.anonKey);
}

export function supportedProviders(): AuthProvider[] {
  return ["email", "google", "github", "microsoft", "apple"];
}
