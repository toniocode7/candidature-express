-- Abonnements aux notifications (un par appareil : iPhone, Mac).
create table if not exists public.push_subs (
  endpoint   text primary key,
  keys       jsonb not null,
  device     text,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push_subs: gestion" on public.push_subs;
create policy "push_subs: gestion" on public.push_subs for all to authenticated using (true) with check (true);
revoke all on public.push_subs from anon;

-- Clés internes (clé de signature des notifications) : lisibles uniquement par le serveur.
create table if not exists public.ce_secrets (
  name  text primary key,
  value jsonb not null
);
alter table public.ce_secrets enable row level security;
revoke all on public.ce_secrets from anon, authenticated;

-- Notifications déjà envoyées (pour ne jamais envoyer deux fois le même rappel).
create table if not exists public.notif_log (
  key     text primary key,
  sent_at timestamptz not null default now()
);
alter table public.notif_log enable row level security;
revoke all on public.notif_log from anon, authenticated;
