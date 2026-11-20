-- Espace de la base (gratuit : 500 Mo) : mesure pour l'alerte de panne, et ménage des textes d'annonces inutiles.
create or replace function public.ce_db_size() returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total', pg_database_size(current_database()),
    'raw_offers', pg_total_relation_size('public.raw_offers'),
    'docs', pg_total_relation_size('public.docs'),
    'mails', pg_total_relation_size('public.mails'),
    'textes', (select count(*) from public.raw_offers where full_text is not null),
    'offres', (select count(*) from public.raw_offers));
$$;
revoke all on function public.ce_db_size() from public, anon, authenticated;
grant execute on function public.ce_db_size() to service_role;

-- Texte complet effacé pour les offres écartées par le tri depuis plus de 3 jours (jamais analysées) ;
-- gardé pour les offres affichées dans Suggérées. L'empreinte et le résumé restent : doublons et re-tri inchangés.
create or replace function public.ce_trim_texts(keep_urls text[]) returns int language sql security definer set search_path = public as $$
  with u as (
    update public.raw_offers set full_text = null
    where full_text is not null and evaluated_at is not null and evaluated_at < now() - interval '3 days'
      and not (data->>'url' = any(keep_urls))
    returning 1)
  select count(*)::int from u;
$$;
revoke all on function public.ce_trim_texts(text[]) from public, anon, authenticated;
grant execute on function public.ce_trim_texts(text[]) to service_role;
