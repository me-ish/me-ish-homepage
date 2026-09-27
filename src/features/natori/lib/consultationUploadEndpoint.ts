// Signed TUS has its own route in Storage. Never fall back to anon RLS upload.
export function consultationUploadEndpoint(storageUrl: string): string {
  const origin = new URL(storageUrl);
  if (origin.username || origin.password || !["http:", "https:"].includes(origin.protocol)) throw new Error("Invalid Storage origin");
  if (origin.hostname.endsWith(".supabase.co") && !origin.hostname.endsWith(".storage.supabase.co")) {
    origin.hostname = origin.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  }
  return `${origin.origin}/storage/v1/upload/resumable/sign`;
}
