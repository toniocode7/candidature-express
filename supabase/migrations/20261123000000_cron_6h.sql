-- Recherche : l'horloge appelle chaque heure ; la fonction « run » ne lance qu'à 0 h, 6 h, 12 h et 18 h (heure de Paris,
-- été comme hiver) et pas si une recherche manuelle a eu lieu moins d'une heure avant.
-- Rappels (entretiens, objectif, bilan, alertes) : chaque heure, tâche légère à part.
select cron.unschedule(jobname) from cron.job where jobname in ('ce-recherche', 'ce-rappels');
select cron.schedule('ce-recherche', '0 * * * *', $job$
  select net.http_post(
    url := 'https://kwsyyeppmwcpirjujvja.supabase.co/functions/v1/run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ce-cron', (select value #>> '{}' from public.ce_secrets where name = 'cron')),
    body := '{"wf":"recherche"}'::jsonb)
$job$);
select cron.schedule('ce-rappels', '5 * * * *', $job$
  select net.http_post(
    url := 'https://kwsyyeppmwcpirjujvja.supabase.co/functions/v1/run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ce-cron', (select value #>> '{}' from public.ce_secrets where name = 'cron')),
    body := '{"wf":"rappels"}'::jsonb)
$job$);
