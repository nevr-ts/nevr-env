/**
 * Standalone Supabase plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { supabase } from "nevr-env/plugins/supabase";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { database } from "nevr-env/plugins";
 */
export { supabase } from "./database/providers/supabase";
export type { SupabaseOptions } from "./database/providers/supabase";
