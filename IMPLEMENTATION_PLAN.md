# MeetScript Enhancement Plan: Action Item Tracker & Control Center

## Current State Summary

MeetScript is a Next.js 14 + Express monorepo that fetches Google Meet transcripts from Gmail, chunks and embeds them via OpenAI, stores everything in Supabase (PostgreSQL + pgvector), and provides a RAG-powered "Ask AI" chat using Claude. The dashboard shows transcript stats, participants, and recent transcripts. The worker runs on Cloud Run with Gmail Pub/Sub push notifications.

**Key architecture details relevant to this plan:**
- **Database:** Supabase (PostgreSQL with pgvector)
- **Frontend:** Next.js 14 App Router, Tailwind CSS, glassmorphism design system
- **AI:** OpenAI embeddings (`text-embedding-3-small`) + Anthropic Claude (`claude-sonnet-4-20250514`)
- **Shared types:** `packages/shared/src/types.ts`
- **API routes:** `/api/transcripts`, `/api/transcripts/[id]`, `/api/query`, `/api/logs`

---

## Phase 1: UI Polish & Layout Fixes

**Goal:** Fix the formatting issues visible in the dashboard screenshot before adding new features.

### 1.1 Fix Recent Transcripts padding
- **File:** `apps/web/app/page.tsx`
- **Issue:** The "Recent Transcripts" section has no left padding/margin — text abuts the card border.
- **Fix:** Add `p-6` or equivalent padding to the Recent Transcripts container, matching the stat cards and participants section.

### 1.2 Consistent card spacing
- **File:** `apps/web/app/page.tsx`
- **Fix:** Ensure all glass-card sections (stats, participants, recent transcripts) have consistent internal padding (`p-6`) and external spacing (`gap-6` or `space-y-6`).

### 1.3 Responsive table improvements
- **File:** `apps/web/app/page.tsx`
- **Fix:** Wrap the recent transcripts table in an `overflow-x-auto` container so it doesn't break on smaller viewports. Truncate long titles with `truncate` class and a `max-w` constraint.

**Estimated effort:** ~1–2 hours

---

## Phase 2: Database Schema — Action Items & Activity Log

**Goal:** Add tables to track action items, their status, and an activity feed.

### 2.1 New migration: `002_action_items.sql`
**Location:** `supabase/migrations/002_action_items.sql`

```sql
-- Action items extracted from transcripts or created manually
CREATE TABLE action_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transcript_id TEXT REFERENCES transcripts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,                    -- "Lutfiya", "Chris", or NULL
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'in_progress' | 'done' | 'dismissed'
  priority TEXT DEFAULT 'medium',      -- 'low' | 'medium' | 'high' | 'urgent'
  due_date DATE,
  source_text TEXT,                    -- The transcript excerpt that generated this item
  created_by TEXT DEFAULT 'ai',        -- 'ai' (auto-extracted) | 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_assigned ON action_items(assigned_to);
CREATE INDEX idx_action_items_transcript ON action_items(transcript_id);

-- Activity log for tracking all system events
CREATE TABLE activity_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type TEXT NOT NULL,           -- 'action_item_created' | 'action_item_updated' |
                                      -- 'transcript_processed' | 'query_asked' | 'manual_note'
  entity_type TEXT,                   -- 'action_item' | 'transcript' | 'query'
  entity_id TEXT,                     -- ID of the related record
  actor TEXT,                         -- 'system' | 'Lutfiya' | 'Chris'
  summary TEXT NOT NULL,              -- Human-readable description
  metadata JSONB DEFAULT '{}',        -- Flexible extra data
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_log_type ON activity_log(event_type);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
```

### 2.2 Update shared types
**File:** `packages/shared/src/types.ts`

Add interfaces:
```typescript
export type ActionItemStatus = 'open' | 'in_progress' | 'done' | 'dismissed';
export type ActionItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActionItemCreatedBy = 'ai' | 'manual';

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

**Estimated effort:** ~1 hour

---

## Phase 3: AI-Powered Action Item Extraction

**Goal:** When a new transcript is processed, automatically extract action items using Claude.

### 3.1 New extraction module
**File:** `apps/worker/src/extraction/action-items.ts`

**Approach:**
1. After a transcript is stored and chunked (step 8 of the existing pipeline), call Claude with the full transcript text.
2. Use a structured prompt that asks Claude to identify action items, who they're assigned to, priority, and any mentioned deadlines.
3. Request JSON output from Claude matching the `ActionItem` schema.
4. Insert extracted items into the `action_items` table.
5. Log each extraction to `activity_log`.

**Prompt design:**
```
You are analyzing a meeting transcript between Lutfiya Miller and Chris Muller.
Extract all action items, deliverables, commitments, and follow-ups.

