import { createClient } from "@/lib/supabase/server";

import {
  toCompanyInput,
  toMacRow,
  toProductMapRow,
  toSegmentRow,
  toValidationRow,
  type NzCompanyRow,
  type NzMacRow,
  type NzProductMapRow,
  type NzSegmentRow,
  type NzValidationRow,
} from "./rows";
import type { ScenarioData } from "./types";

const PAGE_SIZE = 1000;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function fetchAll<T>(supabase: SupabaseServerClient, table: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Loads every nz_* table once per request. Never throws: failures come back in `error`. */
export async function loadScenarioData(): Promise<ScenarioData> {
  try {
    const supabase = await createClient();
    const [companies, mac, products, segments, validation] = await Promise.all([
      fetchAll<NzCompanyRow>(supabase, "nz_company_inputs"),
      fetchAll<NzMacRow>(supabase, "nz_mac_costs"),
      fetchAll<NzProductMapRow>(supabase, "nz_product_map"),
      fetchAll<NzSegmentRow>(supabase, "nz_segments"),
      fetchAll<NzValidationRow>(supabase, "nz_validation_2019"),
    ]);
    return {
      companies: companies.map(toCompanyInput),
      macRows: mac.map(toMacRow),
      productMap: products.map(toProductMapRow),
      segments: segments.map(toSegmentRow),
      validation: validation.map(toValidationRow),
      error: null,
    };
  } catch (err) {
    console.error(err);
    return {
      companies: [],
      macRows: [],
      productMap: [],
      segments: [],
      validation: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
