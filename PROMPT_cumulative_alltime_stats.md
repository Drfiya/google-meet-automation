# Prompt: Add Cumulative All-Time Statistics to Calendar Page

Copy everything below this line and paste it into Claude 4.6 Opus in Antigravity.

---

## Context

This is **MeetScript** — a meeting transcript pipeline dashboard for **scienceexperts.ai** (Lutfiya & Chris). The Calendar page already has a **monthly scoreboard** showing 6 stat cards (Meetings, Est. Hours, Topics, Action Items, Completion %, Streak) plus collaboration insights, a heatmap, and co-founder pair analysis — all scoped to the **currently selected month**.

I want to add a second scoreboard section showing **cumulative all-time totals** across those same parameters, so we can see our overall track record alongside the monthly snapshot.

### Current Architecture

**Shared types** (`packages/shared/src/types.ts`) — the existing `ScoreboardMetrics` interface:

```ts
export interface ScoreboardMetrics {
    period: string;
    totalMeetings: number;
    totalHours: number;
    totalActionItems: number;
    completedActionItems: number;
    topicsDiscussed: string[];
    meetingsByParticipant: Record<string, number>;
    busiestDay: string;
    averageMeetingsPerWeek: number;
    actionItemCompletionRate: number;
    streakDays: number;
    meetingsTogether: number;
    lutfiyaSolo: number;
    chrisSolo: number;
    withExternalGuests: number;
    actionItemsCreated: number;
    actionItemsCompleted: number;
    freeDays: number;
}
```

**API route** (`apps/web/app/api/calendar/route.ts`) — currently accepts `?year=YYYY&month=MM` and returns:

```ts
{ days: DayMeetingSummary[], scoreboard: ScoreboardMetrics }
```

It queries Supabase `transcripts` and `action_items` tables filtered to the requested month. Uses `date-fns` (`startOfMonth`, `endOfMonth`, `format`, `parseISO`, `eachDayOfInterval`, `getWeeksInMonth`, `isWeekend`). Uses `getServerSupabase()` from `'../../../lib/supabase'`.

Existing helper functions in the route: `isLutfiya(name)`, `isChris(name)`, `computeStreak(allDays, dayMap)`, `computeBusiestDay(transcripts)`.

**Calendar page** (`apps/web/app/calendar/page.tsx`) — client component that:
- Stores `currentMonth` state and fetches `/api/calendar?year=Y&month=M` on change
- Parses the response as `{ days, scoreboard }` into a `CalendarData` interface
- Renders via sub-components: `ScoreboardHeader`, `DayDetailPanel`, `ActivityHeatmap`, `CollaborationInsights`, `CoFounderFeatures`

The `ScoreboardHeader` component renders 6 stat cards in `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4`:

```ts
function ScoreboardHeader({ scoreboard }: { scoreboard: ScoreboardMetrics }) {
    const cards = [
        { label: 'Meetings', value: String(scoreboard.totalMeetings), color: 'from-brand-500 to-brand-600' },
        { label: 'Est. Hours', value: scoreboard.totalHours.toFixed(1), color: 'from-accent-teal to-emerald-500' },
        { label: 'Topics', value: String(scoreboard.topicsDiscussed.length), color: 'from-accent-violet to-purple-500' },
        { label: 'Action Items', value: String(scoreboard.totalActionItems), color: 'from-amber-500 to-amber-600' },
        { label: 'Completion', value: `${scoreboard.actionItemCompletionRate}%`, color: 'from-emerald-500 to-emerald-600' },
        { label: 'Streak', value: `${scoreboard.streakDays}d`, color: 'from-rose-500 to-rose-600' },
    ];
    // ... renders stat-card for each
}
```

**Design system classes**: `glass-card`, `stat-card`, `badge-info`, `badge-success`. Text tokens: `text-theme-text-primary`, `text-theme-text-secondary`, `text-theme-text-tertiary`, `text-theme-text-muted`. Uses Tailwind 3.4. Light/dark theme via CSS variables.