For each item, provide:
- title: A concise description (< 100 chars)
- description: Fuller context if needed
- assigned_to: "Lutfiya", "Chris", or null if unclear
- priority: "low" | "medium" | "high" | "urgent" based on language cues
- due_date: ISO date if a deadline was mentioned, or null
- source_text: The exact quote from the transcript

Return JSON array. If no action items found, return [].
```

### 3.2 Integrate into pipeline
**File:** `apps/worker/src/pipeline.ts`

Add step 9 after chunk storage:
```
Step 9: Extract action items via Claude → insert into action_items table → log to activity_log
```

This keeps the existing 8-step pipeline intact and adds extraction as an additive step. If extraction fails, log the error but don't fail the overall pipeline.

### 3.3 Backfill existing transcripts
Create a one-time script (`apps/worker/src/scripts/backfill-action-items.ts`) that:
1. Fetches all existing transcripts from Supabase
2. Runs the action item extraction prompt on each
3. Inserts results into `action_items`

This can be run manually after deploying Phase 2 + 3.

**Estimated effort:** ~3–4 hours

---

## Phase 4: Action Items API Routes

**Goal:** CRUD endpoints for action items.

### 4.1 New API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/action-items` | GET | List all action items (filterable by status, assignee, transcript) |
| `/api/action-items` | POST | Create a manual action item |
| `/api/action-items/[id]` | GET | Get single action item |
| `/api/action-items/[id]` | PATCH | Update status, assignee, priority, due date |
| `/api/action-items/[id]` | DELETE | Soft-delete (set status to 'dismissed') |
| `/api/action-items/extract` | POST | Trigger AI extraction for a specific transcript |
| `/api/activity` | GET | Fetch activity log (paginated, filterable by event type) |

### 4.2 Query parameters for GET `/api/action-items`

- `status`: Filter by status (comma-separated for multiple)
- `assigned_to`: Filter by assignee
- `transcript_id`: Filter by source transcript
- `priority`: Filter by priority
- `sort`: `created_at` | `due_date` | `priority` (default: `created_at`)
- `order`: `asc` | `desc` (default: `desc`)

**Estimated effort:** ~2–3 hours

---

## Phase 5: Action Items Dashboard UI

**Goal:** Add an "Action Items" page and integrate action items into the main dashboard.

### 5.1 New sidebar nav item
**File:** `apps/web/components/sidebar.tsx`

Add "Action Items" between "Transcripts" and "Ask AI" with a checklist icon. Include a badge showing count of open items.

### 5.2 Action Items page (`apps/web/app/action-items/page.tsx`)

**Layout — Kanban-style board with 3 columns:**

| Open | In Progress | Done |
|------|-------------|------|
| Cards... | Cards... | Cards... |

**Each card shows:**
- Title (bold)
- Assigned to (avatar/badge for Lutfiya or Chris)
- Priority indicator (colored dot or border: red=urgent, orange=high, blue=medium, gray=low)
- Due date (with overdue highlighting in red)
- Source transcript link (if AI-extracted)
- Status toggle buttons

**Filters bar at top:**
- Assignee filter (All / Lutfiya / Chris)
- Priority filter (All / Urgent / High / Medium / Low)
- Source filter (AI-extracted / Manual)
- Search input for title/description

**Interactions:**
- Drag-and-drop between columns to change status (use a lightweight library like `@dnd-kit/core`, or simple button-based transitions)
- Click card to expand with full description, source text quote, and edit form
- "Add Action Item" button for manual creation (modal with title, description, assignee, priority, due date)
- Bulk actions: "Mark all done", "Reassign selected"

### 5.3 Dashboard integration
**File:** `apps/web/app/page.tsx`

Add a new section between participants and recent transcripts:

**"Open Action Items" summary card:**
- Count of open items per assignee (e.g., "Lutfiya: 5 | Chris: 3")
- Count of overdue items (highlighted in red)
- Top 3 urgent/high priority items as a quick list
- "View All →" link to the action items page

### 5.4 Transcript detail integration
**File:** `apps/web/app/transcripts/[id]/page.tsx`

Add an "Action Items" section in the right sidebar (below existing metadata):
- List action items extracted from this transcript
- Each shows title, assignee badge, status badge
- Button to trigger re-extraction if needed
- Button to manually add an action item linked to this transcript

**Estimated effort:** ~6–8 hours

---

## Phase 6: Activity Feed

**Goal:** A live activity feed showing what's happening across the system.

### 6.1 Activity page (`apps/web/app/activity/page.tsx`)

**Timeline-style feed:**
- Vertical timeline with event cards
- Each card shows: icon (by event type), summary text, timestamp, link to related entity
- Event types with icons:
  - 📋 `action_item_created` — "AI extracted 4 action items from [Meeting Title]"
  - ✅ `action_item_updated` — "Chris marked 'Send proposal' as done"
  - 📝 `transcript_processed` — "New transcript: Chris/Lutfiya Mar 2, 2026"
  - 🤖 `query_asked` — "Lutfiya asked: 'What were the key decisions?'"
  - 📌 `manual_note` — "Chris added a note about Q2 planning"

