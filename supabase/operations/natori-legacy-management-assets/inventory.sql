-- Read-only, owner-scoped candidate inventory. This does not copy, publish,
-- change references, alter a bucket, or delete any object.
-- psql variable owner_id is required. Keep the output private; it contains
-- owner/project/storage-path associations and is not a public CI artifact.
begin transaction read only;

with candidates as (
  select o.bucket_id, o.name, o.updated_at, o.metadata,
         p.id as project_id, p.user_id as owner_id
    from storage.objects o
    left join public.natori_projects p
      on o.name = 'project-thumbs/' || p.id::text || '.webp'
   where o.bucket_id = 'natori-portfolio'
     and (o.name like 'project-thumbs/%' or o.name like 'refs/%')
     and (p.user_id = :'owner_id'::uuid or p.id is null)
)
select jsonb_build_object(
  'schemaVersion', 1,
  'generatedAt', transaction_timestamp(),
  'mode', 'inventory-only',
  'sourcePublic', (select public from storage.buckets where id = 'natori-portfolio'),
  'targetPrivate', (select not public from storage.buckets where id = 'natori-management-assets'),
  'objects', coalesce(jsonb_agg(jsonb_build_object(
    'sourceBucket', c.bucket_id,
    'sourcePath', c.name,
    'sourceUpdatedAt', c.updated_at,
    'sourceDeclaredSize', c.metadata->>'size',
    'sourceDeclaredMime', c.metadata->>'mimetype',
    'projectId', c.project_id,
    'ownerId', c.owner_id,
    'ownerConfirmedByProjectPath', c.project_id is not null,
    'targetBucket', case when c.project_id is not null then 'natori-management-assets' end,
    'targetPath', case when c.project_id is not null
      then 'project-thumbs/' || c.owner_id::text || '/' || c.project_id::text || '.webp' end,
    'privateTargetExists', case when c.project_id is not null then exists (
      select 1 from storage.objects private_object
       where private_object.bucket_id = 'natori-management-assets'
         and private_object.name = 'project-thumbs/' || c.owner_id::text || '/' || c.project_id::text || '.webp'
    ) else null end,
    -- A positive literal match is useful; a negative match is NOT proof that
    -- public/encoded/render-image/shared references do not exist.
    'literalSavedReference', exists (
      select 1 from public.natori_portfolio_content site
       where strpos(site.content::text, c.name) > 0
    ),
    'classification', 'review-required',
    'publicReferenceReviewComplete', false,
    'sourceSha256', null,
    'copyVerified', false,
    'retirementApproved', false
  ) order by c.name), '[]'::jsonb)
) as private_inventory
from candidates c;

rollback;
