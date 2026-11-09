import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

/**
 * Same client, loosely typed. Used for tables that the generated
 * database types do not yet describe (stale type generation).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedSupabase as unknown as SupabaseClient<any>;
