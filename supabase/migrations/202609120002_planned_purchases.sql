-- Isolated single-household LOCAL prototype. No anonymous or browser writes.
create table public.raincheck_planned_purchases (
  id uuid primary key,
  workspace text not null default 'local-demo' check (workspace = 'local-demo'),
  revision integer not null default 1 check (revision > 0),
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (record->>'status' in ('planned','completed','cancelled')),
  check (length(record->>'label') between 1 and 100),
  check (length(record->>'accountId') between 1 and 100),
  check ((record->>'amount')::numeric > 0 and (record->>'amount')::numeric <= 100000),
  check ((record->>'amount')::numeric * 100 = trunc((record->>'amount')::numeric * 100)),
  check (record ?& array['status','label','amount','date','accountId']),
  check (record->>'status' <> 'completed' or record ?& array['transactionId','actualAmount','actualDate'])
);
create unique index raincheck_purchase_match_once on public.raincheck_planned_purchases
  (workspace, (record->>'accountId'), (record->>'transactionId')) where record->>'status' = 'completed';
alter table public.raincheck_planned_purchases enable row level security;
revoke all on public.raincheck_planned_purchases from public, anon, authenticated, service_role;
grant select on public.raincheck_planned_purchases to service_role;

create function public.raincheck_save_purchase(p_id uuid, p_expected integer, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.raincheck_planned_purchases; old_record jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('raincheck-local-purchases'));
  if p_expected = 0 then
    if p_record->>'status' <> 'planned' or (select count(*) from public.raincheck_planned_purchases) >= 2000 then
      raise exception 'Purchase cannot be added';
    end if;
    insert into public.raincheck_planned_purchases(id,record) values(p_id,p_record) returning * into saved;
  else
    select record into old_record from public.raincheck_planned_purchases where id=p_id and revision=p_expected for update;
    if old_record is null or old_record->>'status' <> 'planned' or old_record->>'accountId' <> p_record->>'accountId' then
      raise exception 'Purchase changed; refresh before editing';
    end if;
    update public.raincheck_planned_purchases set record=p_record, revision=revision+1, updated_at=now()
      where id=p_id and revision=p_expected returning * into saved;
  end if;
  return saved.record || jsonb_build_object('id',saved.id,'revision',saved.revision,'createdAt',saved.created_at,'updatedAt',saved.updated_at);
end; $$;
revoke all on function public.raincheck_save_purchase(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.raincheck_save_purchase(uuid,integer,jsonb) to service_role;
