-- Career OS full Supabase init (generated)
BEGIN;
DROP TABLE IF EXISTS public.learning_resources CASCADE;
DROP TABLE IF EXISTS public.limit_configs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.ai_chats CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.background_jobs CASCADE;
DROP TABLE IF EXISTS public.bookmarks CASCADE;
DROP TABLE IF EXISTS public.interviews CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;
DROP TABLE IF EXISTS public.learning_history CASCADE;
DROP TABLE IF EXISTS public.learning_history_aggregates CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.okrs CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.resumes CASCADE;
DROP TABLE IF EXISTS public.roadmaps CASCADE;
DROP TABLE IF EXISTS public.salary_plans CASCADE;
DROP TABLE IF EXISTS public.search_queries CASCADE;
DROP TABLE IF EXISTS public.study_sessions CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.user_limits CASCADE;
DROP TABLE IF EXISTS public.user_resource_states CASCADE;
DROP TABLE IF EXISTS public.user_skills CASCADE;
DROP TABLE IF EXISTS public.weekly_plans CASCADE;
DROP TABLE IF EXISTS public.ai_messages CASCADE;
DROP TABLE IF EXISTS public.bookmark_tags CASCADE;
DROP TABLE IF EXISTS public.interview_sessions CASCADE;
DROP TABLE IF EXISTS public.job_analyses CASCADE;
DROP TABLE IF EXISTS public.okr_key_results CASCADE;
DROP TABLE IF EXISTS public.plan_tasks CASCADE;
DROP TABLE IF EXISTS public.project_analyses CASCADE;
DROP TABLE IF EXISTS public.project_files CASCADE;
DROP TABLE IF EXISTS public.resume_versions CASCADE;
DROP TABLE IF EXISTS public.roadmap_milestones CASCADE;
DROP TABLE IF EXISTS public.search_results CASCADE;
DROP TABLE IF EXISTS public.interview_feedback CASCADE;
DROP TABLE IF EXISTS public.interview_questions CASCADE;
DROP TABLE IF EXISTS public.interview_answers CASCADE;
COMMIT;
BEGIN;

CREATE TABLE learning_resources (
	id VARCHAR(36) NOT NULL, 
	url TEXT NOT NULL, 
	normalized_url TEXT NOT NULL, 
	title VARCHAR(500) NOT NULL, 
	description TEXT, 
	provider VARCHAR(40) NOT NULL, 
	resource_type VARCHAR(40) NOT NULL, 
	source_name VARCHAR(200), 
	thumbnail_url TEXT, 
	language VARCHAR(16) NOT NULL, 
	difficulty VARCHAR(32), 
	duration_minutes INTEGER, 
	published_at TIMESTAMP WITH TIME ZONE, 
	author VARCHAR(200), 
	license VARCHAR(80), 
	is_official BOOLEAN NOT NULL, 
	is_free BOOLEAN NOT NULL, 
	metadata JSON NOT NULL, 
	normalized_hash VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (url), 
	UNIQUE (normalized_url)
)

;
CREATE INDEX ix_learning_resources_provider ON learning_resources (provider);
CREATE INDEX ix_learning_resources_resource_type ON learning_resources (resource_type);


CREATE TABLE limit_configs (
	id VARCHAR(36) NOT NULL, 
	config_key VARCHAR(80) NOT NULL, 
	config_value JSON NOT NULL, 
	description TEXT, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	UNIQUE (config_key)
)

;


CREATE TABLE profiles (
	id VARCHAR(36) NOT NULL, 
	email VARCHAR(320) NOT NULL, 
	display_name VARCHAR(120), 
	avatar_url TEXT, 
	current_title VARCHAR(120), 
	company VARCHAR(120), 
	target_title VARCHAR(120), 
	target_salary FLOAT, 
	currency VARCHAR(8) NOT NULL, 
	experience_years FLOAT, 
	timezone VARCHAR(64) NOT NULL, 
	language VARCHAR(16) NOT NULL, 
	weekly_study_minutes INTEGER NOT NULL, 
	onboarding_completed BOOLEAN NOT NULL, 
	preferences JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)

;
CREATE UNIQUE INDEX ix_profiles_email ON profiles (email);


CREATE TABLE skills (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	description TEXT, 
	icon VARCHAR(80), 
	tags JSON NOT NULL, 
	is_ai_generated BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
)

;
CREATE INDEX ix_skills_category ON skills (category);
CREATE UNIQUE INDEX ix_skills_name ON skills (name);


