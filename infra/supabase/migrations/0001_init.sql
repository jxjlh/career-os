-- Career OS Supabase setup
-- Run this after Alembic has created the application tables.

-- 1. Profile trigger from Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, language)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'language', 'zh-CN')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2. Row Level Security
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.learning_resources enable row level security;
alter table public.limit_configs enable row level security;
alter table public.background_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_skills', 'okrs', 'okr_key_results', 'roadmaps', 'roadmap_milestones',
    'user_resource_states', 'bookmarks', 'bookmark_tags', 'tags',
    'search_queries', 'search_results', 'learning_history', 'learning_history_aggregates',
    'study_sessions', 'projects', 'project_files', 'project_analyses',
    'jobs', 'job_analyses', 'salary_plans', 'interviews', 'interview_sessions',
    'interview_questions', 'interview_answers', 'interview_feedback',
    'resumes', 'resume_versions', 'ai_chats', 'ai_messages',
    'weekly_plans', 'plan_tasks', 'user_limits'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy "own_select_%s" on public.%I for select using (auth.uid() = user_id);', t, t);
    execute format('create policy "own_insert_%s" on public.%I for insert with check (auth.uid() = user_id);', t, t);
    execute format('create policy "own_update_%s" on public.%I for update using (auth.uid() = user_id);', t, t);
    execute format('create policy "own_delete_%s" on public.%I for delete using (auth.uid() = user_id);', t, t);
  end loop;
end $$;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "skills_read_authenticated" on public.skills
  for select to authenticated using (true);
create policy "resources_read_authenticated" on public.learning_resources
  for select to authenticated using (true);
create policy "limits_read_authenticated" on public.limit_configs
  for select to authenticated using (true);
create policy "jobs_read_own" on public.background_jobs
  for select using (user_id is null or auth.uid() = user_id);
create policy "notifications_read_own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- 3. Storage buckets (private)
insert into storage.buckets (id, name, public)
values
  ('projects', 'projects', false),
  ('interviews', 'interviews', false),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "projects_owner_all" on storage.objects
  for all using (bucket_id = 'projects' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'projects' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "interviews_owner_all" on storage.objects
  for all using (bucket_id = 'interviews' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'interviews' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "avatars_owner_all" on storage.objects
  for all using (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

-- 4. Seed skills
insert into public.skills (id, name, category, description)
values
  (gen_random_uuid(), 'Marketing', 'Marketing', '品牌与营销基础'),
  (gen_random_uuid(), 'Growth Marketing', 'Growth', '增长营销与 A/B 测试'),
  (gen_random_uuid(), 'SQL', 'Data', '数据分析查询'),
  (gen_random_uuid(), 'Power BI', 'Data', '数据可视化'),
  (gen_random_uuid(), 'Python', 'Data', '数据处理与自动化'),
  (gen_random_uuid(), 'GA4', 'Data', '网站数据分析'),
  (gen_random_uuid(), 'AI Agent', 'AI', '智能体应用开发'),
  (gen_random_uuid(), 'Product Marketing', 'Marketing', '产品上市与定位'),
  (gen_random_uuid(), 'Marketing Ops', 'Ops', '营销运营与自动化'),
  (gen_random_uuid(), 'HubSpot', 'CRM', 'CRM 管理与自动化'),
  (gen_random_uuid(), 'System Design', 'Engineering', '系统设计'),
  (gen_random_uuid(), 'Product Planning', 'Product', '产品规划')
on conflict (name) do nothing;

-- 5. Seed limit configs
insert into public.limit_configs (id, config_key, config_value, description)
values
  (gen_random_uuid(), 'ai_messages_per_day', '{"value": 30}', 'AI 对话每日限额'),
  (gen_random_uuid(), 'searches_per_day', '{"value": 20}', '搜索每日限额'),
  (gen_random_uuid(), 'ai_summaries_per_day', '{"value": 20}', 'AI 总结每日限额'),
  (gen_random_uuid(), 'quiz_per_day', '{"value": 10}', 'Quiz 每日限额'),
  (gen_random_uuid(), 'interviews_per_day', '{"value": 3}', '模拟面试每日限额'),
  (gen_random_uuid(), 'resumes_per_day', '{"value": 3}', '简历生成每日限额'),
  (gen_random_uuid(), 'storage_bytes_limit', '{"value": 524288000}', '存储空间限额')
on conflict (config_key) do update set config_value = excluded.config_value, description = excluded.description;
