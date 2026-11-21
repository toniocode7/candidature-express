-- Protection renforcée : tout est réservé à TON compte, et aucun autre compte ne peut être créé.
-- L'identifiant de ton compte est rangé dans ce_secrets (jamais dans ce dépôt public).

-- 1. Le propriétaire : le premier (et seul) compte existant.
insert into public.ce_secrets (name, value)
select 'owner', to_jsonb(id::text) from auth.users order by created_at limit 1
on conflict (name) do nothing;

-- Vrai si la demande vient de ton compte, ou des tâches automatiques du serveur (clé serveur).
create or replace function public.ce_is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (auth.uid() is not null and auth.uid()::text = (select value #>> '{}' from public.ce_secrets where name = 'owner'));
$$;
revoke all on function public.ce_is_owner() from public, anon;
grant execute on function public.ce_is_owner() to authenticated, service_role;

-- 2. Inscriptions fermées : plus aucun nouveau compte ne peut être créé (le tien n'est pas touché).
create or replace function public.ce_no_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Inscriptions fermées : cette app est privée.';
  end if;
  return new;
end $$;
revoke all on function public.ce_no_signup() from public, anon, authenticated;
drop trigger if exists ce_no_signup on auth.users;
create trigger ce_no_signup before insert on auth.users for each row execute function public.ce_no_signup();

-- 3. Chaque table : ton compte seulement (en plus d'être connecté).
drop policy if exists "app_errors: lecture" on public.app_errors;
create policy "app_errors: lecture" on public.app_errors for select to authenticated using ((select public.ce_is_owner()));
drop policy if exists "app_errors: effacer" on public.app_errors;
create policy "app_errors: effacer" on public.app_errors for delete to authenticated using ((select public.ce_is_owner()));
drop policy if exists "app_perf: lecture" on public.app_perf;
create policy "app_perf: lecture" on public.app_perf for select to authenticated using ((select public.ce_is_owner()));
drop policy if exists "docs: propriétaire seulement" on public.docs;
create policy "docs: propriétaire seulement" on public.docs for all to authenticated
  using (user_id = (select auth.uid()) and (select public.ce_is_owner()))
  with check (user_id = (select auth.uid()) and (select public.ce_is_owner()));
drop policy if exists "drafts_out: lecture et ajout" on public.drafts_out;
create policy "drafts_out: lecture et ajout" on public.drafts_out for all to authenticated
  using ((select public.ce_is_owner())) with check ((select public.ce_is_owner()));
drop policy if exists "mails: lecture" on public.mails;
create policy "mails: lecture" on public.mails for select to authenticated using ((select public.ce_is_owner()));
drop policy if exists "push_subs: gestion" on public.push_subs;
create policy "push_subs: gestion" on public.push_subs for all to authenticated
  using ((select public.ce_is_owner())) with check ((select public.ce_is_owner()));
drop policy if exists "raw_offers: lecture" on public.raw_offers;
create policy "raw_offers: lecture" on public.raw_offers for select to authenticated using ((select public.ce_is_owner()));
drop policy if exists "raw_offers: marquer comme triée" on public.raw_offers;
create policy "raw_offers: marquer comme triée" on public.raw_offers for update to authenticated
  using ((select public.ce_is_owner())) with check ((select public.ce_is_owner()));
drop policy if exists "usage: lecture pour l'utilisateur connecté" on public.usage;
create policy "usage: lecture pour l'utilisateur connecté" on public.usage for select to authenticated using ((select public.ce_is_owner()));

-- 4. Fonctions appelées par l'app : ton compte seulement.
create or replace function public.ce_log_error(p_msg text, p_src text, p_ver text, p_ctx text, p_n int default 1)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.ce_is_owner() then return; end if;
  if coalesce(p_msg, '') = '' then return; end if;
  if (select count(*) from public.app_errors where day = d) >= 200 then return; end if;
  insert into public.app_errors (day, msg, src, ver, ctx, n)
  values (d, left(p_msg, 300), left(coalesce(p_src, ''), 120), left(coalesce(p_ver, ''), 20), left(coalesce(p_ctx, ''), 1500), greatest(1, least(coalesce(p_n, 1), 1000)))
  on conflict (day, msg, src) do update set n = app_errors.n + excluded.n, last = now(), ver = excluded.ver, ctx = excluded.ctx;
  delete from public.app_errors where day < d - 30;
end $$;

create or replace function public.ce_log_perf(p_open int, p_exec int, p_cands int, p_dev text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/Paris')::date; o int := greatest(0, least(coalesce(p_open, 0), 120000));
begin
  if not public.ce_is_owner() then return; end if;
  if o = 0 then return; end if;
  insert into public.app_perf (day, dev, n, open_sum, open_max, exec_sum, cands)
  values (d, left(coalesce(nullif(p_dev, ''), 'autre'), 20), 1, o, o, greatest(0, least(coalesce(p_exec, 0), 120000)), greatest(0, coalesce(p_cands, 0)))
  on conflict (day, dev) do update set n = app_perf.n + 1, open_sum = app_perf.open_sum + excluded.open_sum,
    open_max = greatest(app_perf.open_max, excluded.open_max), exec_sum = app_perf.exec_sum + excluded.exec_sum, cands = excluded.cands;
  delete from public.app_perf where day < d - 120;
end $$;

create or replace function public.ce_contacts()
returns table (mail text, nom text, tel text, n int, last timestamptz, objet text)
language sql stable security definer set search_path = public as $$
  with m as (
    select lower(data->>'sender') as mail,
           coalesce((select x->>'displayName' from jsonb_array_elements(coalesce(data->'addressDisplayNames', '[]'::jsonb)) x
                     where lower(x->>'emailAddress') = lower(data->>'sender') limit 1), '') as nom,
           (regexp_match(right(coalesce(data->>'plaintextBody', ''), 2500), '((?:\+\d{2,3}[ .]?\(?0?\)?[ .]?|\m0)[1-9](?:[ .-]?\d{2}){4})'))[1] as tel,
           received_at, data->>'subject' as objet
    from public.mails
    where public.ce_is_owner() and received_at > now() - interval '365 days'
      and coalesce(data->>'sender', '') like '%@%'
      and not coalesce(data->'labelIds', '[]'::jsonb) ? 'SENT'
      and lower(data->>'sender') !~ '(no-?reply|ne-?pas-?r[eé]pondre|donotreply|do-not-reply|notification|mailer-daemon|postmaster|alert|newsletter|news@|info@|contact@|hello@|bonjour@|support|bounce|system|automat|ats@|jobs?@|careers?@|emplois?@|candidat|talent|recrut|rh@|hr@|workday|smartrecruiters|teamtailor|lever\.co|greenhouse|taleo|successfactors|icims|jobvite|flatchr|beetween|softy|digitalrecruiters|cornerstone|indeed|linkedin|hellowork|welcometothejungle|apec\.fr|francetravail|pole-emploi|meteojob|glassdoor|monster|jooble|google\.com|facebookmail|calendly|zoom\.us|teams\.microsoft)'
  )
  select mail, max(nom), (array_remove(array_agg(tel order by received_at desc), null))[1], count(*)::int, max(received_at),
         (array_agg(objet order by received_at desc))[1]
  from m group by mail order by max(received_at) desc limit 300;
$$;

-- 5. Avertissement Supabase : chemin de recherche fixé pour la fonction de date de mise à jour.
alter function public.docs_touch() set search_path = public;