CREATE TABLE ai_chats (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	channel VARCHAR(32) NOT NULL, 
	title VARCHAR(200), 
	context JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_chats_user_id ON ai_chats (user_id);


CREATE TABLE audit_logs (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	action VARCHAR(64) NOT NULL, 
	entity_type VARCHAR(64), 
	entity_id VARCHAR(36), 
	metadata JSON NOT NULL, 
	ip VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);


CREATE TABLE background_jobs (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	job_type VARCHAR(64) NOT NULL, 
	payload JSON NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	attempts INTEGER NOT NULL, 
	max_attempts INTEGER NOT NULL, 
	error TEXT, 
	result JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_background_jobs_job_type ON background_jobs (job_type);
CREATE INDEX ix_background_jobs_user_id ON background_jobs (user_id);
CREATE INDEX ix_background_jobs_status ON background_jobs (status);


CREATE TABLE bookmarks (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	resource_id VARCHAR(36) NOT NULL, 
	note TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_bookmarks_user_resource UNIQUE (user_id, resource_id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(resource_id) REFERENCES learning_resources (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_bookmarks_user_id ON bookmarks (user_id);
CREATE INDEX ix_bookmarks_resource_id ON bookmarks (resource_id);


CREATE TABLE interviews (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	interview_type VARCHAR(32) NOT NULL, 
	mode VARCHAR(32) NOT NULL, 
	role VARCHAR(120), 
	language VARCHAR(16) NOT NULL, 
	difficulty VARCHAR(32) NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	config JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_interviews_user_id ON interviews (user_id);


CREATE TABLE jobs (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	company VARCHAR(200), 
	location VARCHAR(120), 
	url TEXT, 
	salary_min FLOAT, 
	salary_max FLOAT, 
	currency VARCHAR(8) NOT NULL, 
	jd_raw TEXT, 
	status VARCHAR(32) NOT NULL, 
	match_score FLOAT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_jobs_user_id ON jobs (user_id);


CREATE TABLE learning_history (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	resource_id VARCHAR(36), 
	action VARCHAR(32) NOT NULL, 
	topic VARCHAR(200), 
	duration_minutes INTEGER, 
	metadata JSON NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(resource_id) REFERENCES learning_resources (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_learning_history_action ON learning_history (action);
CREATE INDEX ix_learning_history_occurred_at ON learning_history (occurred_at);
CREATE INDEX ix_learning_history_user_id ON learning_history (user_id);


CREATE TABLE learning_history_aggregates (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	month DATE NOT NULL, 
	total_minutes INTEGER NOT NULL, 
	action_counts JSON NOT NULL, 
	resource_completed INTEGER NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_learning_history_aggregates_user_month UNIQUE (user_id, month), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_learning_history_aggregates_user_id ON learning_history_aggregates (user_id);


CREATE TABLE notifications (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	type VARCHAR(32) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	body TEXT, 
	read_at TIMESTAMP WITH TIME ZONE, 
	link TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_notifications_user_id ON notifications (user_id);


CREATE TABLE okrs (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	objective TEXT, 
	cycle_start DATE, 
	cycle_end DATE, 
	status VARCHAR(32) NOT NULL, 
	progress FLOAT NOT NULL, 
	ai_generated BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_okrs_user_id ON okrs (user_id);


CREATE TABLE projects (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	status VARCHAR(32) NOT NULL, 
	role VARCHAR(120), 
	url TEXT, 
	repo_url TEXT, 
	cover_url TEXT, 
	tags JSON NOT NULL, 
	highlight BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_projects_user_id ON projects (user_id);


CREATE TABLE resumes (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	language VARCHAR(8) NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	template VARCHAR(64) NOT NULL, 
	sections JSON NOT NULL, 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_resumes_user_id ON resumes (user_id);


CREATE TABLE roadmaps (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	horizon_years SMALLINT NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	metadata JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_roadmaps_user_id ON roadmaps (user_id);


CREATE TABLE salary_plans (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	current_salary FLOAT NOT NULL, 
	target_salary FLOAT NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	horizon_years INTEGER NOT NULL, 
	assumptions JSON NOT NULL, 
	breakdown JSON NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_salary_plans_user_id ON salary_plans (user_id);


CREATE TABLE search_queries (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	query VARCHAR(500) NOT NULL, 
	raw_query TEXT, 
	providers JSON NOT NULL, 
	filters JSON NOT NULL, 
	result_count INTEGER NOT NULL, 
	ai_reranked BOOLEAN NOT NULL, 
	latency_ms INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_search_queries_user_id ON search_queries (user_id);


CREATE TABLE study_sessions (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	resource_id VARCHAR(36), 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	duration_minutes INTEGER, 
	topic VARCHAR(200), 
	notes TEXT, 
	focus_score SMALLINT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(resource_id) REFERENCES learning_resources (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_study_sessions_user_id ON study_sessions (user_id);


CREATE TABLE tags (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	color VARCHAR(16), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_tags_user_name UNIQUE (user_id, name), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_tags_user_id ON tags (user_id);


CREATE TABLE user_limits (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	quota_date DATE NOT NULL, 
	ai_messages_used INTEGER NOT NULL, 
	searches_used INTEGER NOT NULL, 
	ai_summaries_used INTEGER NOT NULL, 
	quiz_used INTEGER NOT NULL, 
	interviews_used INTEGER NOT NULL, 
	resumes_generated INTEGER NOT NULL, 
	storage_bytes_used INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_limits_user_date UNIQUE (user_id, quota_date), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_user_limits_user_id ON user_limits (user_id);


CREATE TABLE user_resource_states (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	resource_id VARCHAR(36) NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	progress SMALLINT NOT NULL, 
	rating SMALLINT, 
	notes TEXT, 
	started_at TIMESTAMP WITH TIME ZONE, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(resource_id) REFERENCES learning_resources (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_user_resource_states_resource_id ON user_resource_states (resource_id);
CREATE INDEX ix_user_resource_states_user_id ON user_resource_states (user_id);


CREATE TABLE user_skills (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	skill_id VARCHAR(36) NOT NULL, 
	current_level SMALLINT NOT NULL, 
	target_level SMALLINT NOT NULL, 
	confidence FLOAT NOT NULL, 
	notes TEXT, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(skill_id) REFERENCES skills (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_user_skills_user_id ON user_skills (user_id);
CREATE INDEX ix_user_skills_skill_id ON user_skills (skill_id);


CREATE TABLE weekly_plans (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	week_start DATE NOT NULL, 
	title VARCHAR(200), 
	status VARCHAR(32) NOT NULL, 
	ai_generated BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_weekly_plans_user_id ON weekly_plans (user_id);
CREATE INDEX ix_weekly_plans_week_start ON weekly_plans (week_start);


CREATE TABLE ai_messages (
	id VARCHAR(36) NOT NULL, 
	chat_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	content TEXT NOT NULL, 
	tool_calls JSON NOT NULL, 
	provider VARCHAR(64), 
	model VARCHAR(64), 
	tokens_in INTEGER, 
	tokens_out INTEGER, 
	latency_ms INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(chat_id) REFERENCES ai_chats (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_ai_messages_user_id ON ai_messages (user_id);
CREATE INDEX ix_ai_messages_chat_id ON ai_messages (chat_id);


CREATE TABLE bookmark_tags (
	id VARCHAR(36) NOT NULL, 
	bookmark_id VARCHAR(36) NOT NULL, 
	tag_id VARCHAR(36) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(bookmark_id) REFERENCES bookmarks (id) ON DELETE CASCADE, 
	FOREIGN KEY(tag_id) REFERENCES tags (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_bookmark_tags_bookmark_id ON bookmark_tags (bookmark_id);
CREATE INDEX ix_bookmark_tags_tag_id ON bookmark_tags (tag_id);


CREATE TABLE interview_sessions (
	id VARCHAR(36) NOT NULL, 
	interview_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	transcript JSON NOT NULL, 
	audio_paths JSON NOT NULL, 
	ai_provider VARCHAR(64), 
	ai_model VARCHAR(64), 
	status VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(interview_id) REFERENCES interviews (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_interview_sessions_user_id ON interview_sessions (user_id);
CREATE INDEX ix_interview_sessions_interview_id ON interview_sessions (interview_id);


CREATE TABLE job_analyses (
	id VARCHAR(36) NOT NULL, 
	job_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	extracted_skills JSON NOT NULL, 
	required_experience TEXT, 
	skill_gaps JSON NOT NULL, 
	match_score FLOAT NOT NULL, 
	recommendations JSON NOT NULL, 
	ai_provider VARCHAR(64), 
	ai_model VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(job_id) REFERENCES jobs (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_job_analyses_user_id ON job_analyses (user_id);
CREATE INDEX ix_job_analyses_job_id ON job_analyses (job_id);


CREATE TABLE okr_key_results (
	id VARCHAR(36) NOT NULL, 
	okr_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	metric_type VARCHAR(32) NOT NULL, 
	target_value FLOAT NOT NULL, 
	current_value FLOAT NOT NULL, 
	unit VARCHAR(32), 
	sort_order INTEGER NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(okr_id) REFERENCES okrs (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_okr_key_results_okr_id ON okr_key_results (okr_id);
CREATE INDEX ix_okr_key_results_user_id ON okr_key_results (user_id);


CREATE TABLE plan_tasks (
	id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	day SMALLINT NOT NULL, 
	estimated_minutes INTEGER NOT NULL, 
	resource_id VARCHAR(36), 
	status VARCHAR(32) NOT NULL, 
	sort_order INTEGER NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(plan_id) REFERENCES weekly_plans (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	FOREIGN KEY(resource_id) REFERENCES learning_resources (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_plan_tasks_user_id ON plan_tasks (user_id);
CREATE INDEX ix_plan_tasks_plan_id ON plan_tasks (plan_id);


CREATE TABLE project_analyses (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	analysis_type VARCHAR(32) NOT NULL, 
	content JSON NOT NULL, 
	ai_provider VARCHAR(64), 
	ai_model VARCHAR(64), 
	status VARCHAR(32) NOT NULL, 
	error TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_project_analyses_user_id ON project_analyses (user_id);
CREATE INDEX ix_project_analyses_project_id ON project_analyses (project_id);


CREATE TABLE project_files (
	id VARCHAR(36) NOT NULL, 
	project_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	storage_path TEXT NOT NULL, 
	original_name VARCHAR(300) NOT NULL, 
	file_type VARCHAR(32) NOT NULL, 
	mime_type VARCHAR(120), 
	size_bytes INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE, 
	UNIQUE (storage_path)
)

;
CREATE INDEX ix_project_files_user_id ON project_files (user_id);
CREATE INDEX ix_project_files_project_id ON project_files (project_id);


CREATE TABLE resume_versions (
	id VARCHAR(36) NOT NULL, 
	resume_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	content JSON NOT NULL, 
	change_note TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(resume_id) REFERENCES resumes (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_resume_versions_resume_id ON resume_versions (resume_id);
CREATE INDEX ix_resume_versions_user_id ON resume_versions (user_id);


CREATE TABLE roadmap_milestones (
	id VARCHAR(36) NOT NULL, 
	roadmap_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	title VARCHAR(300) NOT NULL, 
	description TEXT, 
	phase VARCHAR(80), 
	target_date DATE, 
	sort_order INTEGER NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(roadmap_id) REFERENCES roadmaps (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_roadmap_milestones_roadmap_id ON roadmap_milestones (roadmap_id);
CREATE INDEX ix_roadmap_milestones_user_id ON roadmap_milestones (user_id);


CREATE TABLE search_results (
	id VARCHAR(36) NOT NULL, 
	query_id VARCHAR(36) NOT NULL, 
	resource_id VARCHAR(36), 
	provider VARCHAR(40) NOT NULL, 
	rank SMALLINT NOT NULL, 
	score FLOAT NOT NULL, 
	title VARCHAR(500) NOT NULL, 
	url TEXT NOT NULL, 
	snippet TEXT, 
	metadata JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(query_id) REFERENCES search_queries (id) ON DELETE CASCADE, 
	FOREIGN KEY(resource_id) REFERENCES learning_resources (id) ON DELETE SET NULL
)

;
CREATE INDEX ix_search_results_query_id ON search_results (query_id);


CREATE TABLE interview_feedback (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	overall_score FLOAT NOT NULL, 
	dimensions JSON NOT NULL, 
	strengths TEXT, 
	improvements TEXT, 
	sample_answer TEXT, 
	ai_provider VARCHAR(64), 
	ai_model VARCHAR(64), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES interview_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_interview_feedback_user_id ON interview_feedback (user_id);
CREATE INDEX ix_interview_feedback_session_id ON interview_feedback (session_id);


CREATE TABLE interview_questions (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	question TEXT NOT NULL, 
	type VARCHAR(32) NOT NULL, 
	expected_keywords JSON NOT NULL, 
	difficulty VARCHAR(32), 
	sort_order INTEGER NOT NULL, 
	ai_generated BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES interview_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_interview_questions_user_id ON interview_questions (user_id);
CREATE INDEX ix_interview_questions_session_id ON interview_questions (session_id);


CREATE TABLE interview_answers (
	id VARCHAR(36) NOT NULL, 
	session_id VARCHAR(36) NOT NULL, 
	question_id VARCHAR(36), 
	user_id VARCHAR(36) NOT NULL, 
	answer_text TEXT NOT NULL, 
	audio_path TEXT, 
	duration_seconds INTEGER, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES interview_sessions (id) ON DELETE CASCADE, 
	FOREIGN KEY(question_id) REFERENCES interview_questions (id) ON DELETE SET NULL, 
	FOREIGN KEY(user_id) REFERENCES profiles (id) ON DELETE CASCADE
)

;
CREATE INDEX ix_interview_answers_user_id ON interview_answers (user_id);
CREATE INDEX ix_interview_answers_session_id ON interview_answers (session_id);

COMMIT;
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
