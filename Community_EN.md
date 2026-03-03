# Community.md — ScienceExperts.ai Community Platform

> **Last Updated:** February 2026
> **Live URL:** [https://www.scienceexperts.ai](https://www.scienceexperts.ai)
> **Repository:** [https://github.com/Chriss54/CommunityDesign](https://github.com/Chriss54/CommunityDesign)

---

## 1. What is ScienceExperts.ai?

ScienceExperts.ai is a **self-hosted community platform** for scientists, researchers, and experts in the life sciences domain. The platform is a feature-complete **clone of the Skool model** (Community + Classroom + Gamification), but entirely self-developed and under full control — with no dependency on third-party platforms.

### Core Mission

The platform connects a **global scientific community** with an **integrated Learning Management System (LMS)**, an **event calendar**, a **gamification system**, and **AI-powered tools**. The central unique selling point is **full multilingual support**: every user sees the community automatically in their language — both the UI and the content (posts, comments, courses) are translated in real time.

---

## 2. Technology Stack

| Category | Technology | Version |
|:---|:---|:---|
| **Framework** | Next.js (App Router, Turbopack) | 16.1.4 |
| **Frontend** | React | 19.2.3 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Database** | PostgreSQL (via Supabase) | — |
| **ORM** | Prisma (custom output) | 7.3.0 |
| **Authentication** | NextAuth.js (JWT, Credentials Provider) | 4.24.x |
| **File Storage** | Supabase Storage (Buckets + RLS) | — |
| **Payments** | Stripe (Subscriptions + Checkout) | 20.3.x |
| **Rich Text Editor** | Tiptap (ProseMirror-based) | 3.17.x |
| **Translation** | DeepL API v2 | — |
| **Email** | Resend | 6.8.x |
| **Hosting** | Vercel (Serverless) | — |
| **UI Components** | Radix UI, shadcn/ui Patterns | — |
| **Drag & Drop** | dnd-kit | 6.3.x |
| **Form Validation** | Zod + React Hook Form | 4.3.x / 7.71.x |
| **Theming** | next-themes (Light/Dark Mode) | 0.4.6 |

---

## 3. Architecture Overview

### 3.1 Directory Structure

```
CD/
├── prisma/
│   └── schema.prisma          # 590 lines, 25+ models
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login, Register, Forgot Password
│   │   ├── (main)/             # Authenticated Area
│   │   │   ├── feed/           # Community Feed (Main Page)
│   │   │   ├── classroom/      # LMS Course Area
│   │   │   ├── calendar/       # Event Calendar
│   │   │   ├── events/         # Event Details
│   │   │   ├── members/        # Member Directory
│   │   │   ├── leaderboard/    # Gamification Leaderboard
│   │   │   ├── ai-tools/       # AI Tool Overview
│   │   │   ├── admin/          # Admin Dashboard (23 Subpages)
│   │   │   ├── search/         # Global Search
│   │   │   ├── onboarding/     # New User Onboarding
│   │   │   └── profile/        # User Profile
│   │   ├── api/                # API Routes (Auth, Webhooks, etc.)
│   │   ├── page.tsx            # Landing Page (Public)
│   │   └── layout.tsx          # Root Layout
│   ├── components/             # 118+ Components
│   ├── lib/
│   │   ├── i18n/               # Internationalization (UI Strings)
│   │   │   ├── messages/       # en.ts, de.ts, es.ts, fr.ts
│   │   │   └── geolocation.ts  # IP → Language Mapping
│   │   ├── translation/        # Content Translation (DeepL)
│   │   │   ├── index.ts        # Core Translation API
│   │   │   ├── cache.ts        # DB-based Translation Cache
│   │   │   ├── detect.ts       # Language Detection
│   │   │   ├── providers/      # DeepL Provider
│   │   │   └── constants.ts    # 10 Supported Languages
│   │   ├── auth.ts             # NextAuth Configuration
│   │   ├── db.ts               # Prisma Client Singleton
│   │   ├── permissions.ts      # RBAC (4 Roles)
│   │   ├── *-actions.ts        # Server Actions (20+ Files)
│   │   └── validations/        # Zod Schemas
│   └── types/                  # TypeScript Type Definitions
├── public/                     # Static Assets
├── scripts/                    # Admin/Maintenance Scripts
└── supabase/                   # Supabase Configuration
```

### 3.2 Server Actions Architecture

The entire backend logic is implemented as **Next.js Server Actions** (`'use server'`). There is no dedicated backend; all database operations run through Server Actions that are called directly from React components.

Key Server Action files:

| File | Responsibility |
|:---|:---|
| `auth-actions.ts` | Registration, Login Helper Functions |
| `post-actions.ts` | CRUD for Community Posts |
| `comment-actions.ts` | Comment Creation and Deletion |
| `like-actions.ts` | Like/Unlike for Posts and Comments |
| `course-actions.ts` | Course Management (CRUD) |
| `lesson-actions.ts` | Lesson Management with Tiptap Content |
| `module-actions.ts` | Course Module Management (Sorting) |
| `enrollment-actions.ts` | Course Enrollments |
| `progress-actions.ts` | Lesson Progress (Mark as Done) |
| `event-actions.ts` | Calendar Events (CRUD with Timezone) |
| `settings-actions.ts` | Community Settings, Logo Upload, Landing Page |
| `admin-actions.ts` | User Management, Bans, Roles |
| `search-actions.ts` | Full-Text Search (PostgreSQL tsvector) |
| `gamification-actions.ts` | Points Assignment and Level System |
| `leaderboard-actions.ts` | Leaderboard Queries |
| `profile-actions.ts` | User Profile Updates |
| `media-actions.ts` | Media Upload (Supabase Storage) |
| `category-actions.ts` | Feed Categories (CRUD) |
| `kanban-actions.ts` | Admin Kanban Board |
| `feature-idea-actions.ts` | Feature Ideas Board with Upvotes |
| `ai-tool-actions.ts` | AI Tool Management |

---

## 4. Data Model (Prisma Schema)

The complete schema comprises **25+ models**. Here are the most important entities:

### 4.1 Core Models

```
User
├── id, email, name, image, bio
├── hashedPassword (bcrypt)
├── points (Int, default 0)
├── level (Int, default 1)
├── role: "member" | "moderator" | "admin" | "owner"
├── languageCode: String (default "en") — Preferred Language
├── stripeCustomerId: String? — Stripe Integration
└── searchVector: tsvector (Full-Text Search)

Post
├── id, title?, content (Tiptap JSON), plainText (Search)
├── embeds (JSON Array: Video Embeds)
├── authorId → User
├── categoryId → Category
├── languageCode: String? — Detected Language of the Post
├── contentHash: String? — SHA-256 for Cache Invalidation
└── searchVector: tsvector

Comment
├── id, content (VarChar 2000)
├── authorId → User, postId → Post
├── languageCode, contentHash
└── PostLike / CommentLike (unique [userId, entityId])

Category
├── id, name (unique), color (hex)
└── posts: Post[]
```

### 4.2 LMS Models (Classroom)

```
Course
├── id, title, description, coverImage (Supabase URL)
├── status: DRAFT | PUBLISHED
├── modules: Module[]
├── enrollments: Enrollment[]
└── searchVector: tsvector

Module
├── id, title, position (Order)
├── courseId → Course
└── lessons: Lesson[]

Lesson
├── id, title, position, status: DRAFT | PUBLISHED
├── videoUrl? (Video Embed at top)
├── content (Tiptap JSON)
├── attachments: Attachment[]
└── progress: LessonProgress[]

Enrollment: unique [userId, courseId]
LessonProgress: unique [userId, lessonId] + completedAt
Attachment: name, url (Supabase), size, mimeType
```

### 4.3 Events & Calendar

```
Event
├── id, title, description (Tiptap JSON)
├── startTime, endTime (Timestamptz)
├── location?, locationUrl?
├── coverImage? (Supabase)
├── recurrence: NONE | WEEKLY | MONTHLY
├── recurrenceEnd?
└── createdById → User
```

### 4.4 Gamification

```
PointsEvent
├── userId → User
├── amount: Int
├── action: "POST_CREATED" (+5) | "COMMENT_CREATED" (+3) | "LIKE_RECEIVED" (+1) | "LESSON_COMPLETED"
└── createdAt

Level System: 9 tiers (Rookie → Legend), based on total points
```

### 4.5 Moderation & Admin

```
Ban
├── userId → User, reason, expiresAt? (null = permanent)
└── bannedById → User

AuditLog
├── userId → User
├── action: "BAN_USER" | "UNBAN_USER" | "DELETE_POST" | "CHANGE_ROLE" | ...
├── targetId?, targetType?: "USER" | "POST" | "COMMENT"
└── details: Json? (old value, new value, reason)
```

### 4.6 Community Configuration

```
CommunitySettings (Singleton Model, id = "singleton")
├── communityName, communityDescription
├── communityLogo, communityLogoDark (Light/Dark Mode Logos)
├── logoSize: Int (20-80px)
├── welcomeMessage
├── registrationOpen, postingEnabled, commentsEnabled (Booleans)
│
├── Landing Page Fields:
│   ├── landingHeadline, landingSubheadline, landingDescription
│   ├── landingVideoUrls: Json[] (YouTube/Vimeo/Loom)
│   ├── landingBenefits: Json[] (Benefits List)
│   ├── landingPriceUsd, landingPriceEur
│   ├── landingCtaText (CTA Button Text)
│   ├── landingTestimonials: Json[] ({name, text, role})
│   └── landingTranslations: Json (per language: {headline, subheadline, ...})
│
├── Sidebar Banner:
│   ├── sidebarBannerImage, sidebarBannerUrl
│   └── sidebarBannerEnabled
```

### 4.7 Payments

```
Membership
├── userId → User (unique)
├── status: ACTIVE | EXPIRED | CANCELLED
├── planName, paidAt, expiresAt?
└── stripeCustomerId, stripeSubscriptionId, stripePriceId
```

### 4.8 Translation Cache

```
Translation
├── entityType: "Post" | "Comment" | "Course" | "Lesson" | "Event"
├── entityId, fieldName: "plainText" | "title" | "content" | "description"
├── sourceLanguage, sourceHash (SHA-256)
├── targetLanguage, translatedContent
├── modelProvider: "deepl", modelVersion: "v2"
├── confidenceScore?
└── unique [entityType, entityId, fieldName, targetLanguage]
```

### 4.9 Admin Tools

```
KanbanCard: Admin Kanban Board (TODO → IN_PROGRESS → DONE)
DevTrackerCard: Git Branch Tracking for Development
DevTrackerResource: Shared Prompts, Links, Notes, Files
LaunchChecklistItem: Go-Live Checklist (auto + manual)
AiTool: Admin-managed AI Tool Links (Name, URL, Description)
FeatureIdea: Feature Ideas Board with Upvotes and Comments
```

---

## 5. Multilingual Support — The Heart of the Platform

The platform has **two separate multilingual systems** that work together:

### 5.1 UI Localization (Static Strings)

**Technology:** `next-intl` + custom message files

**Supported UI Languages (Static Messages):**
- 🇬🇧 English (`en.ts`) — Primary Language
- 🇩🇪 German (`de.ts`)
- 🇪🇸 Spanish (`es.ts`)
- 🇫🇷 French (`fr.ts`)

The UI strings (buttons, labels, navigation text, error messages) are maintained in these 4 languages.

### 5.2 Content Translation (Dynamic Content)

**Technology:** DeepL API v2 + PostgreSQL Cache (`Translation` table)

**Supported Content Languages (10 Languages):**

| Code | Language | Direction |
|:---|:---|:---|
| `en` | English | LTR |
| `de` | Deutsch | LTR |
| `es` | Español | LTR |
| `fr` | Français | LTR |
| `ja` | 日本語 | LTR |
| `pt` | Português | LTR |
| `zh` | 中文 | LTR |
| `ko` | 한국어 | LTR |
| `ar` | العربية | **RTL** |
| `it` | Italiano | LTR |

**How It Works:**
1. A user creates a post in German.
2. The language is automatically detected and stored as `languageCode`.
3. A French user opens the feed → the Translation API is called.
4. **Cache Check:** Does a translation exist for this post + field + target language with the current `sourceHash`?
   - **Yes:** The cached translation is returned immediately.
   - **No:** DeepL is called, the translation is saved and delivered.
5. On **content change**, the SHA-256 hash changes → cache invalidation → re-translation.

**Translated Entities:**
- Posts (Title + Body Text)
- Comments
- Courses (Title + Description)
- Lessons (Title + Content)
- Events (Title + Description)
- Landing Page (Headline, Subheadline, Description, Benefits, CTA)

### 5.3 Automatic Language Detection (IP Geolocation)

**Mechanism:** Three-tier fallback

```
1. Vercel Edge Header → x-vercel-ip-country (e.g. "DE")
2. Browser Header → Accept-Language (e.g. "de-DE,de;q=0.9,en;q=0.8")
3. Fallback → English ("en")
```

**Country-to-Language Mapping (Excerpt):**
- 🇩🇪🇦🇹🇨🇭🇱🇮 → `de` (German)
- 🇪🇸🇲🇽🇦🇷🇨🇴🇵🇪 + 14 more → `es` (Spanish)
- 🇫🇷🇧🇪🇱🇺🇲🇨🇸🇳 + 10 more → `fr` (French)
- 🇯🇵 → `ja`, 🇰🇷 → `ko`, 🇨🇳🇹🇼🇭🇰 → `zh`, 🇸🇦🇦🇪🇪🇬 + 10 → `ar`
- 🇺🇸🇬🇧🇨🇦🇦🇺 + 8 more → `en` (English, Default)

**Cookie Persistence:** `preferred-language` cookie for manual language selection.

**Currency Detection:** European countries (EU + EEA + CH) see EUR prices, rest sees USD.

### 5.4 Landing Page Translations

The Landing Page has a **hybrid translation system:**
- **Base content** is maintained in English (in `CommunitySettings`).
- **Per language**, translations can be stored in `landingTranslations` (JSON).
- **Auto-Translate:** An admin function calls DeepL to translate the EN content into the target language. The admin can review and adjust the result before saving.

---

## 6. Authentication & Authorization

### 6.1 Auth System

- **Provider:** NextAuth.js with JWT strategy
- **Method:** Credentials Provider (Email + Password)
- **Password Hashing:** bcrypt
- **Session:** JWT-based, valid for 30 days
- **Adapter:** Prisma Adapter for user persistence

### 6.2 RBAC (Role-Based Access Control)

4 roles with hierarchical permissions:

| Role | Permissions |
|:---|:---|
| `member` | Create posts, comment, like, enroll in courses |
| `moderator` | + Delete others' posts/comments |
| `admin` | + User management, change roles, community settings, course CRUD, event CRUD, Kanban |
| `owner` | + Full access, appoint admins |

**Membership Gate:** In addition to the role, the membership status (`Membership.status === 'ACTIVE'`) is stored in the JWT session. Features can optionally be gated behind an active membership.

### 6.3 Password Reset

Token-based reset flow via email (Resend):
1. User enters email → token generated with expiration time
2. Email with reset link sent via Resend API
3. Token validation → set new password

---

## 7. Feature Catalog

### 7.1 Community Feed

- **Main View:** 3-column layout (Categories | Feed | Leaderboard/Members)
- **Post Creation:** Tiptap Rich Text Editor with placeholder UX
- **Media:** YouTube, Vimeo, Loom embeds (automatic detection via `EmbedRenderer`)
- **Categories:** 4 default categories (General, Announcements, Introductions, Questions) with color codes
- **Interaction:** Likes (+1 point), nested comments, three-dot menu (Edit/Delete)
- **Moderation:** Delete API enforces permissions (Author / Owner / Admin)
- **Pagination:** Offset-based, 10 posts per page
- **Streaming:** `<Suspense>` with skeleton fallback for perceived performance

### 7.2 Classroom (LMS)

- **Course Structure:** Course → Module → Lesson (hierarchical, sortable via dnd-kit)
- **Course Page:** Grid layout with cover images (Supabase Storage)
- **Course Status:** DRAFT / PUBLISHED
- **Lessons:** Tiptap content + optional video embed + file attachments
- **Progress:** "Mark as Done" per lesson, progress bar per course
- **Enrollment:** Explicit enroll button, tracked in `Enrollment` table

### 7.3 Events & Calendar

- **Event Creation:** Title, Tiptap description, start/end time (timezone-aware)
- **Timezones:** `@date-fns/tz` for correct display
- **Recurrence:** NONE / WEEKLY / MONTHLY with optional end date
- **Location:** Optional location + URL (for Zoom/Meet links)
- **Cover Images:** Upload via Supabase Storage

### 7.4 Member Directory

- **Grid Layout:** Responsive member cards with avatar, name, level badge
- **Searchable:** Full-text search via `searchVector` (PostgreSQL GIN index)
- **Role Badges:** Visual distinction (Admin, Mod, Member)
- **Leveling:** 9-tier system displayed next to the name

### 7.5 Leaderboard & Gamification

**Points System:**
| Action | Points |
|:---|:---|
| Create post | +5 |
| Write comment | +3 |
| Receive like | +1 |
| Complete lesson | variable |

**9-Level System:** Rookie → Intermediate → Advanced → Expert → Master → … → Legend

**Leaderboard:** Podium spots for top members, sorted by total points.

### 7.6 Global Search

- **PostgreSQL Full-Text Search** via `tsvector` + GIN indexes
- **Searchable Entities:** Users (Name + Bio), Posts (plainText), Courses (Title + Description)
- **UI:** Capsule-shaped search bar in the header, activatable via ⌘K

### 7.7 AI Tools

- Admin-managed list of AI tool links (Name, URL, Description)
- Sidebar integration and dedicated overview page
- Each tool can be opened in a new tab

### 7.8 Admin Dashboard

The Admin Dashboard comprises **23+ subpages**:

- **Member Management:** Member table with role changes, ban/unban, search
- **Community Settings:** Name, description, logo (Light + Dark), logo size
- **Landing Page Editor:** Headline, subheadline, benefits, videos, prices (USD/EUR), testimonials, translations
- **Sidebar Banner:** Upload, click URL, enable/disable
- **Course Management:** CRUD with cover image upload
- **Event Management:** CRUD with timezones
- **Category Management:** CRUD with color picker
- **Kanban Board:** Drag & drop task management (TODO → IN_PROGRESS → DONE)
- **Dev Tracker:** Git branch tracking, resource management (prompts, links, files)
- **Feature Ideas Board:** Submit ideas, upvote, comment, status management
- **Launch Checklist:** Go-live checklist with auto-check and blocker marking
- **Audit Log:** Complete logging of all admin actions

### 7.9 Landing Page (Public)

- Fully configurable via the Admin Dashboard
- **Adaptive Price Display:** EUR for European visitors, USD for the rest
- **Multilingual:** Content is automatically displayed in the appropriate language based on IP/language
- Video embeds, benefits list, testimonials
- CTA button with configurable text

---

## 8. Design System

### 8.1 Visual Identity

- **Design Language:** Minimalist, clinical, Skool-inspired
- **Color Palette:** Monochrome black/white/gray scheme
  - Background: `#f8f9fa`, Foreground: `#1f2937`, Cards: `#ffffff`
- **Typography:** Inter (Sans-serif), Medium (500) + Bold (700)
- **Dark Mode:** Fully implemented via `next-themes`, separate logos for Light/Dark

### 8.2 Component Patterns

- **Cards:** `.skool-card` — White bg, 1px border, 12px radius, subtle shadow
- **Buttons:** Pill-shaped (`rounded-full`), Primary (black), Secondary (gray), Ghost
- **Navigation:** Horizontal tabs with monochrome SVG icons (Lucide/Heroicons)
- **Sticky Header:** Logo + Search remain fixed, sub-nav hides on scroll
- **3-Column Layout:** `w-64 | flex-1 | w-72` with vertical alignment ("Flush")

### 8.3 Responsiveness

- **Desktop (1024px+):** Full 3-column layout with both sidebars
- **Mobile (<1024px):** Sidebars hidden, full-width feed, hamburger menu
- **Mathematical Centering:** Fixed-width wings + `flex-1` for exact centering on mobile

---

## 9. Infrastructure & Deployment

### 9.1 Supabase

- **Database:** PostgreSQL (Connection via `@prisma/adapter-pg`)
- **Storage:** Buckets with Row-Level Security (RLS)
  - `community-logos` — Community logo uploads
  - `course-images` — Course cover images
  - `attachments` — Lesson attachments
  - `event-images` — Event covers
  - `sidebar-banners` — Sidebar banner images
- **Bucket Provisioning:** Admin scripts for automatic setup

### 9.2 Vercel

- **Serverless Deployment** with automatic build pipeline
- **Edge Functions:** Geolocation header (`x-vercel-ip-country`) for language detection
- **Read-Only Filesystem:** All uploads go through Supabase Storage (no local FS)

### 9.3 Stripe

- **Subscription Model:** Community membership as recurring subscription
- **Checkout:** Stripe Checkout Session for payment processing
- **Webhook Handling:** For subscription status updates
- **Dual Pricing:** USD + EUR prices configurable

---

## 10. Performance & Scaling

- **Parallel DB Queries:** `Promise.all` for posts, count, categories in the feed
- **N+1 Prevention:** Prisma `include` / `select` for efficient relations
- **Offset Pagination:** 10 posts/page, lightweight DOM
- **Streaming:** Next.js `<Suspense>` with skeleton fallbacks
- **Image Optimization:** `next/image` with CDN optimization
- **Code Splitting:** Client logic isolated in individual components
- **Database Indexes:** GIN indexes on `searchVector`, composite indexes on frequently filtered fields
- **Translation Cache:** DB-based with SHA-256 hash invalidation (no redundant DeepL calls)

---

## 11. Key Configuration Files

| File | Purpose |
|:---|:---|
| `prisma/schema.prisma` | Complete data model (590 lines) |
| `src/lib/auth.ts` | NextAuth + JWT + Session configuration |
| `src/lib/permissions.ts` | RBAC logic and role hierarchy |
| `src/lib/db.ts` | Prisma Client Singleton |
| `src/lib/i18n/index.ts` | i18n configuration (next-intl) |
| `src/lib/i18n/geolocation.ts` | IP → Language mapping (60+ countries) |
| `src/lib/translation/index.ts` | DeepL Translation API + cache logic |
| `src/lib/translation/constants.ts` | 10 supported content languages |
| `src/lib/settings-actions.ts` | Community Settings Server Actions (756 lines) |
| `src/middleware.ts` | Auth middleware (next-auth) |
| `next.config.ts` | Remote patterns (YouTube thumbnails), etc. |
| `.env` | Environment variables (DB, Supabase, Stripe, DeepL, Resend) |

---

## 12. Environment Variables

```env
# Database
DATABASE_URL=           # Supabase PostgreSQL Connection String
DIRECT_URL=             # Direct DB Access (for Prisma Migrations)

# Auth
NEXTAUTH_SECRET=        # JWT Signing Secret
NEXTAUTH_URL=           # Base URL of the Application

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# DeepL (Translation)
DEEPL_API_KEY=

# Email
RESEND_API_KEY=
```

---

## 13. Future Features (Roadmap Excerpt)

Based on market research (170+ Skool feature requests analyzed):

- **Post Scheduling:** Schedule posts for the future
- **Tiered Category Access:** Categories only for paying members
- **DM System:** Direct messages with reactions and threading
- **Bookmarks:** Save posts for later
- **Advanced Analytics:** Post impressions, course drop-off heatmaps
- **Native Video Recording:** Loom-style recording tool
- **Affiliate System:** Invitation tracking with commissions
- **Content Dripping:** Time-gated course unlocking
- **Maps:** Leaflet-based member map
- **Sandbox Mode:** "View as Member" for admins

---

## 14. Summary for AI Context

> **ScienceExperts.ai** is a community platform built with Next.js 16 (Skool clone) featuring:
>
> - **Full-Stack TypeScript** — React 19 frontend, Server Actions backend, Prisma 7 ORM
> - **25+ Database Models** — Users, Posts, Comments, Courses, Modules, Lessons, Events, Translations, etc.
> - **True Multilingual Support** — UI in 4 languages (next-intl), content in 10 languages (DeepL + DB cache)
> - **IP-based Language Detection** — Automatic language selection based on location
> - **Gamification** — Points, levels, leaderboard
> - **LMS** — Course manager with modules, lessons, progress, attachments
> - **Stripe Payments** — Membership subscriptions with EUR/USD dual pricing
> - **Admin Dashboard** — 23+ pages: user management, content, Kanban, dev tracker, ideas board
> - **Supabase Storage** — Cloud-based file storage with RLS
> - **Vercel Deployment** — Serverless with edge geolocation
> - **Dark/Light Mode** — Full theming with separate logos
> - **Responsive Design** — 3-column desktop, mobile-optimized
