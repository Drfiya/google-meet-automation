# Prompt: Meeting Calendar + Scoreboard for Co-Founder Coordination

Copy everything below this line and paste it into Claude 4.6 Opus in Antigravity.

---

## Context

This is **MeetScript** — a meeting transcript pipeline dashboard built with **Next.js 14 App Router** (Turborepo monorepo) for **3rd AI LLC**. Two co-founders, **Lutfiya** (she/her) and **Chris**, live in **different countries** and interact **purely virtually** to build and coordinate events for **scienceexperts.ai**. All their Google Meet transcripts are automatically ingested, chunked, embedded, and stored in **Supabase** (PostgreSQL + pgvector).

The project structure:

```
apps/web/          — Next.js 14 frontend (App Router)
apps/worker/       — Express.js on Cloud Run (email ingestion)
packages/shared/   — TypeScript interfaces
supabase/          — Migrations
```

### Design System

The app uses a **glassmorphism** design system with CSS variables for light/dark themes. Key classes:

- `glass-card` — frosted glass container with backdrop blur, rounded-2xl, border, hover effects
- `stat-card` — glass-card variant with gradient accent stripe
- `input-glow` — inputs with focus ring and brand-500 glow
- `badge-info`, `badge-success`, `badge-error`, `badge-warning` — colored pill badges
- `table-row` — hover-highlighted row
- Brand colors: `brand-400`/`brand-500`/`brand-600`, `accent-teal`, `accent-violet`
- Text tokens: `text-theme-text-primary`, `text-theme-text-secondary`, `text-theme-text-tertiary`, `text-theme-text-muted`
- Background tokens: `bg-theme-raised`, `bg-theme-overlay`, `bg-theme-muted`
- Border token: `border-theme-border/[0.06]`
- Animations: `animate-fade-in`, `animate-slide-up`

### Existing Database Schema

**`transcripts`** table:
```sql
id TEXT PRIMARY KEY,               -- Format: YYYY-MM-DD_meeting-title-slug
meeting_title TEXT NOT NULL,
meeting_date TIMESTAMPTZ NOT NULL,
participants TEXT[],
raw_transcript TEXT NOT NULL,
source_email_id TEXT UNIQUE NOT NULL,
extraction_method TEXT,            -- 'inline' | 'google_doc' | 'attachment' | 'upload'
word_count INTEGER,
processed_at TIMESTAMPTZ DEFAULT NOW()
```

**`action_items`** table:
```sql
id TEXT PRIMARY KEY,
transcript_id TEXT REFERENCES transcripts(id),
title TEXT NOT NULL,
description TEXT,
assigned_to TEXT,                   -- 'Lutfiya', 'Chris', or NULL
status TEXT DEFAULT 'open',        -- 'open' | 'in_progress' | 'done' | 'dismissed'
priority TEXT DEFAULT 'medium',
due_date DATE,
source_text TEXT,
created_by TEXT DEFAULT 'ai',
created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now(),
completed_at TIMESTAMPTZ,
group_label TEXT
```

**`activity_log`** table:
```sql
id TEXT PRIMARY KEY,
event_type TEXT NOT NULL,
entity_type TEXT, entity_id TEXT,
actor TEXT,
summary TEXT NOT NULL,
metadata JSONB DEFAULT '{}',
created_at TIMESTAMPTZ DEFAULT now()
```

### Existing TypeScript Interfaces (in `packages/shared/src/types.ts`)

```ts
export interface MeetingTranscript {
    transcript_id: string;
    meeting_title: string;
    meeting_date: string;       // ISO 8601
    participants: string[];
    raw_transcript: string;
    source_email_id: string;
    extraction_method: ExtractionMethod;
    word_count: number;
    processed_at: string;
}

export interface ActionItem {
    id: string;
    transcript_id: string | null;
    title: string;
    description: string | null;
    assigned_to: string | null;
    status: ActionItemStatus;
    priority: ActionItemPriority;
    due_date: string | null;
    source_text: string | null;
    created_by: ActionItemCreatedBy;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    group_label: string | null;
}

export interface ActivityLogEntry {
    id: string;
    event_type: string;
    entity_type: string | null;
    entity_id: string | null;
    actor: string;
    summary: string;
    metadata: Record<string, unknown>;
    created_at: string;
}
```

### Sidebar Navigation (in `apps/web/components/sidebar.tsx`)

