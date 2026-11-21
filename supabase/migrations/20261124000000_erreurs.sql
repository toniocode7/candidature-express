-- Journal des erreurs de l'app : un plantage sur ton iPhone (ou dans le tri automatique) est noté ici,
-- une ligne par erreur et par jour avec un compteur. Lu par la surveillance (alerte) et par l'app (Réglages).
create table if not exists public.app_errors (
  id    bigserial primary key,
  day   date not null default (now() at time zone 'Europe/Paris')::date,
  first timestamptz not null default now(),
  last  timestamptz not null default now(),
  msg   text not null,
  src   text not null default '',
  ver   text not null default '',
  ctx   text not null default '',
  n     int not null default 1,
  unique (day, msg, src)
);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon;
drop policy if exists "app_errors: lecture" on public.app_errors;
create policy "app_errors: lecture" on public.app_errors for select to authenticated using (true);
drop policy if exists "app_errors: effacer" on public.app_errors;
create policy "app_errors: effacer" on public.app_errors for delete to authenticated using (true);
grant select, delete on public.app_errors to authenticated;

-- Écriture par une seule fonction : textes coupés, compteur au lieu de doublons, au plus 200 erreurs par jour,
-- journal gardé 30 jours.
create or replace function public.ce_log_error(p_msg text, p_src text, p_ver text, p_ctx text, p_n int default 1)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date;
begin
  if coalesce(p_msg, '') = '' then return; end if;
  if (select count(*) from public.app_errors where day = d) >= 200 then return; end if;
  insert into public.app_errors (day, msg, src, ver, ctx, n)
  values (d, left(p_msg, 300), left(coalesce(p_src, ''), 120), left(coalesce(p_ver, ''), 20), left(coalesce(p_ctx, ''), 1500), greatest(1, least(coalesce(p_n, 1), 1000)))
  on conflict (day, msg, src) do update set n = app_errors.n + excluded.n, last = now(), ver = excluded.ver, ctx = excluded.ctx;
  delete from public.app_errors where day < d - 30;
end $$;
revoke all on function public.ce_log_error(text, text, text, text, int) from public, anon;
grant execute on function public.ce_log_error(text, text, text, text, int) to authenticated, service_role;
