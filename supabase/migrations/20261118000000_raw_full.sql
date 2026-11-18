-- Texte complet de chaque annonce récoltée : sert à l'analyse quand le site bloque la lecture (Indeed notamment).
alter table public.raw_offers add column if not exists full_text text;
create index if not exists raw_offers_url_idx on public.raw_offers ((data->>'url'));
