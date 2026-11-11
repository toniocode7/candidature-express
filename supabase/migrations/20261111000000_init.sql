-- Candidature Express : stockage privé des données de l'app.
-- Chaque ligne appartient à un compte ; personne d'autre ne peut la lire ni l'écrire.
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  col        text not null,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, col, id)
);

alter table public.docs enable row level security;

drop policy if exists "docs: propriétaire seulement" on public.docs;
create policy "docs: propriétaire seulement" on public.docs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.docs from anon;

-- Synchro instantanée entre l'iPhone et le Mac.
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