**Dashboard** (`apps/web/app/page.tsx`) — has a `CalendarWidget` that fetches `/api/calendar` (no params = current month) and displays: `N meetings · ~Xh total · Y topics · Z% completion` with a "View Calendar →" link.

---

## Goal

Add **cumulative all-time statistics** to the Calendar page so Lutfiya and Chris can see their total track record (e.g., "142 meetings all-time, ~97 hours total") alongside the monthly view. Also update the dashboard widget to include all-time totals.

---

## Step 1: Add `CumulativeStats` Interface

**File:** `packages/shared/src/types.ts`

Add a new interface after `ScoreboardMetrics` (do NOT modify `ScoreboardMetrics`):

```ts
/** Cumulative all-time statistics across all transcripts and action items. */
export interface CumulativeStats {
    totalMeetings: number;
    totalHours: number;              // estimated from word count (totalWords / 150 / 60)
    totalWords: number;
    totalActionItems: number;
    completedActionItems: number;
    actionItemCompletionRate: number; // 0-100
    topicsDiscussed: string[];       // all unique group_labels ever
    uniqueParticipants: string[];    // every participant name ever seen
    meetingsByParticipant: Record<string, number>;
    busiestDay: string;              // all-time busiest day of week
    firstMeetingDate: string | null; // ISO date of earliest transcript
    lastMeetingDate: string | null;  // ISO date of most recent transcript
    totalMonthsActive: number;       // number of distinct YYYY-MM months with meetings
    meetingsTogether: number;
    lutfiyaSolo: number;
    chrisSolo: number;
    withExternalGuests: number;
    averageMeetingsPerMonth: number;
}
```

## Step 2: Update the Calendar API Route

**File:** `apps/web/app/api/calendar/route.ts`

Add a second set of queries that fetch **all** transcripts and **all** action items (no date filter) to compute cumulative stats. Do this efficiently — the cumulative queries run in parallel with the monthly queries using `Promise.all`.

### 2a. Add cumulative queries

After the existing monthly queries, add:

```ts
// ── Cumulative all-time queries (run in parallel with monthly) ──

const [
    { data: allTranscripts },
    { data: allActionItems },
] = await Promise.all([
    supabase
        .from('transcripts')
        .select('id, meeting_title, meeting_date, participants, word_count, extraction_method')
        .order('meeting_date', { ascending: true }),
    supabase
        .from('action_items')
        .select('id, status, group_label, assigned_to, created_at'),
]);
```

Actually, **restructure** the existing code so that ALL four queries (monthly transcripts, monthly action items, all transcripts, all action items) run in a single `Promise.all` for efficiency:

```ts
const [
    { data: transcripts },
    { data: actionItems },
    { data: allTranscripts },
    { data: allActionItems },
] = await Promise.all([
    supabase.from('transcripts')
        .select('id, meeting_title, meeting_date, participants, word_count, extraction_method')
        .gte('meeting_date', startDate).lte('meeting_date', endDate)
        .order('meeting_date', { ascending: true }),
    supabase.from('action_items')
        .select('id, status, group_label, assigned_to, created_at')
        .gte('created_at', startDate).lte('created_at', endDate),
    supabase.from('transcripts')
        .select('id, meeting_title, meeting_date, participants, word_count, extraction_method')
        .order('meeting_date', { ascending: true }),
    supabase.from('action_items')
        .select('id, status, group_label, assigned_to, created_at'),
]);
```

### 2b. Compute cumulative stats

After the existing monthly scoreboard calculation, add a new block that computes `CumulativeStats` from `allTranscripts` and `allActionItems`. Reuse the existing helpers (`isLutfiya`, `isChris`, `computeBusiestDay`). Compute:

