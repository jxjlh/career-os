"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Locale = "zh-CN" | "en";

const zh = {
  nav: {
    dashboard: "首页",
    roadmap: "职业路线",
    skills: "技能矩阵",
    explore: "学习搜索",
    library: "资源库",
    planner: "周计划",
    projects: "作品集",
    interviews: "面试中心",
    jobs: "岗位市场",
    salary: "薪资规划",
    coach: "AI 教练",
    resume: "简历",
    analytics: "成长分析",
    settings: "设置",
    overview: "总览",
    growth: "成长",
    learning: "学习",
    career: "求职",
    ai: "智能",
    system: "系统",
  },
  common: {
    search: "搜索",
    generate: "生成",
    save: "保存",
    cancel: "取消",
    complete: "完成",
    today: "今天",
    week: "本周",
    month: "本月",
    loading: "加载中...",
    retry: "重试",
    empty: "暂无数据",
    aiGenerated: "AI 生成",
    language: "中文 / English",
    theme: "主题",
    viewAll: "查看全部",
  },
  dashboard: {
    title: "Dashboard",
    weeklyMinutes: "本周学习",
    streak: "连续学习",
    skills: "技能覆盖",
    projects: "作品数量",
    trend: "成长趋势",
    calendar: "学习日历",
    advice: "AI 建议",
    tasks: "今日任务",
    recent: "近期动态",
  },
  explore: {
    title: "学习搜索",
    placeholder: "输入想学的技能，例如 Power BI",
    providers: "数据源",
    filters: "筛选",
    aiRanked: "AI 推荐",
    newest: "最新",
    free: "免费优先",
    minutes: "分钟",
    open: "打开原链接",
    save: "收藏",
    learning: "学习中",
    summary: "AI 总结",
    quiz: "生成 Quiz",
    mindmap: "思维导图",
  },
  planner: {
    title: "周计划",
    generate: "AI 生成本周计划",
    days: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    minutes: "分钟",
  },
  skills: {
    title: "技能矩阵",
    current: "当前",
    target: "目标",
    gap: "差距",
    update: "更新等级",
  },
  roadmap: {
    title: "职业路线",
    years3: "3 年",
    years5: "5 年",
    years10: "10 年",
    generate: "AI 生成路线",
  },
  auth: {
    login: "登录",
    signup: "注册",
    loginSub: "邮箱 + 密码登录 Career OS。",
    signupSub: "创建 Career OS 账号，开始你的职业成长。",
    email: "Email",
    password: "Password",
    loginCta: "登录",
    signupCta: "注册",
    loggingIn: "登录中...",
    signingUp: "注册中...",
    devMode: "当前为开发模式：未配置 Supabase，将使用本地开发账号。",
    haveAccount: "已有账号？",
    noAccount: "还没有账号？",
    passwordHint: "Password (至少 6 位)",
  },
  onboarding: {
    stepBasic: "基础信息",
    stepGoal: "职业目标",
    stepSkills: "技能自评",
    stepTime: "时间预算",
    currentTitlePh: "当前岗位，如 市场营销专员",
    companyPh: "公司（可选）",
    years: "工作年限",
    targetTitlePh: "目标岗位，如 Growth Marketing Manager",
    targetSalaryPh: "目标年薪（CNY）",
    skillDesc: "选择 3-6 项技能，拖动滑块设置当前与目标等级。",
    weeklyPh: "每周分钟数",
    finishDesc: "提交后 AI 会生成你的初始职业路线与本周学习计划。",
    back: "上一步",
    next: "下一步",
    generate: "生成我的计划",
    first: "先认识一下你",
    goal: "你的职业目标",
    skills: "自评当前技能",
    time: "每周可投入时间",
  },
  projects: {
    titlePh: "项目标题",
    noProjects: "还没有项目，创建一个开始积累作品集。",
    noDesc: "暂无描述",
  },
  interviews: {
    titlePh: "面试标题",
    rolePh: "目标岗位",
    start: "开始面试",
    noInterviews: "还没有模拟面试，创建一个开始练习。",
    questionOf: "第 {current} / {total} 题",
    answerPh: "输入你的回答（文本模式；语音转写在后续版本接入浏览器 Web Speech）...",
    nextQ: "提交下一题",
    finish: "完成面试",
    score: "AI 评分",
  },
  jobs: {
    titlePh: "岗位标题",
    companyPh: "公司",
    noJobs: "还没有保存岗位。",
  },
  salary: {
    assumptions: "Salary assumptions",
    currentSalary: "当前年薪 (CNY)",
    targetSalary: "目标年薪 (CNY)",
    generateCta: "AI 拆解目标薪资",
    breakdown: "AI breakdown",
    noPlan: "输入当前与目标薪资后生成技能、项目、岗位阶梯与时间线。",
    phaseSalary: "目标薪资 ¥{salary}w · {level}",
  },
  coach: {
    newChat: "新建会话",
    ask: "输入问题...",
    emptyTitle: "询问你的下一步学习计划",
    emptyDesc: "AI Coach 会结合技能、学习记录、项目与岗位目标回答。",
  },
  resume: {
    namePh: "简历名称",
    noResumes: "还没有简历，创建一个后由 AI 自动生成内容。",
    generate: "生成",
    exportPdf: "导出 PDF",
    version: "版本",
  },
  library: {
    noBookmarks: "收藏的学习资源会出现在这里，并支持标签与笔记。",
  },
  analytics: {
    totalMinutes: "总学习时长",
    avgDay: "日均",
    completion: "完成率",
    projects: "项目数",
    studyByWeek: "每周学习时长",
  },
  settings: {
    profile: "个人资料",
    preferences: "偏好",
    language: "语言",
    theme: "主题",
    usage: "免费版用量",
    aiChat: "AI 对话",
    search: "搜索",
    interview: "面试",
  },
};

