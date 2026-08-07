# Faculty Classroom Dashboard

A premium, Google Classroom–inspired faculty dashboard built with **Next.js 15 (App Router)**, **TypeScript**, and **TailwindCSS** — no UI libraries, no backend.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the login page.

- **Login** (`/login`) → click "Sign in with Google" to enter the dashboard
- **Dashboard** (`/dashboard`) → stats, activity, quick actions, performance chart, recent classes
- **Class detail** (`/dashboard/classes/[id]`) → Stream / Classwork / People / Marks / AI Insights tabs
- Sidebar also links to Classes, Assignments, Submissions, Students, Analytics, AI Insights, Settings

## Stack

- Next.js 15 App Router + TypeScript
- TailwindCSS (custom design tokens, no component library)
- lucide-react icons
- Chart.js via react-chartjs-2 (line, bar, doughnut, radar)
- Framer Motion (login page animations)

## Structure

```
app/
  login/page.tsx              Login screen
  dashboard/                  Dashboard shell + all sidebar pages
    layout.tsx                 Wraps pages with sidebar + top bar
    page.tsx                   Main dashboard
    classes/page.tsx            Classes grid
    classes/[id]/page.tsx        Class detail (tabs)
    assignments|submissions|students|analytics|ai-insights|settings/page.tsx
components/
  layout/                     Sidebar, TopBar, DashboardShell
  dashboard/                  StatCard, RecentActivity, QuickActions, PerformanceChart, ClassCard
  class/                      ClassHeader, StreamTab, ClassworkTab, PeopleTab, MarksTab, AIInsightsTab
  login/                      AuroraPanel, LoginCard
lib/
  data.ts                     Mock data (faculty, classes, students, assignments, activity...)
  types.ts                    Shared TypeScript interfaces
  chartSetup.ts                Chart.js registration
```

All data is mocked in `lib/data.ts` — no backend calls are made. Swap in real API calls there when ready.
