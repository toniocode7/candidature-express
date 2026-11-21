-- Vitesse de l'app : temps d'ouverture mesuré sur chaque appareil, une ligne par jour et par appareil.
-- Sert à repérer un ralentissement au fil des mois (alerte) et à décider quand alléger l'affichage des listes.
create table if not exists public.app_perf (
  day      date not null default (now() at time zone 'Europe/Paris')::date,
  dev      text not null,
  n        int not null default 0,          -- nombre d'ouvertures mesurées
  open_sum bigint not null default 0,       -- ouverture complète (ms), somme
  open_max int not null default 0,
  exec_sum bigint not null default 0,       -- dont exécution du code de l'app et premier affichage (ms), somme
  cands    int not null default 0,          -- nombre de candidatures à ce moment
  primary key (day, dev)
);
alter table public.app_perf enable row level security;
revoke all on public.app_perf from anon;
drop policy if exists "app_perf: lecture" on public.app_perf;
create policy "app_perf: lecture" on public.app_perf for select to authenticated using (true);
grant select on public.app_perf to authenticated;

create or replace function public.ce_log_perf(p_open int, p_exec int, p_cands int, p_dev text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date; o int := greatest(0, least(coalesce(p_open, 0), 120000));
begin
  if o = 0 then return; end if;
  insert into public.app_perf (day, dev, n, open_sum, open_max, exec_sum, cands)
  values (d, left(coalesce(nullif(p_dev, ''), 'autre'), 20), 1, o, o, greatest(0, least(coalesce(p_exec, 0), 120000)), greatest(0, coalesce(p_cands, 0)))
  on conflict (day, dev) do update set n = app_perf.n + 1, open_sum = app_perf.open_sum + excluded.open_sum,
    open_max = greatest(app_perf.open_max, excluded.open_max), exec_sum = app_perf.exec_sum + excluded.exec_sum, cands = excluded.cands;
  delete from public.app_perf where day < d - 120;
end $$;
revoke all on function public.ce_log_perf(int, int, int, text) from public, anon;
grant execute on function public.ce_log_perf(int, int, int, text) to authenticated, service_role;
