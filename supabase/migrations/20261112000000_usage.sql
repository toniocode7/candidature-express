-- Compteur d'utilisation des services gratuits (IA, recherche...), par jour.
create table if not exists public.usage (
  day       date not null default (now() at time zone 'Europe/Paris')::date,
  provider  text not null,
  model     text not null default '',
  ok        int  not null default 0,
  fail      int  not null default 0,
  exhausted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (day, provider, model)
);
alter table public.usage enable row level security;
drop policy if exists "usage: lecture pour l'utilisateur connecté" on public.usage;
create policy "usage: lecture pour l'utilisateur connecté" on public.usage for select to authenticated using (true);
revoke all on public.usage from anon;

create or replace function public.bump_usage(p_provider text, p_model text, p_ok boolean, p_exhausted boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into public.usage (provider, model, ok, fail, exhausted)
  values (p_provider, coalesce(p_model, ''), case when p_ok then 1 else 0 end, case when p_ok then 0 else 1 end, p_exhausted)
  on conflict (day, provider, model) do update set
    ok = usage.ok + excluded.ok,
    fail = usage.fail + excluded.fail,
    exhausted = usage.exhausted or excluded.exhausted,
    updated_at = now();
$$;
revoke all on function public.bump_usage(text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.bump_usage(text, text, boolean, boolean) to service_role;
