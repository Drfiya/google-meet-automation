# Prompt: Smart Grouping for Action Items Page

Copy everything below this line and paste it into Claude in Antigravity.

---

## Task

Add AI-powered smart grouping to the MeetScript Action Items page. Action items that are related to the same topic, project, or entity should be visually grouped together in collapsible sections within each Kanban column. For example, two tasks about "Raggy" should appear under a "Raggy" group header that can be expanded or collapsed to show/hide the individual task cards.

## Architecture Context

This is a Turborepo monorepo:
- `apps/web` — Next.js 14 (App Router), React 18, Tailwind CSS 3.4, TypeScript 5.5
- `packages/shared/src/types.ts` — Shared TypeScript interfaces
- Database: Supabase (PostgreSQL)
- AI: Anthropic Claude (`claude-sonnet-4-20250514`) via REST API
- No additional npm dependencies should be added

## How Grouping Should Work

### Grouping Strategy (Two Tiers)

**Tier 1 — Database-backed groups (persistent):** Each action item gets a `group_label` field stored in the database. This is assigned by Claude when action items are first extracted from transcripts, and can be computed on-demand for existing ungrouped items via a new API endpoint.

**Tier 2 — Frontend rendering:** The Kanban columns render items organized by their `group_label`. Items sharing the same `group_label` within a column are rendered inside a collapsible group container. Items with no group (null `group_label`) appear individually at the bottom of the column under an implicit "Other" section.

### What Claude Should Use for Grouping

When assigning `group_label` values, Claude should identify the common project, product, tool, initiative, or topic that unites related items. Examples based on the kinds of action items in this app:

- Two items mentioning "Raggy" → group_label: `"Raggy"`
- Three items about "website alignment", "fix CSS", "centering issues" → group_label: `"Website UI"`
- Items about "Superbase connection" and "database uploads" → group_label: `"Database"`
- Items about a client like "Acme Corp proposal" and "Acme Corp invoice" → group_label: `"Acme Corp"`

The group labels should be short (1–3 words), human-readable, and title-cased. Claude should look at all action items together to find natural clusters, not assign groups one item at a time.

## Current Database Schema

The `action_items` table currently looks like this (in `supabase/migrations/002_action_items.sql`):

```sql
CREATE TABLE action_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transcript_id TEXT REFERENCES transcripts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  source_text TEXT,
  created_by TEXT DEFAULT 'ai',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

## Current Shared Types

In `packages/shared/src/types.ts`:

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
```

## Current Action Items Page

The full current source of the action items page is in `apps/web/app/action-items/page.tsx`. Key architectural details:

- **State:** `items` array of `ActionItem[]` fetched from `GET /api/action-items`
- **Filters:** assignee, priority, source (ai/manual), text search — all applied client-side via `useMemo`
- **Kanban:** 3 columns (Open, In Progress, Done) rendered via a `COLUMNS` array that maps `ActionItemStatus` to label/color
- **Cards:** `ActionItemCard` component shows title, assignee badge, priority dot, due date, AI badge, expand/collapse for description + source text, and status transition buttons (Start/Done/Reopen/Dismiss)
- **Create modal:** Inline modal for manually adding action items
- **Styling:** glassmorphism design system — `glass-card`, `input-glow`, `badge-info`, `badge-error` classes; Tailwind utilities; light/dark mode via CSS variables

The existing API routes:
- `GET /api/action-items` — list with filtering (status, assigned_to, priority, transcript_id, sort, order)
- `POST /api/action-items` — create new item
- `PATCH /api/action-items/[id]` — update fields
- `DELETE /api/action-items/[id]` — soft-delete (set status to 'dismissed')
- `POST /api/action-items/extract` — AI extraction from a transcript (uses Claude)

## What to Build

### Step 1: Database Migration

**File:** `supabase/migrations/003_action_item_groups.sql`

Add a `group_label` column to the `action_items` table:

```sql
ALTER TABLE action_items ADD COLUMN group_label TEXT;
CREATE INDEX idx_action_items_group ON action_items(group_label);
```

This is nullable — existing items and ungrouped items will have `group_label = NULL`.

### Step 2: Update Shared Types

