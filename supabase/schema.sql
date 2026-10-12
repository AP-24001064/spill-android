create extension if not exists vector with schema extensions;

create table if not exists public.dumps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transcript text not null default '',
  audio_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dump_id uuid references public.dumps(id) on delete cascade,
  kind text not null check (kind in ('task','idea','note','follow_up','person','event')),
  title text not null,
  content text not null,
  due_at timestamptz,
  tags text[] not null default '{}',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists memories_user_created_idx on public.memories(user_id, created_at desc);
create index if not exists memories_embedding_idx on public.memories using hnsw (embedding extensions.vector_cosine_ops);

alter table public.dumps enable row level security;
alter table public.memories enable row level security;
create policy "Users manage own dumps" on public.dumps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own memories" on public.memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('dumps-audio','dumps-audio',false) on conflict (id) do nothing;
create policy "User audio objects are private" on storage.objects for all
using (bucket_id = 'dumps-audio' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'dumps-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.match_memories(
  p_user_id uuid, p_embedding extensions.vector(1536), p_match_count int default 8
) returns table(id uuid, kind text, title text, content text, dump_id uuid, similarity float)
language sql stable security invoker set search_path = public, extensions
as $$
  select m.id, m.kind, m.title, m.content, m.dump_id,
         1 - (m.embedding <=> p_embedding) as similarity
  from public.memories m
  where m.user_id = p_user_id and m.embedding is not null
  order by m.embedding <=> p_embedding
  limit least(greatest(p_match_count,1),20);
$$;
revoke all on function public.match_memories(uuid, extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_memories(uuid, extensions.vector, int) to service_role;
