do $$ begin
  if current_setting('phase_t.sandbox',true) is distinct from 'ephemeral' then raise exception 'Sandbox required'; end if;
end $$;
-- Match the production catalogue's existing delivery constraints before applying Phase 1.
alter table public.natori_delivery_files alter column project_id set not null,
  alter column folder set not null,alter column storage_path set not null,
  alter column file_name set not null,alter column size_bytes set not null,
  alter column size_bytes set default 0,alter column created_at set not null,
  add constraint natori_delivery_files_storage_path_key unique(storage_path),
  add constraint natori_delivery_files_folder_check check(folder in ('rough','final'));
alter table public.natori_delivery_files drop constraint natori_delivery_files_project_id_fkey;
alter table public.natori_delivery_files add constraint natori_delivery_files_project_id_fkey
  foreign key(project_id) references public.natori_projects(id) on delete cascade;
