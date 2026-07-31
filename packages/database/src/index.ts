export interface DatabaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile extends DatabaseEntity {
  email: string;
  displayName?: string;
  currentTitle?: string;
  targetTitle?: string;
  language: string;
  onboardingCompleted: boolean;
}

export interface Role extends DatabaseEntity {
  name: string;
  description?: string;
}

export interface Permission extends DatabaseEntity {
  code: string;
  description?: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  description?: string;
  updatedAt?: string;
}

export const DATABASE_TABLES = [
  "profiles",
  "roles",
  "permissions",
  "settings",
  "skills",
  "user_skills",
  "okrs",
  "roadmaps",
  "learning_resources",
  "learning_history",
  "projects",
  "jobs",
  "interviews",
  "resumes",
  "ai_chats",
  "weekly_plans",
] as const;
