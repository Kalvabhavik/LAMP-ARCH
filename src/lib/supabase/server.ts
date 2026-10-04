import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";

let cached: SupabaseClient | null | undefined;

/**
 * Service-role client for trusted server-side writes (bypasses RLS).
 * Returns null when env is not configured so callers can return 503.
 */
export function getServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}

export function submissionsBucket(): string {
  return process.env.SUPABASE_SUBMISSIONS_BUCKET ?? "submissions";
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match ? match[1] : null;
}

export type PlayerRow = {
  id: string;
  name: string;
  gender: string;
  current_level: number;
  current_location: string;
  completed_missions: string[];
  score: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Verify the bearer token → Supabase user, or throw 401. */
export async function requireUser(request: Request): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = getServiceClient();
  if (!supabase) throw new ApiError(503, "SUPABASE_NOT_CONFIGURED", "Supabase is not configured.");
  const token = bearerToken(request);
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token.");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token.");
  return { supabase, user: data.user };
}

/** requireUser + the players row (404 PLAYER_NOT_FOUND when not registered). */
export async function requirePlayer(request: Request): Promise<{ supabase: SupabaseClient; user: User; player: PlayerRow }> {
  const { supabase, user } = await requireUser(request);
  const { data, error } = await supabase.from("players").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new ApiError(500, "DB_ERROR", "Failed to load player.");
  if (!data) throw new ApiError(404, "PLAYER_NOT_FOUND", "Register a player first.");
  return { supabase, user, player: data as PlayerRow };
}
