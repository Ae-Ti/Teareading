-- ─────────────────────────────────────────────
-- 타이머 일시정지 (소유: 태일, docs/woong/to-taeil.md 요청)
-- 상태를 늘리지 않고 running + paused_at으로 표현한다.
-- 멈춘 타이머도 running이라 사용자당 1개 제한이 그대로 적용된다.
-- 멈춘 타이머는 자동으로 끝나지 않는다. 사용자가 이어서 하거나 끝낸다.
-- ─────────────────────────────────────────────
alter table public.timer_sessions
  add column paused_at timestamptz,
  add column paused_seconds integer not null default 0 check (paused_seconds >= 0),
  add constraint timer_sessions_paused_only_running check (paused_at is null or status = 'running');

-- 멈춤. 이미 멈췄거나 끝났거나 목표 시각이 지났으면 바꾸지 않고 현재 상태를 돌려준다.
create or replace function public.pause_timer(p_id uuid)
returns public.timer_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.timer_sessions;
begin
  update public.timer_sessions
  set paused_at = now()
  where id = p_id
    and user_id = auth.uid()
    and status = 'running'
    and paused_at is null
    and now() < started_at + make_interval(secs => target_seconds + paused_seconds)
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

-- 이어서 하기. 멈춰 있지 않으면 바꾸지 않는다 (연타해도 한 번만 반영).
create or replace function public.resume_timer(p_id uuid)
returns public.timer_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.timer_sessions;
begin
  update public.timer_sessions
  set
    paused_seconds = paused_seconds + ceil(extract(epoch from now() - paused_at))::integer,
    paused_at = null
  where id = p_id
    and user_id = auth.uid()
    and status = 'running'
    and paused_at is not null
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

-- 종료. p_status:
--   completed, stopped: 사용자가 누른 완료·중단
--   expired: 화면의 자동 완료 요청. 다른 탭에서 멈췄거나 목표 시각이 늦춰졌으면 끝내지 않고
--            현재 상태를 돌려주며, 화면은 그 상태로 맞춘다.
-- 멈춘 채로 끝내면 멈춘 시각이 종료 시각이다.
create or replace function public.finish_timer(p_id uuid, p_status text)
returns public.timer_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.timer_sessions;
  v_at timestamptz;
  v_deadline timestamptz;
  v_status text;
begin
  if p_status not in ('completed', 'stopped', 'expired') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  select * into v_row
  from public.timer_sessions
  where id = p_id and user_id = auth.uid()
  for update;

  if v_row.id is null then
    raise exception 'timer_not_found' using errcode = 'P0002';
  end if;
  -- 이미 끝난 타이머면 기존 결과를 돌려준다 (중복 종료 방지)
  if v_row.status <> 'running' then
    return v_row;
  end if;

  v_at := coalesce(v_row.paused_at, now());
  v_deadline := v_row.started_at
    + make_interval(secs => v_row.target_seconds + v_row.paused_seconds);

  if v_at >= v_deadline then
    -- 목표 시간이 이미 지났으면 중단 요청이어도 완료로 본다.
    v_status := 'completed';
  elsif p_status = 'expired' then
    -- 기기 시계 오차로 조금 일찍 온 요청은 2초까지 완료로 받아 준다.
    if v_row.paused_at is not null or now() + interval '2 seconds' < v_deadline then
      return v_row;
    end if;
    v_status := 'completed';
  elsif p_status = 'completed'
    and v_at < v_row.started_at + make_interval(secs => v_row.paused_seconds + 60) then
    -- 1분도 안 돼 누른 완료는 중단으로 본다 (0초 완료로 출석만 채우는 것 방지).
    v_status := 'stopped';
  else
    v_status := p_status;
  end if;

  update public.timer_sessions
  set ended_at = least(v_at, v_deadline), status = v_status, paused_at = null
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.pause_timer(uuid) from public, anon;
revoke execute on function public.resume_timer(uuid) from public, anon;
grant execute on function public.pause_timer(uuid) to authenticated;
grant execute on function public.resume_timer(uuid) to authenticated;

-- 몰입 시간에서 멈춘 시간을 뺀다
create or replace view public.attendance_days
with (security_invoker = true) as
select
  user_id,
  (ended_at at time zone 'Asia/Seoul')::date as day,
  count(*)::integer as sessions,
  sum(extract(epoch from ended_at - started_at) - paused_seconds)::integer as focus_seconds
