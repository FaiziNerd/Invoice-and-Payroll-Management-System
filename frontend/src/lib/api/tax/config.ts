import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrgTaxConfig {
  id: string;
  companyId: string;
  name: string;
  rate: number;
  isInclusive: boolean;
  isActive: boolean;
}

export interface TaxTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  taxName: string;
  isInclusive: boolean;
}

export function calculateTaxTotals(
  lineSubtotal: number,
  config: Pick<OrgTaxConfig, "rate" | "isInclusive" | "name">
): TaxTotals {
  const rate = config.rate;

  if (config.isInclusive) {
    const total = lineSubtotal;
    const taxAmount = total - total / (1 + rate / 100);
    const subtotal = total - taxAmount;
    return {
      subtotal,
      taxAmount,
      total,
      taxRate: rate,
      taxName: config.name,
      isInclusive: true,
    };
  }

  const subtotal = lineSubtotal;
  const taxAmount = (subtotal * rate) / 100;
  const total = subtotal + taxAmount;

  return {
    subtotal,
    taxAmount,
    total,
    taxRate: rate,
    taxName: config.name,
    isInclusive: false,
  };
}

export async function getActiveOrgTaxConfig(
  supabase: SupabaseClient,
  companyId: string
): Promise<OrgTaxConfig | null> {
  const { data, error } = await supabase
    .from("org_tax_configs")
    .select("id, company_id, name, rate, is_inclusive, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    rate: Number(data.rate),
    isInclusive: data.is_inclusive,
    isActive: data.is_active,
  };
}

/** Default 0% tax when no org config exists. */
export function defaultTaxConfig(companyId: string): OrgTaxConfig {
  return {
    id: "",
    companyId,
    name: "Tax",
    rate: 0,
    isInclusive: false,
    isActive: true,
  };
}