```ts
const NAV_ITEMS = [
    { href: '/', label: 'Dashboard', icon: '◆' },
    { href: '/transcripts', label: 'Transcripts', icon: '◇' },
    { href: '/action-items', label: 'Action Items', icon: '☑' },
    { href: '/ask', label: 'Ask AI', icon: '◈' },
    { href: '/logs', label: 'Logs', icon: '◉' },
] as const;
```

### Existing Dashboard (in `apps/web/app/page.tsx`)

The current dashboard has: query bar (Ask AI), 3 stat cards (Total Transcripts, This Week, This Month), Open Action Items Summary, Most Frequent Participants, Recent Transcripts list, Recent Activity feed.

### Existing API routes:

- `GET /api/transcripts` — returns `MeetingTranscript[]`
- `GET /api/action-items` — returns `ActionItem[]`
- `GET /api/activity?limit=N` — returns `ActivityLogEntry[]`
- `POST /api/query` — RAG query endpoint

### Key Constraint

- The app has **no external calendar API integrations** (no Google Calendar). All meeting data comes from transcript records already in Supabase.
- The web app uses `react 18.3`, `next 14.2`, `tailwindcss 3.4`.
- **Install `date-fns`** (v4.x) as the sole new dependency. It's a lightweight, tree-shakeable date utility library. Run `npm install date-fns` in the `apps/web/` directory. Do NOT install any other packages — no `react-calendar`, `moment`, `dayjs`, `luxon`, etc. Build the calendar UI from scratch using React + Tailwind + `date-fns` for all date math and formatting.

---

## Goal

Build a **Calendar** page and a **Scoreboard** section that gives Lutfiya and Chris a bird's-eye view of their meeting rhythm, collaboration patterns, and productivity metrics. This should be purpose-built for two co-founders who live in different countries and interact purely virtually.

---

## Step 1: Add New Shared Types

**File:** `packages/shared/src/types.ts`

Add these interfaces at the end of the file (do NOT modify existing interfaces):

```ts
// ── Calendar & Scoreboard ────────────────────────

/** Aggregated stats for a single calendar day. */
export interface DayMeetingSummary {
    date: string;                  // YYYY-MM-DD
    meetings: {
        transcript_id: string;
        title: string;
        participants: string[];
        word_count: number;
        extraction_method: string;
    }[];
    totalMeetings: number;
    totalWords: number;
    uniqueParticipants: string[];
}

/** Monthly/weekly aggregated scoreboard metrics. */
export interface ScoreboardMetrics {
    period: string;                // e.g. "2025-01" or "2025-W03"
    totalMeetings: number;
    totalHours: number;            // estimated from word count (avg ~150 wpm speech)
    totalActionItems: number;
    completedActionItems: number;
    topicsDiscussed: string[];     // unique group_labels from action items
    meetingsByParticipant: Record<string, number>;
    busiestDay: string;            // day of week
    averageMeetingsPerWeek: number;
    actionItemCompletionRate: number; // 0-100
    streakDays: number;            // consecutive days with at least 1 meeting
}
```

## Step 2: Install `date-fns`

Run this in the `apps/web/` directory:

```bash
npm install date-fns
```

This adds `date-fns` v4.x (~7 KB gzipped after tree-shaking). It provides clean, composable functions for all the date math the calendar needs. Key functions you will use throughout:

```ts
import {
    format,                // format(date, 'MMMM yyyy') → "January 2026"
    startOfMonth,          // first day of the month
    endOfMonth,            // last day of the month
    startOfWeek,           // Monday of that week (use { weekStartsOn: 1 })
    endOfWeek,             // Sunday of that week
    eachDayOfInterval,     // array of every day between two dates
    isSameMonth,           // is this day in the displayed month?
    isSameDay,             // is this day "today"?
    isToday,               // shortcut for isSameDay(day, new Date())
    isWeekend,             // Saturday or Sunday?
    addMonths,             // navigate forward
    subMonths,             // navigate backward
    getDay,                // 0=Sun, 1=Mon, ..., 6=Sat
    differenceInCalendarWeeks, // weeks between two dates
    parseISO,              // parse "2026-01-14T..." into Date
    formatISO,             // Date → ISO string
    getWeeksInMonth,       // how many week rows the grid needs
} from 'date-fns';
```

Import ONLY the functions you need — `date-fns` is fully tree-shakeable so unused functions don't increase bundle size.

## Step 3: Create Calendar API Route

**File:** `apps/web/app/api/calendar/route.ts` (NEW)

