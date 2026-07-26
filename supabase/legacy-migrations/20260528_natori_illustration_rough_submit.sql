-- Add the rough-submit task to legacy illustration projects too.
--
-- 20260527_natori_unified_character_tasks.sql normalized icon / sd / standing.
-- Some existing admin-created projects still use type = illustration, so they
-- kept the old material / rough / line / color / finishing / delivery rows.
-- This keeps the illustration hours mostly intact while removing material and
-- inserting rough-submit.

with affected_projects as (
  select id, status
  from public.natori_projects
  where type = 'illustration'
),
old_task_state as (
  select
    p.id as project_id,
    bool_or(t.task_key = 'rough' and t.done) as rough_done,
    bool_or(t.task_key = 'rough-submit' and t.done) as rough_submit_done,
    bool_or(t.task_key in ('lineart', 'line') and t.done) as lineart_done,
    bool_or(t.task_key in ('color', 'coloring') and t.done) as color_done,
    bool_or(t.task_key in ('review', 'finishing') and t.done) as finishing_done,
    bool_or(t.task_key = 'delivery' and t.done) as delivery_done
  from affected_projects p
  left join public.natori_project_tasks t on t.project_id = p.id
  group by p.id
),
template_tasks as (
  select p.id as project_id, x.*
  from affected_projects p
  cross join lateral (
    values
      ('rough', U&'\30E9\30D5', 'rough', 2.5::numeric, 0),
      ('rough-submit', U&'\30E9\30D5\63D0\51FA', 'rough', 0.5::numeric, 1),
      ('line', U&'\7DDA\753B', 'lineart', 5::numeric, 2),
      ('color', U&'\7740\5F69', 'coloring', 7::numeric, 3),
      ('finishing', U&'\4ED5\4E0A\3052', 'finish', 1.5::numeric, 4),
      ('delivery', U&'\7D0D\54C1', 'delivery', 0.5::numeric, 5)
  ) as x(task_key, label, stage, estimated_hours, sort_order)
),
new_tasks as (
  select
    tt.project_id,
    tt.task_key,
    tt.label,
    tt.stage,
    tt.estimated_hours,
    tt.sort_order,
    case
      when tt.task_key = 'rough'
        then coalesce(ots.rough_done, false)
          or ap.status in ('lineart', 'coloring', 'waiting', 'delivery_prep', 'delivered', 'completed')
      when tt.task_key = 'rough-submit'
        then coalesce(ots.rough_submit_done, false)
          or ap.status in ('lineart', 'coloring', 'waiting', 'delivery_prep', 'delivered', 'completed')
      when tt.task_key = 'line'
        then coalesce(ots.lineart_done, false)
          or ap.status in ('coloring', 'waiting', 'delivery_prep', 'delivered', 'completed')
      when tt.task_key = 'color'
        then coalesce(ots.color_done, false)
          or ap.status in ('waiting', 'delivery_prep', 'delivered', 'completed')
      when tt.task_key = 'finishing'
        then coalesce(ots.finishing_done, false)
          or ap.status in ('delivery_prep', 'delivered', 'completed')
      when tt.task_key = 'delivery'
        then coalesce(ots.delivery_done, false)
          or ap.status in ('delivered', 'completed')
      else false
    end as done
  from template_tasks tt
  join affected_projects ap on ap.id = tt.project_id
  left join old_task_state ots on ots.project_id = tt.project_id
)
insert into public.natori_project_tasks (
  project_id,
  task_key,
  label,
  stage,
  estimated_hours,
  done,
  sort_order
)
select
  project_id,
  task_key,
  label,
  stage,
  estimated_hours,
  done,
  sort_order
from new_tasks
order by project_id, sort_order
on conflict (project_id, task_key) do update
set
  label = excluded.label,
  stage = excluded.stage,
  estimated_hours = excluded.estimated_hours,
  done = excluded.done,
  sort_order = excluded.sort_order;

delete from public.natori_project_tasks t
using public.natori_projects p
where p.id = t.project_id
  and p.type = 'illustration'
  and t.task_key not in (
    'rough',
    'rough-submit',
    'line',
    'color',
    'finishing',
    'delivery'
  );
