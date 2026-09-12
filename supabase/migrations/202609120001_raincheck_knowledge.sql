-- Private, versioned Nessie mirror. The application has read-only service access.
-- Published snapshots are immutable; a failed sync cannot replace the current snapshot.
create table public.raincheck_datasets (
  dataset_id text primary key check (dataset_id in ('demo','backend')),
  customer_id text not null unique,
  current_snapshot_id uuid
);
create table public.raincheck_snapshots (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null references public.raincheck_datasets(dataset_id),
  fingerprint text not null check (length(fingerprint)=64),
  as_of date not null,
  captured_at timestamptz not null,
  synced_at timestamptz not null default now(),
  source text not null,
  household jsonb not null,
  source_snapshot jsonb not null,
  unique (dataset_id, fingerprint), unique (dataset_id, id)
);
alter table public.raincheck_datasets add constraint raincheck_current_snapshot
  foreign key (dataset_id, current_snapshot_id) references public.raincheck_snapshots(dataset_id,id);
create table public.raincheck_accounts (
  snapshot_id uuid not null references public.raincheck_snapshots(id),
  id text not null, name text not null, kind text not null, balance_cents bigint not null,
  primary key (snapshot_id,id)
);
create table public.raincheck_merchants (
  snapshot_id uuid not null references public.raincheck_snapshots(id),
  id text not null, name text not null, category text not null,
  primary key (snapshot_id,id)
);
create table public.raincheck_bills (
  snapshot_id uuid not null, id text not null, account_id text not null,
  name text not null, payee text not null, amount_cents bigint not null check(amount_cents>=0), details jsonb not null,
  primary key (snapshot_id,id), unique(snapshot_id,account_id,id),
  foreign key(snapshot_id,account_id) references public.raincheck_accounts(snapshot_id,id)
);
create table public.raincheck_transactions (
  snapshot_id uuid not null, id text not null, account_id text not null,
  source_id text not null, source_type text not null check(source_type in ('deposit','purchase','withdrawal')),
  merchant_id text, bill_id text, booked_on date not null, amount_cents bigint not null,
  description text not null, category text not null,
  kind text not null check(kind in ('income','transfer','refund','credit','withdrawal','bill','purchase')),
  details jsonb not null,
  primary key(snapshot_id,id),
  foreign key(snapshot_id,account_id) references public.raincheck_accounts(snapshot_id,id),
  foreign key(snapshot_id,merchant_id) references public.raincheck_merchants(snapshot_id,id),
  foreign key(snapshot_id,account_id,bill_id) references public.raincheck_bills(snapshot_id,account_id,id)
);
create index raincheck_transaction_dates on public.raincheck_transactions(snapshot_id,booked_on,account_id);
create table public.raincheck_documents (
  snapshot_id uuid not null references public.raincheck_snapshots(id), id text not null,
  source_type text not null, source_id text not null, account_id text, record_date date,
  title text not null, body text not null,
  search_terms tsvector generated always as
    (setweight(to_tsvector('english',title),'A') || setweight(to_tsvector('english',body),'B')) stored,
  primary key(snapshot_id,id),
  foreign key(snapshot_id,account_id) references public.raincheck_accounts(snapshot_id,id)
);
create index raincheck_document_search on public.raincheck_documents using gin(search_terms);

-- No anonymous/browser policies. Authenticated users do not get cross-household access.
do $$
declare t text;
begin
  foreach t in array array['datasets','snapshots','accounts','merchants','bills','transactions','documents'] loop
    execute format('alter table public.%I enable row level security', 'raincheck_'||t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', 'raincheck_'||t);
    execute format('grant select on public.%I to service_role', 'raincheck_'||t);
  end loop;
end $$;

create function public.raincheck_search(p_dataset text, p_query text, p_limit integer default 8)
returns table(snapshot_id uuid, document_id text, source_type text, source_id text,
  account_id text, record_date date, title text, body text, as_of date, synced_at timestamptz)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_dataset is null or p_dataset not in ('demo','backend') or p_query is null
    or length(trim(p_query)) not between 1 and 500 or p_limit is null or p_limit not between 1 and 20 then
    raise exception 'Invalid retrieval parameters' using errcode='22023';
  end if;
  return query select doc.snapshot_id,doc.id,doc.source_type,doc.source_id,doc.account_id,
    doc.record_date,doc.title,doc.body,s.as_of,s.synced_at
    from public.raincheck_datasets d join public.raincheck_snapshots s on s.id=d.current_snapshot_id
    join public.raincheck_documents doc on doc.snapshot_id=s.id
    where d.dataset_id=p_dataset and doc.search_terms @@ websearch_to_tsquery('english',p_query)
    order by ts_rank(doc.search_terms,websearch_to_tsquery('english',p_query)) desc, doc.id
    limit p_limit;
end $$;

create function public.raincheck_activity_totals(p_dataset text,p_from date,p_to date,p_account_id text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare sid uuid; cutoff date; result jsonb;
begin
  if p_dataset is null or p_dataset not in ('demo','backend') or p_from is null or p_to is null or p_from>p_to then
    raise exception 'Invalid activity parameters' using errcode='22023';
  end if;
  select s.id,s.as_of into sid,cutoff from public.raincheck_datasets d
    join public.raincheck_snapshots s on s.id=d.current_snapshot_id where d.dataset_id=p_dataset;
  if sid is null then raise exception 'Dataset has not been synced' using errcode='22023'; end if;
  if p_account_id is not null and not exists(select 1 from public.raincheck_accounts a where a.snapshot_id=sid and a.id=p_account_id) then
    raise exception 'Account is outside this dataset' using errcode='22023';
  end if;
  select jsonb_build_object('snapshot_id',sid,'as_of',cutoff,'from',p_from,'to',p_to,
    'currency','USD','account_id',p_account_id,'transaction_count',count(*),
    'income_cents',coalesce(sum(amount_cents) filter(where kind='income'),0),
    'spending_cents',-coalesce(sum(amount_cents) filter(where kind in ('bill','purchase','withdrawal')),0),
    'refund_cents',coalesce(sum(amount_cents) filter(where kind='refund'),0),
    'other_credit_cents',coalesce(sum(amount_cents) filter(where kind='credit'),0),
    'transfer_net_cents',coalesce(sum(amount_cents) filter(where kind='transfer'),0),
    'net_cents',coalesce(sum(amount_cents),0),
    'first_record',min(booked_on),'last_record',max(booked_on)) into result
    from public.raincheck_transactions where snapshot_id=sid and booked_on between p_from and p_to
      and (p_account_id is null or account_id=p_account_id);
  return result;
end $$;
revoke all on function public.raincheck_search(text,text,integer) from public,anon,authenticated;
revoke all on function public.raincheck_activity_totals(text,date,date,text) from public,anon,authenticated;
grant execute on function public.raincheck_search(text,text,integer) to service_role;
grant execute on function public.raincheck_activity_totals(text,date,date,text) to service_role;
