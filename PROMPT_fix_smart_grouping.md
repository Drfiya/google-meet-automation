# Prompt: Fix Smart Grouping — Action Items Not Being Grouped

Copy everything below this line and paste it into Claude in Antigravity.

---

## Problem

The Action Items page has a "Smart Group" button and a Grouped/Flat toggle, but all 94 action items appear as individual ungrouped cards. No collapsible group headers are visible. The grouped view looks identical to the flat view because every item has `group_label = NULL` in the database.

## Root Cause Investigation

There are three things that need to be verified and fixed, in order:

### Issue 1: Database Migration May Not Be Applied

The file `supabase/migrations/003_action_item_groups.sql` adds the `group_label` column:

```sql
ALTER TABLE action_items ADD COLUMN group_label TEXT;
CREATE INDEX idx_action_items_group ON action_items(group_label);
```

**This migration may not have been run against the live Supabase database.** Supabase migrations in local files don't auto-apply — they must be pushed manually.

**Fix:** Go to the Supabase dashboard SQL editor (or use the Supabase CLI) and run this migration. You can safely run:

```sql
-- Check if column exists first
SELECT column_name FROM information_schema.columns
WHERE table_name = 'action_items' AND column_name = 'group_label';

-- If no rows returned, the column is missing. Add it:
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS group_label TEXT;
CREATE INDEX IF NOT EXISTS idx_action_items_group ON action_items(group_label);
```

### Issue 2: The `handleSmartGroup` Has a Timing Bug

In `apps/web/app/action-items/page.tsx`, the current code is:

```typescript
const handleSmartGroup = async () => {
    setGrouping(true);
    try {
        await fetch('/api/action-items/group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: false }),
        });
        fetchItems();  // ← fire-and-forget, not awaited
    } catch { /* silently fail */ }
    setGrouping(false);  // ← runs before fetchItems completes
};
```

