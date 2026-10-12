# SEC-01 / SEC-01B deployment and selective legacy-asset retirement

This is a reviewed procedure candidate, not permission to run production commands. PR #163 remains stacked on PR #162. No production object, bucket, policy, customer row, merge or deployment is changed by this procedure. The full active migration lane has a known pre-existing migration 7 duplicate CHECK blocker; the SEC01 fixture uses only the named baseline, security hardening and SEC01 forward migration and is not a full replay certificate.

## Security contract

| Asset or response | Boundary |
| --- | --- |
| New project thumbnail | Dedicated private bucket; every application GET requires management authorization and current target-project ownership, rechecked after download. |
| New portfolio image | Private immutable object and owner metadata; upload does not publish. Publication is a successful revision-checked save of a visible reference. |
| New process video | Exact-path signed upload with overwrite disabled; declared size, owner, object path, Storage MIME/size and bounded MP4 header verification must succeed before it is ready to save. |
| Public JSON, SSR, RSC and OG | Shared public projection removes private works, associated links, hidden-image aliases and dependent artwork references, and explicitly private video. |
| Public media gateway | Current saved publication and trusted owner are checked before download and again after upstream headers. Failure denies bytes; responses stream with no-store and nosniff. |
| Browser Data API / Storage | Browser roles cannot read portfolio content/asset metadata or directly read/write the private bucket. Signed upload is a separate, scoped write bearer. |
| Editor save | Revision compare-and-save allows only one concurrent revision update. A conflict or failed save keeps local edits; editing during save preserves later changes. |
| Image cache | Managed images bypass Next optimization and middleware refuses protected optimizer sources. Public gallery images retain their existing optimizer path. |

The private-retention/public-gateway architecture is the authorized continuation of the handoff. Public traffic adds authorization reads and server-side Storage streaming. Measure origin latency, database load, egress and Function duration under representative load before the production window. Signed upload tokens last up to two hours; they are not read capabilities and their declared size is enforced during finalization, while the bucket independently limits uploads to 50,000,000 bytes.

## Code/schema window

1. Assign the executor, approver, security reviewer and rollback owner. Verify the exact approved SEC01 commit, migration checksum, baseline/archive checksums, rollback artifact and exact-head CI evidence. Review the target environment privately; do not publish project metadata or credentials in evidence.
2. Establish a temporary maintenance/ingress rule for the old editor, upload/finalize and save routes. If old public readers can still serialize private saved content, also hold those public readers/SSR/RSC/OG routes behind maintenance until secure code is live. Verify anonymous denial from outside the origin. Existing public Storage/CDN URLs remain a separate residual and are not cured by maintenance.
3. Take approved database/Storage restore evidence. Apply only the approved additive SEC01 schema migration after its configuration checks pass. It rejects an existing public bucket or differing MIME/size policy; do not silently overwrite an existing bucket's configuration. This is SEC01's schema-before-secure-code dependency, separate from PR162's entry-reader deployment order. Do not replay the known-broken complete migration lane as part of this window.
4. Deploy the exact secure code while maintenance stays in place. Verify the metadata table, revision trigger and service-only RPC/grants, private bucket limit/MIME policy and browser denial in the approved target. Never broaden browser grants to make a failed application test pass.
5. Run synthetic acceptance in the approved target: public DTOs and private media denial, authorized editor and owner thumbnails, private upload-before-save, revision races, normal/TUS signed token confinement, 50 MB video finalization/streaming/ranges, publication removal, failed reads/saves and gallery image regression. Use generated data only and keep fixture tokens/logs private.
6. Remove maintenance only after the secure origin passes the gates. Observe denial/error rates and latency. A device playback check on a real iPhone remains an explicit acceptance item; Node HTTP tests and desktop/emulated browsers do not certify it.

If a gate fails, keep maintenance in place and repair forward. An ordinary rollback to pre-SEC01 readers or upload handlers is unsafe because it can expose full saved content or upload new drafts into a public bucket. Roll back only to a reviewed code artifact that retains the public projection, private uploads, owner checks, revision save boundary and optimizer denial, or keep all affected routes disabled. Preserve the additive private bucket/metadata/revision schema and restrictive policies during code rollback; do not restore anonymous content grants, move private objects back to a public bucket, or delete metadata to satisfy old code. Database schema removal and restoration require a separate reviewed maintenance procedure and approval.

## Selective legacy inventory and conversion

Prepare this inventory privately before requesting a production migration approval. It contains sensitive owner/path associations and must not be committed to GitHub or a public CI artifact.

1. Enumerate only the approved owner's legacy management thumbnail paths and saved draft/private portfolio image/video references. Identify the owning project/work and every public saved reference, including query/encoded/render-image aliases, hero/about/sample/poster references and shared artwork. Classify unknown ownership and multiply referenced objects as review-required. Keep ordinary gallery images, artworks, avatars and banners outside automatic conversion.
2. Produce a per-object manifest: source bucket/path, source size/MIME/content hash, confirmed owner, private target path/asset ID, saved reference locations, public-reference dependencies, proposed action and rollback source. Record object/version conflicts and dangling references. Do not infer permission from a guessed filename or signed URL.
3. Submit a concrete object list, schema/code prerequisites, verification commands, affected public pages, restoration plan, retention period and retirement window for explicit approval. No bulk privatization of the shared natori-portfolio bucket and no automatic deletion of shared artwork are authorized.
4. During the approved maintenance window, copy each approved management/draft object to the dedicated private bucket; preserve the source. Verify the copy's hash, byte size, MIME, path ownership and metadata. For legacy video, verify the same bounded media contract before marking it ready. Failed copies leave source references unchanged.
5. Update only approved references using the current revision boundary. A stale revision stops that object's cutover; reload and reassess instead of overwriting concurrent edits. Verify anonymous known-URL denial at the application/private Storage routes and authorized manager access, plus unchanged ordinary public gallery images. Keep the per-object rollback manifest and source until the review window closes.
6. Only after separate retirement approval, retire individual legacy objects whose private ownership and absence of legitimate public/shared references are proven. Recheck references and object hashes immediately before retirement. Unknown/shared objects remain. A selective CDN purge, where supported, and external cache/customer communication steps belong in that approved plan; they do not guarantee removal of browser copies, social previews, downloads or third-party caches.
7. On a cutover failure, restore the prior approved references from the manifest under the revision boundary, retaining private copies for investigation. Do not restore private publication by accident. A legacy public source cannot be treated as a privacy-preserving rollback; keeping affected origin routes disabled may be required until forward repair.

## Evidence limits

Local unit/type/lint/static results and exact source hashes are recorded in the checkpoint. The real Auth/PostgreSQL/PostgREST/Storage/Next matrix is a digest-pinned disposable CI job with generated users/media on an internal network. Only sanitized result names, schema drift outcomes and critical source/image hashes are uploaded; runtime JSON, tokens, generated user sessions and private logs are excluded. A clean CI checkout must still have a nonempty critical-source inventory and separately identify the PR head and tested merge checkout.

The fixture demonstrates origin behavior only. Existing legacy public Storage URLs, CDN copies, browser caches and social previews remain a qualified residual until an approved selective conversion/retirement is completed. No claim of instant global revocation, successful production migration, complete migration-lane replay, real iPhone playback or production performance follows from the fixture.
