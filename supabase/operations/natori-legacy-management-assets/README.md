# Legacy management asset inventory and cutover preparation

Audit S01 concerns old management thumbnails and unclassified `refs/` objects
in the public `natori-portfolio` bucket. New thumbnails already use the private
`natori-management-assets/project-thumbs/{ownerId}/{projectId}.webp` path and
the authorized management gateway. Changing new uploads does not retire old URLs.

This directory prepares a selective cutover. `inventory.sql` is read-only and
does not perform a migration. No customer image or private manifest belongs in
GitHub, public logs, PR attachments, or CI artifacts.

## Candidate inventory

Run with a read-only database connection in the operator's private environment.
`owner_id` must be the verified Natori owner, never an inferred filename owner.
Use `psql --set=owner_id=... --file=inventory.sql` and retain the JSON result in a
private location outside the checkout. The script only reads the two legacy
prefixes, includes that owner's matched project thumbnails, and marks unmatched
objects (including references) as review-required. It returns no customer names,
emails, message bodies, image bytes, credentials, or signed URLs.

The 2026-10-17 aggregate preflight observed 12 legacy thumbnails and 3 references,
a public source bucket (42 objects total), and an empty private management bucket.
These are historical counts, not a future execution allowlist.

For each candidate, privately record:

- owner and object identity; public/contract permission; every saved/public alias,
  hero/sample/poster/shared dependency; whether it is safe to leave public;
- source bytes SHA-256, size, MIME and updated/version evidence;
- approved private target, any existing target, and rollback reference;
- exact proposed action: retain-public, copy-private, review-required, or retire
  after a separately reviewed and verified cutover.

The literal-reference field is only a positive hint. It cannot detect every URL
encoding, image transform, external reference, or previously shared URL. No match
must never automatically permit deletion. Unknown owner, unknown publication
permission, stale source evidence, and an existing target all stop automatic work.

## Reviewable cutover sequence

1. Confirm the exact source deployment, private-bucket configuration and current
   owner gateway. Preserve the private rollback manifest and source objects.
2. Classify candidates before touching production. If confidential material is
   exposed, prioritize containment of those exact objects with the owner.
3. Copy only approved thumbnails to the exact private target with overwrite
   disabled. A target conflict requires comparison and review; never replace a
   newer management upload. Verify SHA-256, bytes and media format after copying.
4. Check that the existing gateway reads the private target for its owner and
   denies an anonymous browser. Inventory the public gallery again for regressions.
   Copying alone does not stop the public legacy URL.
5. Recheck source version/hash and every reference immediately before individually
   retiring an approved source. Retire no ordinary gallery/hero/shared objects.
   Verify the known object URL and render-image aliases, including applicable CDN
   invalidation. Existing downloads and third-party caches cannot be recalled.
6. On failure, keep evidence and private copies, stop that candidate, and repair
   forward. Do not restore confidential material to a public path as a rollback.

Completion requires classified candidates, verified private copies where needed,
authorized gateway access, anonymous old-URL denial for retired sources and
unchanged ordinary public artwork. Production copy/retirement and provider/CDN
checks have not been performed by this preparation.
