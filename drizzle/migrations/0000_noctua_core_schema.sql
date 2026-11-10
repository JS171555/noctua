create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text check (username is null or char_length(username) between 2 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id,
    nullif(left(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 40), ''),
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
exception when check_violation then
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.sounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category text not null check (category in ('Chuva','Natureza','Aconchego','Cidade','Ruídos')),
  description text,
  icon text,
  audio_url text,
  thumbnail_url text,
  is_premium boolean not null default false,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index sounds_category_idx on public.sounds (category, position);
grant select on public.sounds to anon, authenticated;
grant insert, update, delete on public.sounds to authenticated;
grant all on public.sounds to service_role;
alter table public.sounds enable row level security;
create policy "Public reads active sounds" on public.sounds for select to anon, authenticated using (is_active or public.has_role(auth.uid(), 'admin'));
create policy "Admins insert sounds" on public.sounds for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update sounds" on public.sounds for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete sounds" on public.sounds for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

insert into public.sounds (slug, name, category, position, description) values
 ('rain','Chuva','Chuva',1,'Chuva constante sobre a floresta'),
 ('window-rain','Chuva na janela','Chuva',2,'Gotas batendo no vidro'),
 ('roof-rain','Chuva no telhado','Chuva',3,'Chuva sobre telhas'),
 ('thunder','Trovões','Chuva',4,'Trovões graves'),
 ('far-storm','Tempestade distante','Chuva',5,'Tempestade ao longe'),
 ('wind','Vento','Natureza',1,'Vento suave'),
 ('ocean','Oceano','Natureza',2,'Ondas lentas'),
 ('forest','Floresta','Natureza',3,'Floresta viva'),
 ('birds','Pássaros','Natureza',4,'Cantos de pássaros'),
 ('crickets','Grilos','Natureza',5,'Noite de verão'),
 ('stream','Água corrente','Natureza',6,'Riacho'),
 ('leaves','Folhas balançando','Natureza',7,'Folhagem ao vento'),
 ('tree-wind','Vento nas árvores','Natureza',8,'Vento entre galhos'),
 ('fireplace','Lareira','Aconchego',1,'Lenha estalando'),
 ('campfire','Fogueira','Aconchego',2,'Fogueira ao ar livre'),
 ('cafe','Cafeteria','Cidade',1,'Conversas e xícaras'),
 ('train','Trem','Cidade',2,'Trilhos ritmados'),
 ('white','Ruído branco','Ruídos',1,'Ruído branco'),
 ('pink','Ruído rosa','Ruídos',2,'Ruído rosa'),
 ('brown','Ruído marrom','Ruídos',3,'Ruído marrom');

create table public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  description text check (description is null or char_length(description) <= 200),
  master_volume int not null default 80 check (master_volume between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index presets_user_idx on public.presets (user_id, created_at desc);
grant select, insert, update, delete on public.presets to authenticated;
grant all on public.presets to service_role;
alter table public.presets enable row level security;
create policy "Own presets select" on public.presets for select to authenticated using (user_id = auth.uid());
create policy "Own presets insert" on public.presets for insert to authenticated with check (user_id = auth.uid());
create policy "Own presets update" on public.presets for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own presets delete" on public.presets for delete to authenticated using (user_id = auth.uid());
create trigger presets_touch before update on public.presets for each row execute function public.touch_updated_at();

create or replace function public.owns_preset(_preset_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.presets where id = _preset_id and user_id = auth.uid())
$$;

create table public.preset_sounds (
  id uuid primary key default gen_random_uuid(),
  preset_id uuid not null references public.presets(id) on delete cascade,
  sound_id uuid not null references public.sounds(id) on delete restrict,
  volume int not null default 50 check (volume between 0 and 100),
  position int not null default 0,
  unique (preset_id, sound_id)
);
create index preset_sounds_preset_idx on public.preset_sounds (preset_id, position);
grant select, insert, update, delete on public.preset_sounds to authenticated;
grant all on public.preset_sounds to service_role;
alter table public.preset_sounds enable row level security;
create policy "Own preset sounds select" on public.preset_sounds for select to authenticated using (public.owns_preset(preset_id));
create policy "Own preset sounds insert" on public.preset_sounds for insert to authenticated with check (public.owns_preset(preset_id));
create policy "Own preset sounds update" on public.preset_sounds for update to authenticated using (public.owns_preset(preset_id)) with check (public.owns_preset(preset_id));
create policy "Own preset sounds delete" on public.preset_sounds for delete to authenticated using (public.owns_preset(preset_id));

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  sound_id uuid references public.sounds(id) on delete cascade,
  preset_id uuid references public.presets(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((sound_id is null) <> (preset_id is null))
);
create unique index favorites_user_sound_uq on public.favorites (user_id, sound_id) where sound_id is not null;
create unique index favorites_user_preset_uq on public.favorites (user_id, preset_id) where preset_id is not null;
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "Own favorites select" on public.favorites for select to authenticated using (user_id = auth.uid());
create policy "Own favorites insert" on public.favorites for insert to authenticated with check (user_id = auth.uid() and (preset_id is null or public.owns_preset(preset_id)));
create policy "Own favorites delete" on public.favorites for delete to authenticated using (user_id = auth.uid());

create table public.play_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  preset_id uuid not null references public.presets(id) on delete cascade,
  played_at timestamptz not null default now()
);
create index play_history_user_idx on public.play_history (user_id, played_at desc);
grant select, insert on public.play_history to authenticated;
grant all on public.play_history to service_role;
alter table public.play_history enable row level security;
create policy "Own history select" on public.play_history for select to authenticated using (user_id = auth.uid());
create policy "Own history insert" on public.play_history for insert to authenticated with check (user_id = auth.uid() and public.owns_preset(preset_id));