**Filters:**
- Event type toggle buttons
- Date range picker
- Actor filter (System / Lutfiya / Chris)

### 6.2 Dashboard activity widget
**File:** `apps/web/app/page.tsx`

Add a compact "Recent Activity" feed at the bottom of the dashboard showing the last 5 events. Each event is a single line with icon + summary + relative timestamp.

### 6.3 Log activity from existing features
- **Query endpoint** (`/api/query`): After returning an AI answer, log the query to `activity_log`
- **Transcript processing** (worker pipeline): Already logs to `processing_log`; additionally log to `activity_log` for the unified feed

**Estimated effort:** ~3–4 hours

---

## Phase 7: Enhanced Ask AI — Action-Aware Responses

**Goal:** Make the AI aware of action items so queries can reference and update them.

### 7.1 Enhance the RAG system prompt
**File:** `apps/web/app/api/query/route.ts`

Update the Claude system prompt to include context about open action items when relevant:

```
You are a helpful assistant for MeetScript, a meeting transcript management tool
used by Lutfiya Miller and Chris Muller at 3rd AI LLC.

You can answer questions about meeting transcripts and action items.
When asked about action items, deliverables, or tasks, include relevant items
from the action items database in your response.

When you identify new action items in your response, format them as:
[ACTION: title | assigned_to | priority | due_date]
so the system can offer to save them.
```

### 7.2 Include action items in query context
When a user asks a question, in addition to the chunk similarity search:
1. Check if the query mentions "action items", "tasks", "deliverables", "to-do", etc.
2. If so, fetch open action items from the database and include them in the context window alongside the transcript chunks.

### 7.3 Action item suggestions in chat
When the AI response contains `[ACTION: ...]` markers:
- Parse them in the frontend
- Display as clickable cards below the response
- Each card has a "Save as Action Item" button
- Clicking saves it via `POST /api/action-items`

**Estimated effort:** ~3–4 hours

---

## Phase 8: Notifications & Reminders (Future Enhancement)

**Goal:** Proactive notifications for overdue items and weekly summaries.

### 8.1 Weekly digest email
- Scheduled worker job (cron or Cloud Scheduler)
- Sends email to Lutfiya and Chris with:
  - Open action items summary
  - Overdue items highlighted
  - Transcripts processed that week
  - Key AI-extracted insights

### 8.2 Overdue item alerts
- Dashboard banner when overdue items exist
- Color-coded urgency in the action items page

**Estimated effort:** ~4–5 hours (can be deferred)

---

## Implementation Order & Dependencies

```
Phase 1 (UI Polish)           — No dependencies, can start immediately
    ↓
Phase 2 (Database Schema)     — No dependencies, can start in parallel with Phase 1
    ↓
Phase 3 (AI Extraction)       — Depends on Phase 2 (needs tables)
    ↓
Phase 4 (API Routes)          — Depends on Phase 2 (needs tables)
    ↓
Phase 5 (Action Items UI)     — Depends on Phase 4 (needs API)
    ↓
Phase 6 (Activity Feed)       — Depends on Phase 2 (needs activity_log table)
    ↓
Phase 7 (Enhanced AI)         — Depends on Phase 4 + 5 (needs action items flowing)
    ↓
Phase 8 (Notifications)       — Depends on all above, can be deferred
```

**Phases 1 and 2 can run in parallel.** Phases 3 and 4 can run in parallel after Phase 2 is done.

---

## Total Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: UI Polish | 1–2 hours |
| Phase 2: Database Schema | 1 hour |
| Phase 3: AI Extraction | 3–4 hours |
| Phase 4: API Routes | 2–3 hours |
| Phase 5: Action Items UI | 6–8 hours |
| Phase 6: Activity Feed | 3–4 hours |
| Phase 7: Enhanced AI | 3–4 hours |
| Phase 8: Notifications | 4–5 hours (deferred) |
| **Total** | **~23–31 hours** |

---

## Technical Considerations

1. **No new external dependencies required for core features.** The existing stack (Supabase, Claude, OpenAI, Next.js) handles everything. The only optional addition would be a drag-and-drop library for the Kanban board.

2. **Claude API costs for extraction.** Each transcript will require one additional Claude call for action item extraction. With ~10 transcripts/week, this is negligible cost.

3. **Backfill strategy.** The 11 existing transcripts should be backfilled with action items after deploying Phases 2–3. This is a one-time operation.

4. **Activity log vs. processing log.** The existing `processing_log` table tracks transcript ingestion specifically. The new `activity_log` is a unified feed across all features. Both will coexist — the processing log stays for debugging, and the activity log is user-facing.

5. **No breaking changes.** Every phase is additive. Existing functionality (transcript viewing, Ask AI, logs) continues to work unchanged throughout the rollout.