- `totalMeetings`, `totalWords`, `totalHours` — same formulas as monthly but over all records
- `totalActionItems`, `completedActionItems`, `actionItemCompletionRate` — same logic
- `topicsDiscussed` — all unique `group_label` values from all action items
- `uniqueParticipants` — deduplicated set of all participant names
- `meetingsByParticipant` — count per participant across all time
- `busiestDay` — all-time busiest day of week via `computeBusiestDay(allTxns)`
- `firstMeetingDate` / `lastMeetingDate` — from sorted `allTranscripts` array (first and last items)
- `totalMonthsActive` — count distinct `format(parseISO(meeting_date), 'yyyy-MM')` values
- `meetingsTogether`, `lutfiyaSolo`, `chrisSolo`, `withExternalGuests` — same co-founder logic but over all transcripts
- `averageMeetingsPerMonth` — `totalMeetings / totalMonthsActive` (guard against division by zero)

### 2c. Update the response shape

Change the return value from:

```ts
return NextResponse.json({ days, scoreboard });
```

to:

```ts
return NextResponse.json({ days, scoreboard, cumulative });
```

## Step 3: Update the Calendar Page

**File:** `apps/web/app/calendar/page.tsx`

### 3a. Update the `CalendarData` interface

```ts
interface CalendarData {
    days: DayMeetingSummary[];
    scoreboard: ScoreboardMetrics;
    cumulative: CumulativeStats;  // ← add this
}
```

Import `CumulativeStats` from `@meet-pipeline/shared`.

### 3b. Add cumulative stats to the page layout

Below the **monthly ScoreboardHeader** and above the **Month Navigation**, add a new section called **"All-Time Totals"**. Design it as a `glass-card` with a distinct visual treatment so it's clearly separate from the monthly stats:

```
┌─────────────────────────────────────────────────────────────┐
│  ALL-TIME TOTALS                            Since Jan 2025  │
│                                                             │
│  142 meetings  ·  ~97.2h  ·  312 action items  ·  54.8%    │
│  41 topics  ·  12 participants  ·  Busiest day: Tuesday     │
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ Together   │ │ Lutfiya    │ │ Chris      │              │
│  │    89      │ │  solo: 31  │ │  solo: 22  │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                             │
│  Avg: 4.2 meetings/month · 8 active months                  │
└─────────────────────────────────────────────────────────────┘
```

**Implementation details:**

1. Use a single `glass-card` container with `p-6 mb-6`
2. Header row: `"All-Time Totals"` as `text-sm font-semibold text-theme-text-secondary uppercase tracking-wider` on the left, and `"Since {firstMeetingDate formatted as MMM yyyy}"` on the right in `text-xs text-theme-text-muted`
3. **Primary stats line**: Render as a flowing sentence/strip using `text-sm text-theme-text-primary` with key numbers highlighted:
   - `totalMeetings` in `font-semibold text-brand-400`
   - `totalHours` in `font-semibold text-accent-teal`
   - `totalActionItems` in `font-semibold text-amber-400`
   - `actionItemCompletionRate` in `font-semibold text-emerald-400`
4. **Secondary stats line**: topics count, unique participants count, busiest day — in `text-xs text-theme-text-tertiary`
5. **Co-founder mini-stats**: Three inline badges or small stat blocks showing `meetingsTogether`, `lutfiyaSolo`, `chrisSolo` — use the same `PairRow`-style or compact inline badges
6. **Footer line**: `"Avg: {averageMeetingsPerMonth} meetings/month · {totalMonthsActive} active months"` in `text-xs text-theme-text-muted`

**Do NOT duplicate the monthly stats**. The monthly `ScoreboardHeader` (6 stat cards) stays exactly as-is. The cumulative section should have a different visual density — more compact, text-driven, not individual large stat cards — so it's visually distinct and clearly reads as "all-time summary" vs the big monthly cards.

### 3c. Update loading state

When `loading` is true, show a subtle skeleton placeholder for the cumulative section too (a single `glass-card` with `h-32 animate-pulse bg-theme-muted/20`).

## Step 4: Update the Dashboard Widget

**File:** `apps/web/app/page.tsx`

The existing `CalendarWidget` component receives `scoreboard: ScoreboardMetrics | null`. Update it to also receive `cumulative: CumulativeStats | null` and display a second line with all-time totals.

### 4a. Update `refreshData` to extract cumulative

