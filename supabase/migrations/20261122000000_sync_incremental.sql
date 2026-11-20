-- Synchronisation économe : l'app ne télécharge que ce qui a changé depuis sa dernière synchronisation.
-- La date de modification est posée par la base (heure du serveur), pas par l'horloge de chaque appareil.
create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();
create index if not exists docs_sync_idx on public.docs (user_id, col, updated_at);
