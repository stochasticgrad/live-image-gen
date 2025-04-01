import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from './logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    const errorMsg = "Supabase client error: Missing NEXT_PUBLIC_SUPABASE_URL environment variable.";
    logger.error(errorMsg);
    throw new Error(errorMsg); // Fail fast
}
if (!supabaseServiceKey) {
    const errorMsg = "Supabase client error: Missing SUPABASE_SERVICE_ROLE_KEY environment variable.";
    logger.error(errorMsg);
    throw new Error(errorMsg); // Fail fast
}

let supabase: SupabaseClient; // Can be non-nullable now

try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });
    logger.info('[lib/supabaseClient] Supabase client initialized successfully.');
} catch (error) {
    logger.error('[lib/supabaseClient] Error initializing Supabase client:', error);
    // Re-throw or throw a new error to halt initialization
    throw new Error(`[lib/supabaseClient] Failed to initialize Supabase client: ${error instanceof Error ? error.message : String(error)}`);
}

export default supabase;