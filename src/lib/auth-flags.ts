// Google OAuth isn't enabled in Supabase yet (needs a Google Cloud Console
// client ID/secret configured there) — attempting it returns a 400. The
// button, handler, and redirect route are otherwise fully wired; flip this
// once the provider is configured (see docs/POLISH-BACKLOG.md).
export const GOOGLE_AUTH_ENABLED = false;