type Dictionary = typeof zh;

const en: Dictionary = {
  nav: {
    dashboard: "Dashboard",
    roadmap: "Roadmap",
    skills: "Skill Matrix",
    explore: "Explore",
    library: "Library",
    planner: "Planner",
    projects: "Projects",
    interviews: "Interviews",
    jobs: "Job Market",
    salary: "Salary",
    coach: "AI Coach",
    resume: "Resume",
    analytics: "Analytics",
    settings: "Settings",
    overview: "Overview",
    growth: "Growth",
    learning: "Learning",
    career: "Career",
    ai: "AI",
    system: "System",
  },
  common: {
    search: "Search",
    generate: "Generate",
    save: "Save",
    cancel: "Cancel",
    complete: "Complete",
    today: "Today",
    week: "Week",
    month: "Month",
    loading: "Loading...",
    retry: "Retry",
    empty: "No data yet",
    aiGenerated: "AI generated",
    language: "中文 / English",
    theme: "Theme",
    viewAll: "View all",
  },
  dashboard: {
    title: "Dashboard",
    weeklyMinutes: "Study this week",
    streak: "Day streak",
    skills: "Skills covered",
    projects: "Projects",
    trend: "Growth trend",
    calendar: "Learning calendar",
    advice: "AI advice",
    tasks: "Today's tasks",
    recent: "Recent activity",
  },
  explore: {
    title: "Explore",
    placeholder: "Search a skill, e.g. Power BI",
    providers: "Sources",
    filters: "Filters",
    aiRanked: "AI ranked",
    newest: "Newest",
    free: "Free first",
    minutes: "min",
    open: "Open original",
    save: "Save",
    learning: "In progress",
    summary: "AI summary",
    quiz: "Generate quiz",
    mindmap: "Mind map",
  },
  planner: {
    title: "Weekly Planner",
    generate: "Generate this week",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    minutes: "min",
  },
  skills: {
    title: "Skill Matrix",
    current: "Current",
    target: "Target",
    gap: "Gap",
    update: "Update level",
  },
  roadmap: {
    title: "Career Roadmap",
    years3: "3 years",
    years5: "5 years",
    years10: "10 years",
    generate: "Generate roadmap",
  },
  auth: {
    login: "Log in",
    signup: "Sign up",
    loginSub: "Sign in to Career OS with email and password.",
    signupSub: "Create a Career OS account to start growing.",
    email: "Email",
    password: "Password",
    loginCta: "Log in",
    signupCta: "Sign up",
    loggingIn: "Logging in...",
    signingUp: "Signing up...",
    devMode: "Dev mode: Supabase is not configured, using a local dev account.",
    haveAccount: "Already have an account?",
    noAccount: "No account yet?",
    passwordHint: "Password (min 6 chars)",
  },
  onboarding: {
    stepBasic: "Basics",
    stepGoal: "Career goal",
    stepSkills: "Skills",
    stepTime: "Time budget",
    currentTitlePh: "Current title, e.g. Marketing Specialist",
    companyPh: "Company (optional)",
    years: "Years of experience",
    targetTitlePh: "Target title, e.g. Growth Marketing Manager",
    targetSalaryPh: "Target salary (CNY)",
    skillDesc: "Pick 3-6 skills and set current and target levels.",
    weeklyPh: "Minutes per week",
    finishDesc: "AI will generate your initial roadmap and weekly plan after you submit.",
    back: "Back",
    next: "Next",
    generate: "Generate my plan",
    first: "Tell us about you",
    goal: "Your career goal",
    skills: "Rate your skills",
    time: "Weekly time budget",
  },
  projects: {
    titlePh: "Project title",
    noProjects: "No projects yet. Create one to start building your portfolio.",
    noDesc: "No description yet",
  },
  interviews: {
    titlePh: "Interview title",
    rolePh: "Target role",
    start: "Start interview",
    noInterviews: "No mock interviews yet. Create one to start practicing.",
    questionOf: "Question {current} / {total}",
    answerPh: "Type your answer (text mode; voice transcription will use browser Web Speech)",
    nextQ: "Next question",
    finish: "Finish interview",
    score: "AI score",
  },
  jobs: {
    titlePh: "Job title",
    companyPh: "Company",
    noJobs: "No saved jobs yet.",
  },
  salary: {
    assumptions: "Salary assumptions",
    currentSalary: "Current salary (CNY)",
    targetSalary: "Target salary (CNY)",
    generateCta: "Generate salary breakdown",
    breakdown: "AI breakdown",
    noPlan: "Enter current and target salary to get skills, projects, roles and timeline.",
    phaseSalary: "Target ¥{salary}w · {level}",
  },
  coach: {
    newChat: "New chat",
    ask: "Ask a question...",
    emptyTitle: "Ask about your next learning step",
    emptyDesc: "AI Coach answers based on your skills, learning history, projects and goals.",
  },
  resume: {
    namePh: "Resume name",
    noResumes: "No resumes yet. Create one and AI will draft the content.",
    generate: "Generate",
    exportPdf: "Export PDF",
    version: "Version",
  },
  library: {
    noBookmarks: "Bookmarked resources appear here with tags and notes.",
  },
  analytics: {
    totalMinutes: "Total minutes",
    avgDay: "Avg / day",
    completion: "Completion",
    projects: "Projects",
    studyByWeek: "Study time by week",
  },
  settings: {
    profile: "Profile",
    preferences: "Preferences",
    language: "Language",
    theme: "Theme",
    usage: "Free plan usage",
    aiChat: "AI chat",
    search: "Search",
    interview: "Interviews",
  },
};

const dictionaries: Record<Locale, Dictionary> = { "zh-CN": zh, en };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-CN");
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem("career_os_locale", next);
    } catch {
      // ignore
    }
  }, []);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => {
        const result = key
          .split(".")
          .reduce<unknown>((obj, part) => (obj as Record<string, unknown>)?.[part], dictionaries[locale]);
        return (result ?? key) as string;
      },
    }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
