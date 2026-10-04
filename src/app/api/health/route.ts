import { getServiceClient } from "@/lib/supabase/server";
import { okJson, errorJson } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) {
    return okJson({ supabase: "not_configured" });
  }
  const { error } = await supabase.from("players").select("id", { count: "exact", head: true });
  if (error) {
    return errorJson(503, "SUPABASE_UNREACHABLE", "Supabase did not respond.");
  }
  return okJson({ supabase: "ok" });
}