**File:** `packages/shared/src/types.ts`

Add `group_label` to the `ActionItem` interface:

```typescript
export interface ActionItem {
  // ... all existing fields ...
  group_label: string | null;   // ← ADD THIS
}
```

### Step 3: AI Grouping API Endpoint

**File:** `apps/web/app/api/action-items/group/route.ts`

Create a `POST /api/action-items/group` endpoint that:

1. Fetches all action items where `status != 'dismissed'` from the database.
2. Sends the list of item titles + descriptions to Claude with a grouping prompt.
3. Claude returns a JSON mapping of `{ item_id: group_label }` for every item.
4. Batch-updates all items with their assigned `group_label` in the database.
5. Returns the updated items.

**Claude prompt for grouping:**

```
You are organizing action items into logical groups for a task management dashboard.

Below is a JSON array of action items. Each has an "id", "title", and optional "description".

Your job:
1. Identify items that belong to the same project, product, tool, client, initiative, or topic.
2. Assign a short group label (1–3 words, title-cased) to each item.
3. Items that don't clearly belong to any group should get group_label: null.
4. A group must have at least 2 items. If only 1 item relates to a topic, set its group_label to null.
5. Be conservative — only group items that are genuinely related, not just vaguely similar.

Return a JSON object where keys are item IDs and values are the group label (string) or null.
Example: { "abc123": "Raggy", "def456": "Raggy", "ghi789": "Website UI", "jkl012": null }

Return ONLY valid JSON, no markdown fences or extra text.
```

The request body to the endpoint should accept an optional `{ force: boolean }` flag:
- `force: false` (default): Only group items where `group_label IS NULL`
- `force: true`: Re-group ALL non-dismissed items (overwrites existing labels)

**Implementation details:**
- Use `process.env.ANTHROPIC_API_KEY` for the Claude call
- Use `getServerSupabase()` from `apps/web/lib/supabase.ts` for database access
- Model: `claude-sonnet-4-20250514`, max_tokens: 4096
- After getting Claude's response, batch-update items using individual `.update()` calls or a loop (Supabase JS doesn't support bulk conditional updates natively, so loop over the mapping and update each item's `group_label`)
- Log the grouping action to `activity_log` with event_type `'action_items_grouped'`

### Step 4: Update AI Extraction to Include Groups

**File:** `apps/web/app/api/action-items/extract/route.ts`

When Claude extracts action items from a transcript, it should also assign `group_label` values. Update the extraction system prompt to include:

```
- group_label (string | null): A short label (1-3 words, title-cased) for the project, tool, or topic this item relates to. Use null if it doesn't clearly belong to a group. If multiple items relate to the same topic, give them the same label.
```

And include `group_label` in the insert rows. This way, newly extracted items arrive pre-grouped.

### Step 5: Update the Action Items Page with Smart Grouping UI

**File:** `apps/web/app/action-items/page.tsx`

This is the main UI change. Here is the exact behavior to implement:

#### 5a. Add Grouping State and Logic

Add state and a `useMemo` computation that organizes filtered items into groups per column:

```typescript
// State for tracking collapsed groups
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

// Toggle a group's collapsed state (key = `${columnStatus}::${groupLabel}`)
const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
    });
};

// Organize items into groups per column
const groupedByColumn = useMemo(() => {
    const result: Record<ActionItemStatus, { label: string | null; items: ActionItem[] }[]> = {
        open: [], in_progress: [], done: [], dismissed: [],
    };

    for (const col of COLUMNS) {
        const colItems = filtered.filter(i => i.status === col.key);

        // Bucket items by group_label
        const buckets = new Map<string | null, ActionItem[]>();
        for (const item of colItems) {
            const key = item.group_label ?? null;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(item);
        }

        // Sort: named groups first (alphabetically), then ungrouped (null) last
        const groups = [...buckets.entries()]
            .sort((a, b) => {
                if (a[0] === null) return 1;
                if (b[0] === null) return -1;
                return a[0].localeCompare(b[0]);
            })
            .map(([label, items]) => ({ label, items }));

        result[col.key] = groups;
    }

    return result;
}, [filtered]);
```

