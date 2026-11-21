-- Carnet des recruteurs : un résumé par expéditeur humain des mails reçus (les adresses automatiques sont écartées).
-- Calculé dans la base pour ne transférer que quelques lignes, pas les mails eux-mêmes.
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
    where received_at > now() - interval '365 days'
      and coalesce(data->>'sender', '') like '%@%'
      and not coalesce(data->'labelIds', '[]'::jsonb) ? 'SENT'
      and lower(data->>'sender') !~ '(no-?reply|ne-?pas-?r[eé]pondre|donotreply|do-not-reply|notification|mailer-daemon|postmaster|alert|newsletter|news@|info@|contact@|hello@|bonjour@|support|bounce|system|automat|ats@|jobs?@|careers?@|emplois?@|candidat|talent|recrut|rh@|hr@|workday|smartrecruiters|teamtailor|lever\.co|greenhouse|taleo|successfactors|icims|jobvite|flatchr|beetween|softy|digitalrecruiters|cornerstone|indeed|linkedin|hellowork|welcometothejungle|apec\.fr|francetravail|pole-emploi|meteojob|glassdoor|monster|jooble|google\.com|facebookmail|calendly|zoom\.us|teams\.microsoft)'
  )
  select mail, max(nom), (array_remove(array_agg(tel order by received_at desc), null))[1], count(*)::int, max(received_at),
         (array_agg(objet order by received_at desc))[1]
  from m group by mail order by max(received_at) desc limit 300;
$$;
revoke all on function public.ce_contacts() from public, anon;
grant execute on function public.ce_contacts() to authenticated, service_role;
