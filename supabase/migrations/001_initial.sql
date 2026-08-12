-- BidFrenzy MVP schema
-- Run in Supabase SQL editor or via CLI

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (hosts)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auctions
-- ---------------------------------------------------------------------------
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  name text not null,
  description text,
  currency text not null default 'INR',
  default_starting_bid numeric(12, 2) not null default 1000,
  default_bid_increment numeric(12, 2) not null default 500,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'live', 'completed')),
  phase text not null default 'lobby'
    check (phase in ('lobby', 'item_open', 'bidding', 'item_closed', 'item_result')),
  current_item_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists auctions_host_id_idx on public.auctions (host_id);
create index if not exists auctions_code_idx on public.auctions (code);

-- ---------------------------------------------------------------------------
-- Auction items
-- ---------------------------------------------------------------------------
create table if not exists public.auction_items (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  starting_price numeric(12, 2) not null,
  minimum_increment numeric(12, 2) not null,
  current_bid numeric(12, 2),
  current_bidder_id uuid,
  bid_count integer not null default 0,
  position integer not null default 0,
  item_number integer,
  status text not null default 'pending'
    check (status in ('pending', 'open', 'closed', 'sold', 'unsold')),
  created_at timestamptz not null default now()
);

create index if not exists auction_items_auction_id_idx on public.auction_items (auction_id);

alter table public.auctions
  drop constraint if exists auctions_current_item_id_fkey;

alter table public.auctions
  add constraint auctions_current_item_id_fkey
  foreign key (current_item_id) references public.auction_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Participants (guest sessions)
-- ---------------------------------------------------------------------------
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  display_name text not null,
  session_id text not null,
  joined_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (auction_id, session_id)
);

create index if not exists participants_auction_id_idx on public.participants (auction_id);
create index if not exists participants_session_id_idx on public.participants (session_id);

alter table public.auction_items
  drop constraint if exists auction_items_current_bidder_id_fkey;

