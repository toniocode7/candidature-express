-- Recherche automatique à heure fixe : chaque heure pile, de 6 h à 22 h à Paris (heures en UTC, été comme hiver).
select cron.unschedule(jobname) from cron.job where jobname = 'ce-recherche';
select cron.schedule('ce-recherche', '0 4-21 * * *', $job$
  select net.http_post(
    url := 'https://kwsyyeppmwcpirjujvja.supabase.co/functions/v1/run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ce-cron', (select value #>> '{}' from public.ce_secrets where name = 'cron')),
    body := '{"wf":"recherche"}'::jsonb)
$job$);
