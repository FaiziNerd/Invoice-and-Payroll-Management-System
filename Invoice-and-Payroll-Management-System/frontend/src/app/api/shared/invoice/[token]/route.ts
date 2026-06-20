import { fail, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;
  if (!token) {
    return fail("VALIDATION_ERROR", "Share token is required", 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_invoice", {
    p_share_token: token,
  });

  if (error) {
    return fail("INTERNAL_ERROR", error.message, 500);
  }

  if (!data) {
    return fail("NOT_FOUND", "Invoice not found", 404);
  }

  return ok(data);
}