alter table public.auction_items
  add constraint auction_items_current_bidder_id_fkey
  foreign key (current_bidder_id) references public.participants (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Bids (immutable audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.auction_items (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  client_request_id text,
  unique (item_id, client_request_id)
);

create index if not exists bids_item_id_idx on public.bids (item_id);
create index if not exists bids_participant_id_idx on public.bids (participant_id);

-- ---------------------------------------------------------------------------
-- Auction results
-- ---------------------------------------------------------------------------
create table if not exists public.auction_results (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.auction_items (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete set null,
  winning_bid numeric(12, 2),
  outcome text not null check (outcome in ('sold', 'unsold')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.set_updated_profile();

create or replace function public.generate_auction_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.is_auction_host(p_auction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.auctions a
    where a.id = p_auction_id and a.host_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_auction(
  p_name text,
  p_description text default null,
  p_currency text default 'INR',
  p_default_starting_bid numeric default 1000,
  p_default_bid_increment numeric default 500
)
returns public.auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_code text;
  v_attempts integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  loop
    v_code := public.generate_auction_code();
    begin
      insert into public.auctions (
        host_id, code, name, description, currency,
        default_starting_bid, default_bid_increment, status, phase
      ) values (
        auth.uid(), v_code, p_name, p_description, p_currency,
        p_default_starting_bid, p_default_bid_increment, 'draft', 'lobby'
      )
      returning * into v_auction;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 10 then
        raise exception 'Could not generate unique code';
      end if;
    end;
  end loop;

  return v_auction;
end;
$$;

create or replace function public.join_auction(
  p_code text,
  p_display_name text,
  p_session_id text
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_participant public.participants;
begin
  if length(trim(p_display_name)) < 1 then
    raise exception 'Display name required';
  end if;
  if length(trim(p_session_id)) < 8 then
    raise exception 'Invalid session';
  end if;

  select * into v_auction
  from public.auctions
  where upper(code) = upper(trim(p_code));

  if not found then
    raise exception 'Auction not found';
  end if;

  if v_auction.status not in ('ready', 'live') then
    raise exception 'Auction is not open for joining';
  end if;

  insert into public.participants (auction_id, display_name, session_id)
  values (v_auction.id, trim(p_display_name), p_session_id)
  on conflict (auction_id, session_id) do update
    set display_name = excluded.display_name,
        expires_at = now() + interval '24 hours'
  returning * into v_participant;

  return v_participant;
end;
$$;

create or replace function public.place_bid(
  p_item_id uuid,
  p_session_id text,
  p_amount numeric,
  p_client_request_id text default null
)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.auction_items;
  v_auction public.auctions;
  v_participant public.participants;
  v_bid public.bids;
  v_min_amount numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid bid amount';
  end if;

  select * into v_item from public.auction_items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;

  select * into v_auction from public.auctions where id = v_item.auction_id for update;
  if v_auction.status <> 'live' then
    raise exception 'Auction is not live';
  end if;
  if v_auction.phase not in ('item_open', 'bidding') then
    raise exception 'Bidding is closed for this item';
  end if;
  if v_auction.current_item_id is distinct from v_item.id then
    raise exception 'Item is not the current open item';
  end if;
  if v_item.status <> 'open' then
    raise exception 'Item is not open for bidding';
  end if;

  select * into v_participant
  from public.participants
  where auction_id = v_auction.id
    and session_id = p_session_id
    and expires_at > now();

  if not found then
    raise exception 'Participant session invalid or expired';
  end if;

  -- Idempotent replay
  if p_client_request_id is not null then
    select * into v_bid
    from public.bids
    where item_id = p_item_id and client_request_id = p_client_request_id;
    if found then
      return v_bid;
    end if;
  end if;

  v_min_amount := coalesce(v_item.current_bid, v_item.starting_price - v_item.minimum_increment)
                  + v_item.minimum_increment;

  -- First bid may equal starting price
  if v_item.current_bid is null then
    v_min_amount := v_item.starting_price;
  end if;

  if p_amount < v_min_amount then
    raise exception 'Bid must be at least %', v_min_amount;
  end if;

  -- Prevent bidding against yourself as "new" high without increment? Allow re-raise.
  insert into public.bids (item_id, participant_id, amount, client_request_id)
  values (p_item_id, v_participant.id, p_amount, p_client_request_id)
  returning * into v_bid;

  update public.auction_items
  set current_bid = p_amount,
      current_bidder_id = v_participant.id,
      bid_count = bid_count + 1
  where id = p_item_id;

  update public.auctions
  set phase = 'bidding'
  where id = v_auction.id and phase = 'item_open';

  return v_bid;
end;
$$;

create or replace function public.host_set_auction_status(
  p_auction_id uuid,
  p_status text,
  p_phase text default null
)
returns public.auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
begin
  if not public.is_auction_host(p_auction_id) then
    raise exception 'Not authorized';
  end if;

  update public.auctions
  set status = p_status,
      phase = coalesce(p_phase, phase),
      started_at = case when p_status = 'live' and started_at is null then now() else started_at end,
      ended_at = case when p_status = 'completed' then now() else ended_at end
  where id = p_auction_id
  returning * into v_auction;

  return v_auction;
end;
$$;

create or replace function public.host_open_item(
  p_auction_id uuid,
  p_item_id uuid
)
returns public.auction_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.auction_items;
begin
  if not public.is_auction_host(p_auction_id) then
    raise exception 'Not authorized';
  end if;

  update public.auction_items
  set status = 'pending'
  where auction_id = p_auction_id and status = 'open';

  update public.auction_items
  set status = 'open',
      current_bid = null,
      current_bidder_id = null,
      bid_count = 0
  where id = p_item_id and auction_id = p_auction_id and status = 'pending'
  returning * into v_item;

  if not found then
    raise exception 'Item cannot be opened';
  end if;

  update public.auctions
  set status = 'live',
      phase = 'item_open',
      current_item_id = p_item_id,
      started_at = coalesce(started_at, now())
  where id = p_auction_id;

  return v_item;
end;
$$;

create or replace function public.host_close_item(
  p_auction_id uuid
)
returns public.auction_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_item public.auction_items;
begin
  if not public.is_auction_host(p_auction_id) then
    raise exception 'Not authorized';
  end if;

  select * into v_auction from public.auctions where id = p_auction_id for update;

  if v_auction.current_item_id is null then
    raise exception 'No current item';
  end if;

  update public.auction_items
  set status = 'closed'
  where id = v_auction.current_item_id
  returning * into v_item;

  update public.auctions
  set phase = 'item_closed'
  where id = p_auction_id;

  return v_item;
end;
$$;

create or replace function public.host_resolve_item(
  p_auction_id uuid,
  p_outcome text
)
returns public.auction_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_item public.auction_items;
  v_result public.auction_results;
begin
  if not public.is_auction_host(p_auction_id) then
    raise exception 'Not authorized';
  end if;
  if p_outcome not in ('sold', 'unsold') then
    raise exception 'Invalid outcome';
  end if;

  select * into v_auction from public.auctions where id = p_auction_id for update;
  if v_auction.current_item_id is null then
    raise exception 'No current item';
  end if;

  select * into v_item from public.auction_items where id = v_auction.current_item_id for update;

  if p_outcome = 'sold' and (v_item.current_bidder_id is null or v_item.current_bid is null) then
    raise exception 'Cannot mark sold without a winning bid';
  end if;

  update public.auction_items
  set status = p_outcome
  where id = v_item.id;

  insert into public.auction_results (item_id, participant_id, winning_bid, outcome)
  values (
    v_item.id,
    case when p_outcome = 'sold' then v_item.current_bidder_id else null end,
    case when p_outcome = 'sold' then v_item.current_bid else null end,
    p_outcome
  )
  on conflict (item_id) do update
    set participant_id = excluded.participant_id,
        winning_bid = excluded.winning_bid,
        outcome = excluded.outcome
  returning * into v_result;

  update public.auctions
  set phase = 'item_result'
  where id = p_auction_id;

  return v_result;
end;
$$;

create or replace function public.host_next_item(
  p_auction_id uuid
)
returns public.auctions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auction public.auctions;
  v_next uuid;
begin
  if not public.is_auction_host(p_auction_id) then
    raise exception 'Not authorized';
  end if;

  select id into v_next
  from public.auction_items
  where auction_id = p_auction_id and status = 'pending'
  order by position asc, created_at asc
  limit 1;

  if v_next is null then
    update public.auctions
    set status = 'completed',
        phase = 'lobby',
        current_item_id = null,
        ended_at = now()
    where id = p_auction_id
    returning * into v_auction;
  else
    update public.auctions
    set phase = 'lobby',
        current_item_id = null
    where id = p_auction_id
    returning * into v_auction;
  end if;

  return v_auction;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.auctions enable row level security;
alter table public.auction_items enable row level security;
alter table public.participants enable row level security;
alter table public.bids enable row level security;
alter table public.auction_results enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles updatable by owner" on public.profiles;
create policy "Profiles updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Hosts manage own auctions" on public.auctions;
create policy "Hosts manage own auctions"
  on public.auctions for all
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

drop policy if exists "Public can read joinable auctions" on public.auctions;
create policy "Public can read joinable auctions"
  on public.auctions for select
  using (status in ('ready', 'live', 'completed'));

drop policy if exists "Hosts manage items" on public.auction_items;
create policy "Hosts manage items"
  on public.auction_items for all
  using (public.is_auction_host(auction_id))
  with check (public.is_auction_host(auction_id));

drop policy if exists "Public can read items of joinable auctions" on public.auction_items;
create policy "Public can read items of joinable auctions"
  on public.auction_items for select
  using (
    exists (
      select 1 from public.auctions a
      where a.id = auction_id and a.status in ('ready', 'live', 'completed')
    )
  );

drop policy if exists "Public can read participants" on public.participants;
create policy "Public can read participants"
  on public.participants for select
  using (
    exists (
      select 1 from public.auctions a
      where a.id = auction_id and a.status in ('ready', 'live', 'completed')
    )
  );

drop policy if exists "Hosts can read participants" on public.participants;
create policy "Hosts can read participants"
  on public.participants for select
  using (public.is_auction_host(auction_id));

drop policy if exists "Public can read bids" on public.bids;
create policy "Public can read bids"
  on public.bids for select
  using (
    exists (
      select 1
      from public.auction_items i
      join public.auctions a on a.id = i.auction_id
      where i.id = item_id and a.status in ('ready', 'live', 'completed')
    )
  );

drop policy if exists "Public can read results" on public.auction_results;
create policy "Public can read results"
  on public.auction_results for select
  using (
    exists (
      select 1
      from public.auction_items i
      join public.auctions a on a.id = i.auction_id
      where i.id = item_id and a.status in ('ready', 'live', 'completed')
    )
  );

-- Storage bucket for item images
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read item images" on storage.objects;
create policy "Public read item images"
  on storage.objects for select
  using (bucket_id = 'item-images');

drop policy if exists "Hosts upload item images" on storage.objects;
create policy "Hosts upload item images"
  on storage.objects for insert
  with check (
    bucket_id = 'item-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Hosts update own item images" on storage.objects;
create policy "Hosts update own item images"
  on storage.objects for update
  using (bucket_id = 'item-images' and auth.role() = 'authenticated');

drop policy if exists "Hosts delete own item images" on storage.objects;
create policy "Hosts delete own item images"
  on storage.objects for delete
  using (bucket_id = 'item-images' and auth.role() = 'authenticated');

-- Realtime
alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.auction_items;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.auction_results;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on public.auctions to authenticated;
grant insert, update, delete on public.auction_items to authenticated;
grant insert, update on public.profiles to authenticated;
grant execute on function public.create_auction to authenticated;
grant execute on function public.join_auction to anon, authenticated;
grant execute on function public.place_bid to anon, authenticated;
grant execute on function public.host_set_auction_status to authenticated;
grant execute on function public.host_open_item to authenticated;
grant execute on function public.host_close_item to authenticated;
grant execute on function public.host_resolve_item to authenticated;
grant execute on function public.host_next_item to authenticated;
