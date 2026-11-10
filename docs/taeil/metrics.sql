-- 출시 지표 집계 (docs/taeil/d6-quality.md 2장). Supabase SQL Editor에서 params 날짜만 바꿔 실행한다.
with params as (
  -- 측정 기간: 출시일부터 2주. 출시일이 정해지면 아래 두 날짜를 바꾼다.
  select timestamptz '2026-11-09 00:00+09' as from_at, timestamptz '2026-11-23 00:00+09' as to_at
),
signups as (
  select user_id, min(created_at) as at from events, params
  where name = 'signup_completed' and user_id is not null
    and created_at >= from_at and created_at < to_at
  group by user_id
),
active as (
  select distinct user_id from events, params
  where user_id is not null and created_at >= from_at and created_at < to_at
),
completed as (
  select user_id, ended_at from timer_sessions, params
  where status = 'completed' and ended_at >= from_at and ended_at < to_at
)
select
  (select count(*) from signups) as 가입자,
  round(100.0 * (select count(*) from signups s where exists (
    select 1 from events e where e.user_id = s.user_id and e.name = 'timer_started'
      and e.created_at < s.at + interval '24 hours'))
    / nullif((select count(*) from signups), 0), 1) as 첫타이머_24h_pct,
  round(100.0 * (select count(*) from (select user_id from completed group by user_id
      having count(*) >= 2 and max(ended_at) - min(ended_at) <= interval '7 days') t)
    / nullif((select count(distinct user_id) from completed), 0), 1) as 타이머재사용_pct,
  round(100.0 * (select count(distinct e.user_id) from events e, params
      where e.name in ('reading_log_created', 'tea_column_created')
        and e.created_at >= from_at and e.created_at < to_at)
    / nullif((select count(distinct user_id) from completed), 0), 1) as 기록작성_pct,
  round(100.0 * (select count(distinct e.user_id) from events e, params
      where e.name = 'space_entered' and e.created_at >= from_at and e.created_at < to_at)
    / nullif((select count(*) from active), 0), 1) as 찻집참여_pct,
  round(100.0 * (select count(distinct e.user_id) from events e, params
      where e.name in ('group_joined', 'group_message_sent') and e.created_at >= from_at and e.created_at < to_at)
    / nullif((select count(*) from active), 0), 1) as 모임참여_pct;

-- 주간 재방문: 첫 주 활동자 중 다음 주에도 이벤트가 있는 비율
with w as (
  select user_id, date_trunc('week', created_at at time zone 'Asia/Seoul') as wk
  from events where user_id is not null group by 1, 2
)
select a.wk as 주, count(*) as 활동자,
  round(100.0 * count(b.user_id) / count(*), 1) as 다음주재방문_pct
from w a left join w b on b.user_id = a.user_id and b.wk = a.wk + interval '1 week'
group by a.wk order by a.wk;

-- 기기별 타이머 완료율 (시작 대비 완료)
select device,
  count(*) filter (where name = 'timer_started') as 시작,
  count(*) filter (where name = 'timer_completed') as 완료,
  round(100.0 * count(*) filter (where name = 'timer_completed')
    / nullif(count(*) filter (where name = 'timer_started'), 0), 1) as 완료율_pct
from events where name in ('timer_started', 'timer_completed') group by device;