In the `refreshData` function, update the `/api/calendar` fetch handler:

```ts
fetch('/api/calendar')
    .then((r) => r.json())
    .then((data) => {
        if (data?.scoreboard) setCalendarScoreboard(data.scoreboard);
        if (data?.cumulative) setCalendarCumulative(data.cumulative);
    })
    .catch(() => { });
```

Add state: `const [calendarCumulative, setCalendarCumulative] = useState<CumulativeStats | null>(null);`

Import `CumulativeStats` from `@meet-pipeline/shared`.

### 4b. Update `CalendarWidget` to show cumulative

Pass the cumulative data to the widget:

```tsx
<CalendarWidget scoreboard={calendarScoreboard} cumulative={calendarCumulative} />
```

In the component, add a second line below the existing monthly stats:

```tsx
function CalendarWidget({ scoreboard, cumulative }: {
    scoreboard: ScoreboardMetrics | null;
    cumulative: CumulativeStats | null;
}) {
    if (!scoreboard) return null;

    return (
        <div className="glass-card p-5 mb-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-theme-text-secondary uppercase tracking-wider mb-2">
                        This Month at a Glance
                    </h2>
                    <p className="text-sm text-theme-text-primary">
                        {/* existing monthly line — keep exactly as-is */}
                    </p>
                    {cumulative && (
                        <p className="text-xs text-theme-text-tertiary mt-1.5">
                            All-time: <span className="font-medium text-theme-text-secondary">{cumulative.totalMeetings}</span> meetings
                            {' · ~'}<span className="font-medium text-theme-text-secondary">{cumulative.totalHours.toFixed(1)}h</span>
                            {' · '}<span className="font-medium text-theme-text-secondary">{cumulative.totalActionItems}</span> action items
                            {' · '}<span className="font-medium text-theme-text-secondary">{cumulative.averageMeetingsPerMonth.toFixed(1)}</span>/month avg
                        </p>
                    )}
                </div>
                <Link href="/calendar" className="...">View Calendar →</Link>
            </div>
        </div>
    );
}
```

---

## What NOT to Do

- Do NOT modify the `ScoreboardMetrics` interface — add a NEW `CumulativeStats` interface alongside it
- Do NOT change how the monthly scoreboard is calculated or displayed
- Do NOT change the monthly `ScoreboardHeader` component's visual design (the 6 large stat cards)
- Do NOT remove or reorder any existing sections on the calendar page
- Do NOT modify the calendar grid, heatmap, day detail panel, or collaboration insights
- Do NOT modify any other API routes (`/api/transcripts`, `/api/action-items`, `/api/activity`, `/api/query`)
- Do NOT modify the database schema
- Do NOT install any new packages

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/shared/src/types.ts` | ADD `CumulativeStats` interface after `ScoreboardMetrics` |
| `apps/web/app/api/calendar/route.ts` | ADD cumulative queries + calculations, update response shape |
| `apps/web/app/calendar/page.tsx` | ADD cumulative stats section below monthly scoreboard |
| `apps/web/app/page.tsx` | UPDATE `CalendarWidget` to show all-time totals |

## Testing Checklist

1. Navigate to `/calendar` — monthly scoreboard cards should display exactly as before
2. Below the monthly cards, a new "All-Time Totals" glass-card should appear with cumulative stats
3. Cumulative numbers should be >= monthly numbers (since all-time includes the current month)
4. "Since {date}" should show the date of the earliest transcript in the system
5. Navigate months with Prev/Next — monthly stats should change, **cumulative stats should stay the same** (they're not month-dependent)
6. Dashboard widget should show two lines: monthly and all-time
7. Co-founder pair analysis in cumulative should reflect all meetings, not just the current month
8. Light/dark theme toggle should render correctly on the new section
9. If the database has 0 transcripts, cumulative section should handle gracefully (no NaN, no crashes)
10. Check browser Network tab — the API call should return `{ days, scoreboard, cumulative }` and there should be only ONE call to `/api/calendar` per month navigation (not separate calls for monthly vs cumulative)
