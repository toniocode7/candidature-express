-- Offres récoltées en arrière-plan (GitHub Actions), avant le tri par l'app.
create table if not exists public.raw_offers (
  id           text primary key,          -- adresse normalisée de l'offre
  source       text not null,             -- indeed, linkedin, francetravail, hellowork...
  data         jsonb not null,            -- titre, entreprise, lieu, contrat, salaire, url, date...
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  evaluated_at timestamptz                -- passée au tri de l'app
);
create index if not exists raw_offers_pending on public.raw_offers (evaluated_at, last_seen);
alter table public.raw_offers enable row level security;
drop policy if exists "raw_offers: lecture" on public.raw_offers;
create policy "raw_offers: lecture" on public.raw_offers for select to authenticated using (true);
drop policy if exists "raw_offers: marquer comme triée" on public.raw_offers;
create policy "raw_offers: marquer comme triée" on public.raw_offers for update to authenticated using (true) with check (true);
revoke all on public.raw_offers from anon;
revoke insert, delete on public.raw_offers from authenticated;
