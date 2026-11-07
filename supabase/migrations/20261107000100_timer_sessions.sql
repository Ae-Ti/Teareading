-- ─────────────────────────────────────────────
-- 다도·독서 타이머 (소유: 태일, 명세 2.1)
-- 시작·종료는 아래 RPC로만 한다. 시각은 서버 기준이라 클라이언트가 조작할 수 없다.
-- ─────────────────────────────────────────────
create table public.timer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity text not null check (activity in ('tea', 'reading')),
  target_seconds integer not null check (target_seconds between 60 and 10800),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'stopped')),
  check ((status = 'running') = (ended_at is null))
);

-- 사용자당 실행 중인 타이머는 하나만
create unique index timer_sessions_one_running_per_user
  on public.timer_sessions (user_id) where status = 'running';

create index timer_sessions_user_ended_idx on public.timer_sessions (user_id, ended_at desc);

alter table public.timer_sessions enable row level security;

create policy "본인 타이머만 조회할 수 있다"
  on public.timer_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- insert/update 정책 없음: start_timer / finish_timer 함수로만 쓴다.

create or replace function public.start_timer(p_activity text, p_target_seconds integer)
returns public.timer_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.timer_sessions;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.timer_sessions (user_id, activity, target_seconds)
  values (auth.uid(), p_activity, p_target_seconds)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'timer_already_running' using errcode = 'P0001';
end;
$$;

-- 종료. 이미 끝난 타이머면 아무것도 바꾸지 않고 기존 결과를 돌려준다 (중복 종료 방지).
-- 종료 시각은 목표 시각을 넘지 않는다. 탭을 닫았다가 몇 시간 뒤 돌아와도 목표 시간만큼만 기록된다.
create or replace function public.finish_timer(p_id uuid, p_status text)
returns public.timer_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.timer_sessions;
begin
  if p_status not in ('completed', 'stopped') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.timer_sessions
  set
    ended_at = least(now(), started_at + make_interval(secs => target_seconds)),
    -- 목표 시간이 이미 지났으면 중단 요청이어도 완료로 본다.
    -- 1분도 안 돼 누른 완료는 중단으로 본다 (0초 완료로 출석만 채우는 것 방지).
    status = case
      when now() >= started_at + make_interval(secs => target_seconds) then 'completed'
      when p_status = 'completed' and now() < started_at + interval '1 minute' then 'stopped'
      else p_status
    end
  where id = p_id and user_id = auth.uid() and status = 'running'
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.timer_sessions where id = p_id and user_id = auth.uid();
    if v_row.id is null then
      raise exception 'timer_not_found' using errcode = 'P0002';
    end if;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.start_timer(text, integer) from public, anon;
revoke execute on function public.finish_timer(uuid, text) from public, anon;
grant execute on function public.start_timer(text, integer) to authenticated;
grant execute on function public.finish_timer(uuid, text) to authenticated;

-- ─────────────────────────────────────────────
-- 출석 (명세 2.2): 하루(KST)에 완료 타이머 1건 이상이면 출석
-- security_invoker 라서 timer_sessions의 RLS가 그대로 적용된다.
-- ─────────────────────────────────────────────
create view public.attendance_days
with (security_invoker = true) as
select
  user_id,
  (ended_at at time zone 'Asia/Seoul')::date as day,
  count(*)::integer as sessions,
  sum(extract(epoch from ended_at - started_at))::integer as focus_seconds
from public.timer_sessions
where status = 'completed'
group by user_id, (ended_at at time zone 'Asia/Seoul')::date;
