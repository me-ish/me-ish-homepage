begin;

create table public.natori_consultation_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  message_id uuid not null references public.natori_consultation_messages(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  created_at timestamptz not null default now()
);
create index natori_consultation_files_message_idx on public.natori_consultation_files(message_id);

-- Reserve a path before issuing its upload token. This bounds how many large
-- files an access link can upload, including abandoned uploads.
create table public.natori_consultation_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.natori_projects(id) on delete cascade,
  sender text not null check (sender in ('staff', 'client')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index natori_consultation_uploads_project_created_idx
  on public.natori_consultation_uploads(project_id, created_at desc);
alter table public.natori_consultation_uploads enable row level security;
revoke all on public.natori_consultation_uploads from public, anon, authenticated;
grant select, insert, update, delete on public.natori_consultation_uploads to service_role;

alter table public.natori_consultation_files enable row level security;
revoke all on public.natori_consultation_files from public, anon, authenticated;
grant select, insert on public.natori_consultation_files to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'natori-consultations', 'natori-consultations', false, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Invoked by the service role only, after the server verifies the uploaded
-- object. The message and file record are committed together.
create function public.natori_finalize_consultation_file(
  p_project_id uuid, p_sender text, p_storage_path text,
  p_file_name text, p_mime_type text, p_size_bytes bigint
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_message_id uuid;
begin
  if p_sender not in ('staff', 'client')
     or p_storage_path not like (p_project_id::text || '/%')
     or char_length(p_file_name) not between 1 and 200
     or p_size_bytes not between 1 and 52428800 then
    raise exception 'invalid_consultation_file';
  end if;
  insert into public.natori_consultation_messages (project_id, sender, body)
    values (p_project_id, p_sender, 'ファイルを共有しました') returning id into v_message_id;
  insert into public.natori_consultation_files
    (project_id, message_id, storage_path, file_name, mime_type, size_bytes)
    values (p_project_id, v_message_id, p_storage_path, p_file_name, p_mime_type, p_size_bytes);
  return v_message_id;
end;
$$;
revoke all on function public.natori_finalize_consultation_file(uuid, text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.natori_finalize_consultation_file(uuid, text, text, text, text, bigint) to service_role;

commit;
