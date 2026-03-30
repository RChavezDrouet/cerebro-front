-- 004_storage_buckets_and_policies.sql
-- Ejecutar cuarto. Crea buckets y políticas para evidencias PWA.

insert into storage.buckets (id, name, public)
values ('punch-selfies', 'punch-selfies', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('request-evidence', 'request-evidence', false)
on conflict (id) do nothing;

drop policy if exists punch_selfies_select on storage.objects;
create policy punch_selfies_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'punch-selfies'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists punch_selfies_insert on storage.objects;
create policy punch_selfies_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'punch-selfies'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists request_evidence_select on storage.objects;
create policy request_evidence_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'request-evidence'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

drop policy if exists request_evidence_insert on storage.objects;
create policy request_evidence_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'request-evidence'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
