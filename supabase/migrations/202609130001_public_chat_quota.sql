-- Shared counters survive cold starts. No messages, raw IPs or account data are stored.
create table raincheck_private.chat_quota (
  bucket text not null,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  used integer not null check (used > 0),
  primary key (bucket, window_start)
);
alter table raincheck_private.chat_quota enable row level security;
revoke all on raincheck_private.chat_quota from public, anon, authenticated, service_role;
create index chat_quota_expiry on raincheck_private.chat_quota(expires_at);

create function public.raincheck_chat_quota(p_subject text, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clock timestamptz := statement_timestamp();
  starts timestamptz[]; ends timestamptz[]; buckets text[]; limits integer[];
  i integer; count_used integer; retry integer := 0;
begin
  if p_subject is null or p_subject !~ '^[a-f0-9]{64}$' or p_kind is null or p_kind not in ('session','context') then
    raise exception 'Invalid quota request';
  end if;
  -- All three checks and increments are atomic across every deployment instance.
  perform pg_advisory_xact_lock(hashtext('raincheck-chat-' || p_kind));
  starts := array[date_trunc('day',clock,'UTC'),date_trunc('minute',clock),date_trunc('hour',clock)];
  ends := array[starts[1]+interval '1 day',starts[2]+interval '1 minute',starts[3]+interval '1 hour'];
  buckets := array[p_kind||':global',p_kind||':minute:'||p_subject,p_kind||':hour:'||p_subject];
  limits := case when p_kind='session' then array[100,3,20] else array[3000,30,200] end;
  for i in 1..3 loop
    select used into count_used from raincheck_private.chat_quota where bucket=buckets[i] and window_start=starts[i];
    if coalesce(count_used,0) >= limits[i] then
      retry := greatest(retry,ceil(extract(epoch from ends[i]-clock))::integer);
    end if;
  end loop;
  if retry>0 then return jsonb_build_object('allowed',false,'retryAfter',retry); end if;
  delete from raincheck_private.chat_quota where expires_at < clock - interval '1 day';
  for i in 1..3 loop
    insert into raincheck_private.chat_quota(bucket,window_start,expires_at,used)
      values(buckets[i],starts[i],ends[i],1)
      on conflict(bucket,window_start) do update set used=raincheck_private.chat_quota.used+1;
  end loop;
  return jsonb_build_object('allowed',true,'retryAfter',0);
end; $$;
revoke all on function public.raincheck_chat_quota(text,text) from public,anon,authenticated;
grant execute on function public.raincheck_chat_quota(text,text) to service_role;
notify pgrst, 'reload schema';