The problems:
1. `fetchItems()` is not awaited, so `setGrouping(false)` runs immediately while data is still being fetched.
2. The group API response is not checked for errors — if Claude returns an error or the column doesn't exist, it fails silently.
3. If `force: false` finds 0 items to group (because all items already have group_label = NULL, which paradoxically means they DO need grouping, and they DO get sent to Claude — so this isn't actually the issue), the response is just `{ message: 'Grouping complete', updated: N }`.

**Fix:** Rewrite `handleSmartGroup` and `fetchItems` to be properly async:

```typescript
const fetchItems = async () => {
    try {
        const r = await fetch('/api/action-items');
        const data = await r.json();
        if (Array.isArray(data)) setItems(data);
    } catch {
        // silently fail
    } finally {
        setLoading(false);
    }
};

const handleSmartGroup = async () => {
    setGrouping(true);
    try {
        const res = await fetch('/api/action-items/group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),  // ← force: true to assign groups to ALL items
        });
        const result = await res.json();
        console.log('[Smart Group]', result);  // Debug: see how many items were updated

        if (res.ok) {
            await fetchItems();  // ← AWAIT the refresh
        }
    } catch (err) {
        console.error('[Smart Group] Error:', err);
    } finally {
        setGrouping(false);
    }
};
```

**Key change:** Use `force: true` instead of `force: false`. The `force: false` path only groups items where `group_label IS NULL`, which is correct for the first run. But since these items have never been grouped before, `force: true` ensures Claude sees ALL items together (not just a subset) so it can form better group clusters. After the initial grouping, subsequent clicks with `force: false` would only group newly added items.

Actually, a better UX: change the button behavior so the first click always uses `force: true`, and add a subtle "Re-group All" option. But for now, just switching to `force: true` will fix the immediate issue.

### Issue 3: The API GET Route May Not Return `group_label`

In `apps/web/app/api/action-items/route.ts`, the GET handler does:

```typescript
const { data, error } = await query;
return NextResponse.json(data ?? []);
```

This returns the raw Supabase rows directly. If the `group_label` column exists in the database, Supabase will include it automatically in `SELECT *`. If the column DOESN'T exist, the field will simply be absent from the returned JSON, and the frontend will read `item.group_label` as `undefined`, which is treated as `null`.

**No code change needed here** — this works correctly as long as Issue 1 is fixed (the column exists).

## Step-by-Step Fix

### Step 1: Verify and Apply the Database Migration

Open the Supabase SQL editor and run:

```sql
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS group_label TEXT;
CREATE INDEX IF NOT EXISTS idx_action_items_group ON action_items(group_label);
```

### Step 2: Fix the `handleSmartGroup` Function

**File:** `apps/web/app/action-items/page.tsx`

Replace the existing `fetchItems` function (lines ~53-61):

```typescript
const fetchItems = async () => {
    try {
        const r = await fetch('/api/action-items');
        const data = await r.json();
        if (Array.isArray(data)) setItems(data);
    } catch {
        // silently fail
    } finally {
        setLoading(false);
    }
};
```

Replace the existing `handleSmartGroup` function (lines ~184-195):

```typescript
const handleSmartGroup = async () => {
    setGrouping(true);
    try {
        const res = await fetch('/api/action-items/group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),
        });
        const result = await res.json();

        if (!res.ok) {
            console.error('[Smart Group] API error:', result);
            return;
        }

        console.log(`[Smart Group] Grouped ${result.updated} items`);
        await fetchItems();
    } catch (err) {
        console.error('[Smart Group] Error:', err);
    } finally {
        setGrouping(false);
    }
};
```

Update the `useEffect` that calls `fetchItems` on mount (lines ~63-65). Since `fetchItems` is now async, call it the same way:

```typescript
useEffect(() => {
    fetchItems();
}, []);
```

This is fine — calling an async function from `useEffect` without awaiting is the standard React pattern (the promise is fire-and-forget on mount, which is correct here).

### Step 3: Increase Claude's Token Limit for 94 Items

The grouping endpoint sends all 94 action items to Claude. With 94 items, the request payload is large. Check that the `max_tokens` in `apps/web/app/api/action-items/group/route.ts` is sufficient:

```typescript
body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,  // ← increase from 4096 to handle 94 items
    system: systemPrompt,
    messages: [
        {
            role: 'user',
            content: JSON.stringify(itemsPayload),
        },
    ],
}),
```

94 items × ~50 chars per ID + label ≈ ~5000 chars output. The 4096 token limit might be tight. Bump to 8192 to be safe.

### Step 4: Test

1. Click the "✦ Smart Group" button
2. Wait for the "Grouping..." state to complete
3. Open browser DevTools console — you should see `[Smart Group] Grouped N items` where N > 0
4. The action items should now appear in collapsible groups with headers like "Raggy", "Website UI", etc.
5. Toggle the Grouped/Flat switch to verify both views work
6. Click a group header to collapse/expand it

### Step 5: (Optional) Add Error Feedback in the UI

Right now if the grouping API fails, it fails silently. Consider adding a brief toast or inline error message. A simple approach:

```typescript
const [groupError, setGroupError] = useState<string | null>(null);

const handleSmartGroup = async () => {
    setGrouping(true);
    setGroupError(null);
    try {
        const res = await fetch('/api/action-items/group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true }),
        });
        const result = await res.json();

        if (!res.ok) {
            setGroupError(result.error || 'Grouping failed');
            return;
        }

        await fetchItems();
    } catch {
        setGroupError('Network error — could not reach grouping API');
    } finally {
        setGrouping(false);
    }
};
```

Then render below the button:
```tsx
{groupError && (
    <p className="text-xs text-rose-400 mt-2">{groupError}</p>
)}
```

## Summary of Changes

| File | Change |
|------|--------|
| Supabase SQL editor | Run `ALTER TABLE action_items ADD COLUMN IF NOT EXISTS group_label TEXT;` |
| `apps/web/app/action-items/page.tsx` | Fix `fetchItems` to be async; fix `handleSmartGroup` to await refresh and use `force: true`; add error logging |
| `apps/web/app/api/action-items/group/route.ts` | Increase `max_tokens` from 4096 to 8192 |

## Do NOT

- Do NOT modify the grouping API logic, Claude prompt, or database schema — those are correct
- Do NOT change the Kanban column structure or grouped rendering logic — that code is correct and will work once items have `group_label` values
- Do NOT touch the worker service or any other pages