#### 5b. Render Grouped Items in Kanban Columns

Replace the current flat card list in each column with grouped rendering. The structure within each column should be:

```
Column: Open (96)
├── Group: "Raggy" (2 items)  ← collapsible header
│   ├── [ActionItemCard: "Book Raggy demo after initial testing"]
│   └── [ActionItemCard: "Set up free Raggy account for testing"]
├── Group: "Website UI" (3 items)  ← collapsible header
│   ├── [ActionItemCard: "Fix website alignment and centering issues"]
│   ├── [ActionItemCard: "Fix CSS grid layout on dashboard"]
│   └── [ActionItemCard: "Update responsive breakpoints"]
├── Group: "Database" (2 items)
│   └── ...
└── Ungrouped (individual cards with no group header)
    ├── [ActionItemCard: "Review Q2 budget"]
    └── [ActionItemCard: "Schedule team sync"]
```

**Group header design:**

Each named group gets a collapsible header bar that looks like this:

```
┌──────────────────────────────────────────┐
│  ▸ Raggy                              2  │  ← collapsed (▸ chevron, group name, item count)
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  ▾ Raggy                              2  │  ← expanded (▾ chevron, group name, item count)
├──────────────────────────────────────────┤
│  [ActionItemCard]                        │
│  [ActionItemCard]                        │
└──────────────────────────────────────────┘
```

- The group header should be styled as a slim bar within a containing `glass-card` wrapper
- Chevron icon: use a simple text character `▸` (collapsed) / `▾` (expanded), or a CSS triangle rotated via transform
- Group label: `text-sm font-semibold text-theme-text-primary`
- Item count: `text-xs text-theme-text-tertiary` aligned right
- The header bar has a subtle background: `bg-theme-bg-overlay/50` or similar
- Clicking anywhere on the header toggles collapse/expand
- The group wrapper has a left border accent to visually tie the items together: `border-l-2 border-brand-500/30` on the containing div
- When collapsed, only the header is visible; the cards are hidden
- Default state: all groups start expanded

**Ungrouped items (group_label === null):** Render directly as individual cards with no group header, after all the named groups. No "Other" label needed — they just appear as loose cards at the bottom of the column.

#### 5c. Add "Smart Group" Button to the Page Header

Add a button next to the existing "+ Add Item" button:

```tsx
<button
    onClick={handleSmartGroup}
    disabled={grouping}
    className="px-5 py-2.5 bg-gradient-to-r from-accent-violet to-purple-600 text-white rounded-xl font-medium text-sm
       hover:from-accent-violet/90 hover:to-purple-500 transition-all duration-200
       shadow-lg shadow-accent-violet/20 hover:shadow-accent-violet/30 disabled:opacity-50"
>
    {grouping ? 'Grouping...' : '✦ Smart Group'}
</button>
```

When clicked:
1. Set `grouping` state to true (disables button, shows "Grouping..." text)
2. Call `POST /api/action-items/group` with `{ force: false }`
3. On success, re-fetch all action items from `GET /api/action-items` to refresh the page
4. Set `grouping` state to false

#### 5d. Add a "View" Toggle: Grouped vs. Flat

Add a small toggle in the filters bar that switches between "Grouped" and "Flat" view:

```tsx
<div className="flex items-center gap-1 bg-theme-bg-overlay/50 rounded-lg p-0.5">
    <button
        onClick={() => setViewMode('grouped')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === 'grouped'
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-theme-text-muted hover:text-theme-text-secondary'
        }`}
    >
        Grouped
    </button>
    <button
        onClick={() => setViewMode('flat')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            viewMode === 'flat'
                ? 'bg-brand-500/20 text-brand-400'
                : 'text-theme-text-muted hover:text-theme-text-secondary'
        }`}
    >
        Flat
    </button>
</div>
```

When `viewMode === 'flat'`, render the columns exactly as they are today (flat list of cards). When `viewMode === 'grouped'` (default), render with the grouping described above.

#### 5e. Allow Manual Group Editing

When a user expands an action item card (clicks to toggle `isExpanded`), add a small editable group label field in the expanded detail section:

