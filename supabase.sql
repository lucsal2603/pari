-- Pari — schema per la sincronizzazione fra i due telefoni (Supabase, piano gratuito)
-- Da incollare nell'SQL Editor del progetto Supabase ed eseguire una volta sola.

create table if not exists public.pari_rows (
  house      text not null,                 -- codice casa condiviso (lo scegliete voi nelle Impostazioni)
  id         text not null,                 -- id della riga (spesa, pagamento, membri...)
  kind       text not null,                 -- 'entry' | 'members' | 'activity'
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  primary key (house, id)
);

create index if not exists pari_rows_house_updated on public.pari_rows (house, updated_at);

alter table public.pari_rows enable row level security;

-- La chiave "anon" può leggere e scrivere: la privacy sta nel codice casa, che conoscete solo voi due.
drop policy if exists "pari anon read" on public.pari_rows;
drop policy if exists "pari anon insert" on public.pari_rows;
drop policy if exists "pari anon update" on public.pari_rows;
create policy "pari anon read"   on public.pari_rows for select to anon using (true);
create policy "pari anon insert" on public.pari_rows for insert to anon with check (true);
create policy "pari anon update" on public.pari_rows for update to anon using (true) with check (true);