Create a `GET` endpoint that accepts optional `month` and `year` query params (default to current month/year). Use `date-fns` for date math on the server side too. It should:

1. Query Supabase `transcripts` table for all transcripts within that month
2. Query Supabase `action_items` table for items created in that month
3. Group transcripts by date (YYYY-MM-DD) — use `format(parseISO(meeting_date), 'yyyy-MM-dd')` to normalize
4. For each day, build a `DayMeetingSummary` with: list of meetings, total count, total words, unique participants
5. Calculate `ScoreboardMetrics` for the month:
   - **totalHours**: Estimate from total word count across all transcripts (assume 150 words per minute of meeting time, i.e., `totalWords / 150 / 60`)
   - **topicsDiscussed**: Collect unique `group_label` values from action items (exclude null)
   - **meetingsByParticipant**: Count how many meetings each participant attended
   - **busiestDay**: Use `format(parseISO(meeting_date), 'EEEE')` to get day names, then count which has the most meetings
   - **averageMeetingsPerWeek**: `totalMeetings / getWeeksInMonth(monthDate, { weekStartsOn: 1 })`
   - **actionItemCompletionRate**: (done + dismissed) / total * 100
   - **streakDays**: Use `eachDayOfInterval({ start: startOfMonth, end: endOfMonth })` and walk through each day checking if it has meetings to find the longest consecutive-day run
6. Return JSON: `{ days: DayMeetingSummary[], scoreboard: ScoreboardMetrics }`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '../../../lib/supabase';
import {
    startOfMonth, endOfMonth, format, parseISO,
    eachDayOfInterval, getWeeksInMonth,
} from 'date-fns';

