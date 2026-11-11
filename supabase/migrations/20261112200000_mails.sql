-- Mails de recruteurs transmis par le script Google installé sur ton Gmail (toutes les 15 minutes).
-- Seuls les mails qui parlent de candidature, d'entretien ou de recrutement sont transmis.
create table if not exists public.mails (
  id          text primary key,          -- identifiant Gmail du message
  thread_id   text not null,
  data        jsonb not null,            -- expéditeur, objet, date, texte
  received_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists mails_received on public.mails (received_at desc);
create index if not exists mails_thread on public.mails (thread_id);
alter table public.mails enable row level security;
drop policy if exists "mails: lecture" on public.mails;
create policy "mails: lecture" on public.mails for select to authenticated using (true);
revoke all on public.mails from anon;
revoke insert, update, delete on public.mails from authenticated;

-- Brouillons de réponse demandés par l'app, créés dans Gmail par le script au passage suivant.
create table if not exists public.drafts_out (
  id         uuid primary key default gen_random_uuid(),
  data       jsonb not null,             -- destinataire, objet, texte, message auquel on répond
  created_at timestamptz not null default now(),
  done_at    timestamptz
);
alter table public.drafts_out enable row level security;
drop policy if exists "drafts_out: lecture et ajout" on public.drafts_out;
create policy "drafts_out: lecture et ajout" on public.drafts_out for all to authenticated using (true) with check (true);
revoke all on public.drafts_out from anon;