```tsx
{isExpanded && (
    <div className="mt-3 pt-3 border-t border-theme-border/[0.06] space-y-3 animate-slide-up">
        {/* Existing: description, source_text, transcript link */}

        {/* NEW: Group label editor */}
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-theme-text-tertiary uppercase tracking-wider">Group:</span>
            <input
                type="text"
                value={editGroupLabel}
                onChange={(e) => setEditGroupLabel(e.target.value)}
                onBlur={() => handleGroupLabelSave(item.id, editGroupLabel)}
                onKeyDown={(e) => e.key === 'Enter' && handleGroupLabelSave(item.id, editGroupLabel)}
                placeholder="Ungrouped"
                className="text-xs text-theme-text-secondary bg-transparent border-b border-theme-border/[0.1]
                           focus:border-brand-500/50 focus:outline-none px-1 py-0.5 w-32 transition-colors"
            />
        </div>
    </div>
)}
```

When the user edits the group label and blurs or presses Enter:
- Call `PATCH /api/action-items/[id]` with `{ group_label: newValue || null }`
- Update local state

### Step 6: Update PATCH Endpoint to Handle group_label

**File:** `apps/web/app/api/action-items/[id]/route.ts`

In the `PATCH` handler, add `group_label` to the list of updatable fields:

```typescript
if (body.group_label !== undefined) update.group_label = body.group_label || null;
```

This is a one-line change in the existing update payload builder.

### Step 7: Update POST Endpoint to Accept group_label

**File:** `apps/web/app/api/action-items/route.ts`

In the `POST` handler's insert object, add:

```typescript
group_label: body.group_label ?? null,
```

And in the create modal (Step 5), optionally add a "Group" text input to the create form. This is low priority — most groups will be assigned by AI.

## Design System Reference

Use these existing classes throughout:
- Cards: `glass-card` (glassmorphism with backdrop blur)
- Inputs: `input-glow` (glow border on focus)
- Badges: `badge-info` (blue), `badge-success` (green), `badge-error` (red), `badge-warning` (amber)
- Text: `text-theme-text-primary`, `text-theme-text-secondary`, `text-theme-text-tertiary`, `text-theme-text-muted`
- Backgrounds: `bg-theme-bg-raised`, `bg-theme-bg-overlay`, `bg-theme-bg-muted`
- Borders: `border-theme-border/[opacity]`
- Brand gradient buttons: `bg-gradient-to-r from-brand-500 to-brand-600`
- Animations: `animate-fade-in`, `animate-slide-up` (already defined in the project)

For the Smart Group button specifically, use the violet accent to differentiate it from the blue primary actions: `from-accent-violet to-purple-600`.

## File Change Summary

| File | Action |
|------|--------|
| `supabase/migrations/003_action_item_groups.sql` | **CREATE** — Add `group_label` column |
| `packages/shared/src/types.ts` | **EDIT** — Add `group_label: string \| null` to `ActionItem` |
| `apps/web/app/api/action-items/group/route.ts` | **CREATE** — AI grouping endpoint |
| `apps/web/app/api/action-items/extract/route.ts` | **EDIT** — Include `group_label` in extraction prompt and inserts |
| `apps/web/app/api/action-items/[id]/route.ts` | **EDIT** — Allow `group_label` in PATCH updates |
| `apps/web/app/api/action-items/route.ts` | **EDIT** — Allow `group_label` in POST creates |
| `apps/web/app/action-items/page.tsx` | **EDIT** — Main UI changes: grouped rendering, Smart Group button, view toggle, manual group editing |

## Do NOT

- Do NOT add any npm dependencies — this is all achievable with React, Tailwind, and the existing stack
- Do NOT change the Kanban column structure (Open / In Progress / Done) — grouping happens WITHIN each column
- Do NOT modify any other pages (dashboard, transcripts, ask AI, logs)
- Do NOT create a separate "groups" database table — `group_label` is a flat text field on each action item, kept deliberately simple
- Do NOT use drag-and-drop for moving items between groups — that's a future enhancement
- Do NOT break existing functionality — all filters, search, create, status transitions, dismiss, and expand/collapse on individual cards must continue working exactly as they do now
