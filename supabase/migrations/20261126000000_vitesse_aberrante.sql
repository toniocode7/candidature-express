-- Vitesse : une ouverture de plus de 30 s n'est pas une vraie ouverture (app mise en pause par l'iPhone pendant
-- le lancement). Elle est ignorée, même si elle vient d'une ancienne version de l'app.
create or replace function public.ce_log_perf(p_open int, p_exec int, p_cands int, p_dev text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date; o int := greatest(0, least(coalesce(p_open, 0), 120000));
begin
  if not public.ce_is_owner() then return; end if;
  if o = 0 or o > 30000 or coalesce(p_exec, 0) > 30000 then return; end if;
  insert into public.app_perf (day, dev, n, open_sum, open_max, exec_sum, cands)
  values (d, left(coalesce(nullif(p_dev, ''), 'autre'), 20), 1, o, o, greatest(0, least(coalesce(p_exec, 0), 120000)), greatest(0, coalesce(p_cands, 0)))
  on conflict (day, dev) do update set n = app_perf.n + 1, open_sum = app_perf.open_sum + excluded.open_sum,
    open_max = greatest(app_perf.open_max, excluded.open_max), exec_sum = app_perf.exec_sum + excluded.exec_sum, cands = excluded.cands;
  delete from public.app_perf where day < d - 120;
end $$;
