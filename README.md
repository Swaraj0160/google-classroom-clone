# Faculty Classroom & Academic Submission Engine

[![Next.js](https://img.shields.io/badge/Next.js-15.5.22-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase_SSR-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Google Drive API](https://img.shields.io/badge/Storage-Google_Drive_API-4285F4?style=for-the-badge&logo=googledrive)](https://developers.google.com/drive)
[![Chart.js](https://img.shields.io/badge/Analytics-Chart.js-FF6384?style=for-the-badge&logo=chartdotjs)](https://www.chartjs.org/)

An institutional-grade, multi-role academic classroom operating platform inspired by Google Classroom. Engineered with **Next.js 15 (App Router)**, **React 19**, **Supabase SSR**, and **Google Drive API**, this system delivers full-lifecycle assignment distribution, chunked multi-file submissions, rubric-based evaluation, grade analytics, and administrative audit controls.

---

## Architecture & System Overview

```mermaid
flowchart TD
    subgraph Client["Next.js 15 App Router Frontend (React 19)"]
        AdminUI["Admin Control Panel<br/>(User Mgmt & Drive Health)"]
        FacultyUI["Faculty Dashboard<br/>(Streams, Classwork & Gradebook)"]
        StudentUI["Student Portal<br/>(Submissions & Deadlines)"]
    end

    subgraph Middleware["Auth & Session Middleware"]
        AuthGuard["Supabase SSR Auth Guard"]
        RoleCheck["Role-Based Access Control<br/>(Admin / Faculty / Student)"]
    end

    subgraph BackendAPI["Next.js Server Routes (App Router)"]
        DriveAPI["/api/files/*<br/>(Session, Upload, Finalize, Proxy View)"]
        AdminAPI["/api/admin/*<br/>(Drive Health, View-As Session, Users)"]
        OAuthAPI["/api/auth/google/*<br/>(Google OAuth 2.0 Integration)"]
    end

    subgraph CloudServices["Cloud & Persistence Infrastructure"]
        SupaDB[("Supabase PostgreSQL<br/>Users, Classes, Submissions, Grades")]
        GDrive[("Google Drive Storage<br/>Institutional Submission Vault")]
    end

    Client --> Middleware
    Middleware --> BackendAPI
    BackendAPI --> SupaDB
    BackendAPI --> GDrive
```

---

## Core Capabilities

### 1. Role-Based Portals & Dashboards
- **Faculty Dashboard (`/dashboard`):** 
  - Manage course cohorts, syllabi, and multi-threaded class announcement streams.
  - Publish rich assignments with customizable point rubrics, deadlines, and attachment guidance.
  - Review student submissions in real time with inline status badges (`Submitted`, `Late`, `Missing`, `Graded`).
- **Student Experience (`/student`):**
  - Unified course feed with upcoming assignment deadline alerts.
  - Drag-and-drop file submission zone with chunked upload session support.
  - Real-time feedback review, graded status indicators, and returned document inspection.
- **Admin Control Center (`/admin`):**
  - Institutional user account provisioning and role assignments.
  - Google Drive infrastructure health metrics and connection validation (`/api/admin/drive-health`).
  - Secure **"View-As" Impersonation Session** (`/api/admin/view-as`) for faculty audit and student troubleshooting without credential handoff.

### 2. Google Drive Storage Integration
- **Resilient Upload Engine:** Chunked file upload sessions (`/api/files/upload/session` and `/api/files/upload/finalize`) handle large documents reliably.
- **Secure File Proxy:** Submissions are previewed securely through an authorized server proxy (`/api/files/view/[fileId]`), preventing direct bucket exposure.
- **Automated Migration & Verification Tools:** Bundled scripts for file transfer, backfilling, and integrity validation (`npm run migrate:files`, `npm run verify:drive-files`).

### 3. Analytics, Export & Document Parsing
- **Grade Distribution Analytics:** Interactive class performance histograms and submission velocity powered by **Chart.js** and **react-chartjs-2**.
- **Automated Gradebook PDF Export:** Generate clean, printable institutional grade sheets via **jsPDF** and **jspdf-autotable**.
- **In-Browser Document Inspection:** Rich previewing for DOCX academic papers powered by **Mammoth.js**.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 15.5.22 (App Router, Server Actions, Server Components) |
| **Frontend Core** | React 19.0.0, TypeScript 5.7, Tailwind CSS 3.4 |
| **Motion & Icons** | Framer Motion 11.15, Lucide React 0.469 |
| **Database & Auth** | Supabase SSR (`@supabase/ssr` 0.12, `@supabase/supabase-js` 2.111) |
| **Cloud Storage** | Google APIs client library (`googleapis` 174.0) |
| **Reporting & Parsing** | Chart.js 4.4, jsPDF 4.2, jsPDF-AutoTable 5.0, Mammoth 1.12 |
| **Tooling & Build** | PostCSS, Autoprefixer, ESLint 9 |

---

## Project Structure

```text
google-classroom-clone/
├── app/
│   ├── admin/                    # Admin portal: user management & drive diagnostics
│   ├── api/
│   │   ├── admin/                # Admin APIs: drive-health, users, view-as sessions
│   │   ├── auth/google/          # OAuth 2.0 Google callback endpoints
│   │   └── files/                # File sessioning, upload finalize, deletion & proxy view
│   ├── dashboard/                # Faculty course stream, classwork & grading dashboard
│   ├── login/                    # Supabase authentication and login interface
│   ├── student/                  # Student portal: enrolled courses, submissions & deadlines
│   ├── globals.css               # Global Tailwind CSS definitions
│   ├── layout.tsx                # Root layout with role-based navigation headers
│   └── page.tsx                  # Public gateway and portal selector
├── components/
│   ├── admin/                    # User administration and storage health components
│   ├── class/                    # Class header, settings, and enrollment cards
│   ├── classwork/                # Assignment creator, rubric builder, and assignment list
│   ├── dashboard/                # Analytics charts, gradebook overview, course cards
│   ├── stream/                   # Course announcement feeds and discussion threads
│   ├── ui/                       # Buttons, dialogs, inputs, tabs, dropdowns, and cards
│   ├── AssignmentSubmissionOverview.tsx # Real-time cohort grading grid
│   ├── FilePreviewModal.tsx      # Multi-format document inspector modal
│   ├── FileUploadZone.tsx        # Drag-and-drop upload zone with progress indicators
│   ├── StudentSubmissionPanel.tsx# Student assignment attachment and turn-in control
│   └── UpcomingAssignments.tsx   # Deadline widget with countdown alerts
├── hooks/                        # Custom React hooks (auth, drive status, local state)
├── lib/                          # Supabase client helpers, Drive utilities, formatters
├── scripts/
│   ├── sql/                      # PostgreSQL schema migrations and RLS policies
│   ├── auto-grade-backfill.ts    # Script to backfill automated grades
│   ├── migrate-files-to-drive.ts # Migration utility from local/blob to Google Drive
│   ├── migrate-files-cleanup.ts  # Cleanup script for migrated records
│   └── verify-drive-files.ts     # Health and checksum verification for Drive files
├── types/                        # TypeScript domain schemas (User, Class, Assignment, Submission)
├── middleware.ts                 # Next.js edge route protection and role redirection
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies and build scripts
├── tailwind.config.ts            # Design system color tokens and typography
└── tsconfig.json                 # TypeScript compiler configuration
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v18.18+` or `v20+`
- **npm** or **pnpm**
- **Supabase Account**: A PostgreSQL project with Supabase Auth enabled.
- **Google Cloud Console Project**: Service account or OAuth 2.0 client credentials with Google Drive API enabled.

### 1. Clone the Repository
```bash
git clone https://github.com/Swaraj0160/google-classroom-clone.git
cd google-classroom-clone
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Drive Storage Integration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_DRIVE_FOLDER_ID=your-institutional-vault-folder-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-key\n-----END PRIVATE KEY-----"

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Database Setup
Apply the database schemas and Row Level Security (RLS) policies located in `scripts/sql/` to your Supabase project using the SQL Editor.

### 5. Run Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

### 6. Production Build
```bash
npm run build
npm run start
```

---

## Administrative & Maintenance CLI Scripts

The project includes utility scripts for institutional maintenance:

```bash
# Verify integrity of files stored in Google Drive
npm run verify:drive-files

# Migrate legacy attachments to Google Drive
npm run migrate:files

# Clean up temporary staging tables post-migration
npm run migrate:files:cleanup

# Backfill automated evaluation points
npm run grade:backfill
```

---

## Security & Verification

- **Row Level Security (RLS):** All student submissions and grades are partitioned strictly by user ID and class enrollment via Supabase RLS policies.
- **Google Drive Isolation:** Document uploads are organized into dedicated institutional folder trees; direct public file sharing is disabled.
- **Input Sanitization:** File uploads validate MIME types and file extensions prior to session initialization.

---

## Author & Acknowledgments

- **Lead Engineer:** **Swaraj Ingale** ([@Swaraj0160](https://github.com/Swaraj0160))
- Built with inspiration from Google Classroom, leveraging open-source Next.js, Supabase, and Google APIs.