from public.timer_sessions
where status = 'completed'
group by user_id, (ended_at at time zone 'Asia/Seoul')::date;

-- 통계의 다도 시간에서도 멈춘 시간을 뺀다 (20261109001100_books.sql과 sessions만 다르다)
create or replace function public.my_record_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with kst as (
    select date_trunc('month', now() at time zone 'Asia/Seoul') as this_month
  ),
  months as (
    select generate_series(
      k.this_month - interval '5 months', k.this_month, interval '1 month'
    ) as month
    from kst k
  ),
  logs as (
    select
      r.book_id,
      r.pages_read,
      date_trunc('month', r.created_at at time zone 'Asia/Seoul') as month
    from public.reading_logs r
    where r.user_id = (select auth.uid())
  ),
  shelf as (
    select b.id, b.title, b.status, b.genres
    from public.books b
    where b.user_id = (select auth.uid())
  ),
  book_pages as (
    select s.title, count(l.book_id)::integer as logs, coalesce(sum(l.pages_read), 0)::integer as pages
    from shelf s
    left join logs l on l.book_id = s.id
    group by s.id, s.title
  ),
  teas as (
    select c.tea_type
    from public.tea_columns c
    where c.user_id = (select auth.uid())
  ),
  -- 다도 시간은 출석과 같이 완료한 타이머만 센다
  sessions as (
    select
      (extract(epoch from t.ended_at - t.started_at) - t.paused_seconds)::integer as seconds,
      date_trunc('month', t.ended_at at time zone 'Asia/Seoul') as month
    from public.timer_sessions t
    where t.user_id = (select auth.uid())
      and t.activity = 'tea'
      and t.status = 'completed'
  )
  select jsonb_build_object(
    'reading', jsonb_build_object(
      'books', (select count(*) from shelf),
      'finished', (select count(*) from shelf where status = 'done'),
      'reading_now', (select count(*) from shelf where status = 'reading'),
      'logs', (select count(*) from logs),
      'pages', (select coalesce(sum(pages_read), 0) from logs),
      'pages_this_month', (
        select coalesce(sum(l.pages_read), 0)
        from logs l, kst k where l.month = k.this_month
      ),
      'by_genre', (
        select coalesce(
          jsonb_agg(jsonb_build_object('genre', g.genre, 'count', g.n)
            order by g.n desc, g.genre),
          '[]'::jsonb
        )
        from (
          select u.genre, count(*)::integer as n
          from shelf s, unnest(s.genres) as u(genre)
          group by u.genre
        ) g
      ),
      'top_books', (
        select coalesce(
          jsonb_agg(jsonb_build_object('title', b.title, 'pages', b.pages, 'logs', b.logs)
            order by b.pages desc, b.title),
          '[]'::jsonb
        )
        from (
          select * from book_pages where pages > 0 order by pages desc, title limit 5
        ) b
      ),
      'monthly', (
        select jsonb_agg(
          jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'value', (
              select coalesce(sum(l.pages_read), 0) from logs l where l.month = m.month
            )
          ) order by m.month
        )
        from months m
      )
    ),
    'tea', jsonb_build_object(
      'columns', (select count(*) from teas),
      'untyped', (select count(*) from teas where tea_type is null),
      'by_type', (
        select coalesce(
          jsonb_agg(jsonb_build_object('type', x.tea_type, 'count', x.n)
            order by x.n desc, x.tea_type),
          '[]'::jsonb
        )
        from (
          select tea_type, count(*)::integer as n
          from teas where tea_type is not null group by tea_type
        ) x
      ),
      'seconds', (select coalesce(sum(seconds), 0) from sessions),
      'sessions', (select count(*) from sessions),
      'seconds_this_month', (
        select coalesce(sum(s.seconds), 0)
        from sessions s, kst k where s.month = k.this_month
      ),
      'monthly', (
        select jsonb_agg(
          jsonb_build_object(
            'month', to_char(m.month, 'YYYY-MM'),
            'value', (
              select coalesce(sum(s.seconds), 0) from sessions s where s.month = m.month
            )
          ) order by m.month
        )
        from months m
      )
    )
  );
$$;
