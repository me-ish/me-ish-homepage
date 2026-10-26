// Nonsecret acceptance identity only. No Google client ID/secret is known or
// invented here. The original three actors and their passwords stay unchanged.
import { plan } from './plan.mjs';
export const googlePlan = Object.freeze({
  email: 'info@me-ish.art',
  callbackPath: '/auth/callback',
  destination: '/natori/dashboard/cases',
  staffEmails: [plan.actors.staff.email, 'info@me-ish.art'],
});
