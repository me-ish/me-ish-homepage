/**
 * Escape special characters for Supabase/PostgreSQL ilike patterns.
 * Characters `%`, `_`, and `\` are escaped so they match literally.
 */
export function escapeIlikePattern(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
