import { fail, ok } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendInvoiceEmailAction,
  EmailDeliveryError,
  EmailNotConfiguredError,
} from "@/lib/server/send-invoice-email-action";

export const runtime = "nodejs";

const REMINDER_COOLDOWN_DAYS = 7;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function isRecentReminder(action: string | null, timestamp: string): boolean {
  if (!action?.includes("Payment reminder sent")) return false;
  const sentAt = new Date(timestamp);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - REMINDER_COOLDOWN_DAYS);
  return sentAt >= cutoff;
}

async function findCompanyActor(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string
): Promise<{ userId: string; userName: string } | null> {
  const { data: member } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (!member?.user_id) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", member.user_id)
    .maybeSingle();

  return {
    userId: member.user_id,
    userName: profile?.name?.trim() || "System",
  };
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return fail("UNAUTHORIZED", "Invalid or missing cron secret", 401);
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .select("id, name");

  if (companiesError) {
    return fail("INTERNAL_ERROR", companiesError.message, 500);
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const company of companies ?? []) {
    const actor = await findCompanyActor(admin, company.id);
    if (!actor) {
      skipped += 1;
      continue;
    }

    const { data: invoices, error: invoicesError } = await admin
      .from("invoices")
      .select(
        "id, status, due_date, invoice_history(id, action, timestamp)"
      )
      .eq("company_id", company.id)
      .in("status", ["sent", "overdue"])
      .lt("due_date", today);

    if (invoicesError) {
      errors.push(`${company.name}: ${invoicesError.message}`);
      continue;
    }

    for (const invoice of invoices ?? []) {
      const history = (invoice.invoice_history ?? []) as Array<{
        action: string | null;
        timestamp: string;
      }>;

      const recentReminder = history.some((h) => isRecentReminder(h.action, h.timestamp));
      if (recentReminder) {
        skipped += 1;
        continue;
      }

      try {
        await sendInvoiceEmailAction(
          admin,
          company.id,
          invoice.id,
          actor.userId,
          actor.userName,
          "reminder"
        );
        sent += 1;
      } catch (err) {
        if (err instanceof EmailNotConfiguredError) {
          errors.push("Email not configured — set RESEND_API_KEY and RESEND_FROM_EMAIL");
          break;
        }
        const message =
          err instanceof EmailDeliveryError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        errors.push(`Invoice ${invoice.id}: ${message}`);
      }
    }
  }

  return ok({ sent, skipped, errors });
}
