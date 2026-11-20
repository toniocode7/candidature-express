-- Horloge fiable : GitHub saute souvent les tâches programmées des comptes gratuits.
-- Supabase appelle la fonction « run », qui lance les actions GitHub (recherche chaque heure, mails toutes les 15 min).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Code secret des appels programmés : généré ici, dans la base, jamais écrit dans le dépôt.
insert into public.ce_secrets (name, value)
values ('cron', to_jsonb(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
on conflict (name) do nothing;

select cron.unschedule(jobname) from cron.job where jobname in ('ce-recherche', 'ce-mails');

-- Heures en UTC : de 6 h à 22 h à Paris, été comme hiver.
select cron.schedule('ce-recherche', '17 4-21 * * *', $job$
  select net.http_post(
    url := 'https://kwsyyeppmwcpirjujvja.supabase.co/functions/v1/run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ce-cron', (select value #>> '{}' from public.ce_secrets where name = 'cron')),
    body := '{"wf":"recherche"}'::jsonb)
$job$);

select cron.schedule('ce-mails', '*/15 * * * *', $job$
  select net.http_post(
    url := 'https://kwsyyeppmwcpirjujvja.supabase.co/functions/v1/run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ce-cron', (select value #>> '{}' from public.ce_secrets where name = 'cron')),
    body := '{"wf":"mails"}'::jsonb)
$job$);