export async function GET(request: NextRequest) {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

    // Build date range for the month using date-fns
    const monthDate = new Date(year, month - 1, 1);
    const startDate = startOfMonth(monthDate).toISOString();
    const endDate = endOfMonth(monthDate).toISOString();

    // Fetch transcripts in range
    const { data: transcripts } = await supabase
        .from('transcripts')
        .select('id, meeting_title, meeting_date, participants, word_count, extraction_method')
        .gte('meeting_date', startDate)
        .lte('meeting_date', endDate)
        .order('meeting_date', { ascending: true });

    // Fetch action items created in range
    const { data: actionItems } = await supabase
        .from('action_items')
        .select('id, status, group_label, assigned_to, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    const txns = transcripts ?? [];
    const items = actionItems ?? [];

    // Group transcripts by date using date-fns format
    const dayMap = new Map<string, DayMeetingSummary>();
    for (const t of txns) {
        const dateKey = format(parseISO(t.meeting_date), 'yyyy-MM-dd');
        // ... (build DayMeetingSummary for each day)
    }

    // Calculate streak using eachDayOfInterval
    const allDays = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
    // ... walk allDays to find longest consecutive meeting streak

    // Busiest day of week using format(date, 'EEEE')
    // Weeks in month using getWeeksInMonth(monthDate, { weekStartsOn: 1 })

    // ... (build ScoreboardMetrics)

    return NextResponse.json({ days: [...dayMap.values()], scoreboard });
}
```

Use this as a skeleton. Implement the full grouping logic, scoreboard calculations, streak detection, busiest-day detection, and participant counting. Use `createServerClient` from `../../lib/supabase` (import path: `'../../../lib/supabase'` from the calendar route depth).

## Step 4: Create the Calendar Page

**File:** `apps/web/app/calendar/page.tsx` (NEW)

This page must use `date-fns` for all date operations. At the top of the file:

```ts
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, isToday, isWeekend,
    addMonths, subMonths, parseISO,
} from 'date-fns';
import type { DayMeetingSummary, ScoreboardMetrics } from '@meet-pipeline/shared';
```

Use `date-fns` throughout — for example:
- **Month navigation**: `addMonths(currentMonth, 1)` / `subMonths(currentMonth, 1)` instead of manual month arithmetic
- **Month label**: `format(currentMonth, 'MMMM yyyy')` → "January 2026"
- **Calendar grid generation**: `eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }) })` — this gives you every cell in the grid including leading/trailing days from adjacent months
- **"Is this day in the current month?"**: `isSameMonth(day, currentMonth)`
- **"Is this today?"**: `isToday(day)`
- **Day cell date key for lookup**: `format(day, 'yyyy-MM-dd')` to match against `DayMeetingSummary.date`
- **Day detail header**: `format(selectedDay, 'EEEE, MMMM d, yyyy')` → "Tuesday, January 14, 2026"
- **Weekend detection**: `isWeekend(day)` for styling weekends differently

Build a full calendar page with these sections:

### 4a. Scoreboard Header

At the top, display a row of **stat cards** showing key metrics for the selected month:

| Card | Value | Icon/Color |
|------|-------|------------|
| Meetings | `scoreboard.totalMeetings` | `from-brand-500 to-brand-600` |
| Est. Hours | `scoreboard.totalHours` (1 decimal) | `from-accent-teal to-emerald-500` |
| Topics | `scoreboard.topicsDiscussed.length` | `from-accent-violet to-purple-500` |
| Action Items | `scoreboard.totalActionItems` | `from-amber-500 to-amber-600` |
| Completion Rate | `scoreboard.actionItemCompletionRate`% | `from-emerald-500 to-emerald-600` |
| Streak | `scoreboard.streakDays` days | `from-rose-500 to-rose-600` |

Use the existing `stat-card` class. Display these in `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4`.

### 4b. Month Navigation

Below the scoreboard, add month navigation with `< Prev` / `Next >` buttons and a label like **"January 2026"**. Store `currentYear` and `currentMonth` in state. When the user navigates months, re-fetch from the API.

### 4c. Calendar Grid

Build a **monthly calendar grid** (7 columns for Mon-Sun, rows for each week):

- **Day header row**: Mon, Tue, Wed, Thu, Fri, Sat, Sun — styled with `text-xs text-theme-text-muted uppercase tracking-wider`
- **Day cells**: Each cell is a `glass-card` variant (but smaller, `p-2`, no hover glow). The date number should be in the top-left corner.
  - Days outside the current month: reduced opacity (`opacity-30`)
  - Today: highlighted ring (`ring-2 ring-brand-500/40`)
  - Days with meetings: Show a colored dot per meeting (use brand-400 dot), plus the count if > 1. When hovering or clicking a day cell, show a tooltip or expand panel with the meeting titles.
- **Meeting indicators**: Inside each day cell, if there are meetings, render:
  - A small colored badge with count: `"3 meetings"`
  - First meeting title truncated if space allows
  - Clicking a day cell **expands** a detail panel below the calendar

### 4d. Day Detail Panel

When a user clicks a day cell that has meetings, show an expanded panel below the calendar (with `animate-slide-up`) containing:

- **Date header**: "Tuesday, January 14, 2026"
- **Meeting cards**: For each meeting that day, show a mini glass-card with:
  - Meeting title (linked to `/transcripts/{transcript_id}`)
  - Participants as badges
  - Word count
  - Extraction method badge
- **Daily stats**: Total words, estimated duration, participant count

### 4e. Collaboration Insights Panel

Below the calendar, add a **"Collaboration Insights"** section with:

1. **Who's Meeting Most**: Horizontal bar chart (built with pure CSS/Tailwind — `div` bars with `bg-gradient-to-r` and percentage widths) showing `scoreboard.meetingsByParticipant`
2. **Busiest Day of Week**: Display which weekday has the most meetings as a highlighted badge
3. **Topics Discussed**: Render `scoreboard.topicsDiscussed` as a tag cloud / flex-wrap of `badge-info` pills
4. **Timezone Awareness**: Show a small card at the bottom:
   - "You're viewing in your local timezone"
   - Display the user's local timezone name (use `Intl.DateTimeFormat().resolvedOptions().timeZone`)
   - This is helpful since Lutfiya and Chris are in different countries

### 4f. Co-Founder Activity Heatmap

Add a **mini heatmap** (GitHub-contribution-style) showing meeting density across the month. For each day cell in a compact grid:

- 0 meetings: `bg-theme-muted/30`
- 1 meeting: `bg-brand-500/20`
- 2 meetings: `bg-brand-500/40`
- 3+ meetings: `bg-brand-500/70`

This gives an instant visual of how active the month was.

## Step 5: Add Calendar to Sidebar

**File:** `apps/web/components/sidebar.tsx`

Add a new nav item to the `NAV_ITEMS` array:

```ts
const NAV_ITEMS = [
    { href: '/', label: 'Dashboard', icon: '◆' },
    { href: '/calendar', label: 'Calendar', icon: '◫' },
    { href: '/transcripts', label: 'Transcripts', icon: '◇' },
    { href: '/action-items', label: 'Action Items', icon: '☑' },
    { href: '/ask', label: 'Ask AI', icon: '◈' },
    { href: '/logs', label: 'Logs', icon: '◉' },
] as const;
```

Place Calendar as the **second item** (right after Dashboard) since it's a high-level overview page.

## Step 6: Add Calendar Summary Widget to Dashboard

**File:** `apps/web/app/page.tsx`

Add a compact **"This Month at a Glance"** card to the dashboard, placed between the existing Stat Cards and the Open Action Items Summary. This widget should:

1. Fetch from `/api/calendar` (current month) on mount
2. Show a compact single-row stat strip: `N meetings · ~Xh total · Y topics · Z% completion`
3. Include a "View Calendar →" link to `/calendar`
4. Use `glass-card` styling, same visual weight as the other dashboard sections

## Step 7: Helpful Features for Virtual Co-Founders

Implement these within the calendar page to make it genuinely useful for Lutfiya and Chris:

### 7a. Meeting Cadence Indicator
At the top of the scoreboard, show a cadence label:
- "Daily" if averageMeetingsPerWeek >= 5
- "Near-daily" if >= 3.5
- "Several times/week" if >= 2
- "Weekly" if >= 1
- "Bi-weekly" if >= 0.5
- "Occasional" otherwise

Display as: `"Meeting cadence: Several times/week"` in a subtle `text-theme-text-tertiary` under the month header.

### 7b. Action Item Velocity
Show how many action items were created vs. completed this month as a simple progress visualization:
- Created: amber bar
- Completed: emerald bar overlaid
- Label: "12 created · 8 completed this month"

### 7c. No-Meeting Days Counter
Show how many weekdays had **no meetings** as a stat: `"8 free days this month"`. This helps co-founders see if they have enough heads-down time.

### 7d. Participant Pair Analysis
Since it's 2 co-founders, show:
- "Meetings together: 14" (both Lutfiya AND Chris in participants)
- "Lutfiya solo: 3" / "Chris solo: 2" (only one co-founder present)
- "With external guests: 7" (participants beyond just the two of them)

Count these by analyzing the `participants` arrays. Use names that contain "Lutfiya" or "Chris" (case-insensitive partial match) as the co-founder detection logic.

---

## What NOT to Do

- Do NOT install any npm packages **besides `date-fns`**. No `react-calendar`, `moment`, `dayjs`, `luxon`, or any calendar UI component library. Build the calendar grid from scratch with React + Tailwind + `date-fns`.
- Do NOT use raw `Date` constructor math for month navigation, day-of-week detection, or interval generation — use `date-fns` functions instead (`addMonths`, `startOfWeek`, `eachDayOfInterval`, `format`, etc.)
- Do NOT modify existing API routes (`/api/transcripts`, `/api/action-items`, `/api/activity`, `/api/query`)
- Do NOT modify the action items page (`apps/web/app/action-items/page.tsx`)
- Do NOT modify the database schema — this feature reads from existing tables only
- Do NOT add Google Calendar integration — all data comes from the `transcripts` table
- Do NOT modify `globals.css` — use existing design system classes
- Do NOT modify `layout.tsx` beyond what's already there
- Do NOT add any authentication or user login — this is an internal tool for 2 people

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/shared/src/types.ts` | ADD new interfaces at end |
| `apps/web/app/api/calendar/route.ts` | CREATE new API route |
| `apps/web/app/calendar/page.tsx` | CREATE new page |
| `apps/web/components/sidebar.tsx` | ADD Calendar nav item |
| `apps/web/app/page.tsx` | ADD compact calendar widget |

## Testing Checklist

1. Navigate to `/calendar` — should render the full calendar grid for the current month
2. Scoreboard stat cards should populate with real data from your Supabase transcripts
3. Click `< Prev` / `Next >` — month navigation should fetch new data
4. Click a day cell with meetings — detail panel should expand below showing meeting cards
5. Meeting titles in the detail panel should link to `/transcripts/{id}`
6. Collaboration insights section should show participant bars and topics
7. Heatmap should visually reflect meeting density
8. Sidebar should show Calendar as the second nav item with active state working
9. Dashboard should show the compact "This Month at a Glance" widget
10. Light/dark theme toggle should work correctly on the calendar page (all CSS variable tokens)
11. Verify estimated hours calculation: total_words / 150 / 60 gives reasonable results
12. Participant pair analysis should correctly detect Lutfiya and Chris meetings
