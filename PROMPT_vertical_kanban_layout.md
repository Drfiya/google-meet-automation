# Prompt: Restack Kanban Board — Vertical Layout (Top-to-Bottom)

Copy everything below this line and paste it into Claude in Antigravity.

---

## Goal

Change the Action Items Kanban board from a **3-column horizontal layout** (Open | In Progress | Done side-by-side) to a **vertical stacked layout** (Open on top, then In Progress, then Done) so there is no wasted empty space when columns have few or no items.

## File to Modify

**`apps/web/app/action-items/page.tsx`** — this is the ONLY file that needs changes.

## Current Layout (What to Change)

On line **333**, the Kanban board uses a 3-column grid:

```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
```

This creates three equal-width columns on medium+ screens. When "In Progress" has 0 items and "Done" has 0 items, there are two large empty columns taking up 2/3 of the screen.

## Desired Layout

Stack all three status sections **vertically** (top to bottom), each taking the **full width** of the page. Within each section, the action item cards should flow in a **responsive multi-column grid** so that cards fill the horizontal space efficiently.

### Visual Structure

```
┌──────────────────────────────────────────────────┐
│  ● Open (47)                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │  Card 1  │  │  Card 2  │  │  Card 3  │         │
│  └─────────┘  └─────────┘  └─────────┘          │
│  ┌─────────┐  ┌─────────┐                        │
│  │  Card 4  │  │  Card 5  │                       │
│  └─────────┘  └─────────┘                        │
├──────────────────────────────────────────────────┤
│  ● In Progress (2)                               │
│  ┌─────────┐  ┌─────────┐                        │
│  │  Card 6  │  │  Card 7  │                       │
│  └─────────┘  └─────────┘                        │
├──────────────────────────────────────────────────┤
│  ● Done (0)                                      │
│  No items                                        │
└──────────────────────────────────────────────────┘
```

## Exact Changes

### Change 1: Replace the outer grid (line 333)

**Before:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
```

**After:**
```tsx
<div className="space-y-6">
```

This stacks the three status sections vertically with consistent spacing.

### Change 2: Restructure each column section (lines 338–434)

The current structure is:

```tsx
<div key={col.key} className="flex flex-col">
    {/* Column Header */}
    <div className="glass-card p-4 mb-3 ...">...</div>
    {/* Cards */}
    <div className="space-y-3 flex-1">
        {/* cards rendered vertically */}
    </div>
</div>
```

Replace it with:

```tsx
<div key={col.key}>
    {/* Section Header */}
    <div className="glass-card p-4 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${col.color}`} />
            <h3 className="text-sm font-semibold text-theme-text-primary">{col.label}</h3>
        </div>
        <span className="text-xs text-theme-text-tertiary font-medium">{colItems.length}</span>
    </div>

    {/* Cards — responsive grid */}
    {colItems.length === 0 ? (
        <div className="p-6 text-center text-xs text-theme-text-muted border border-dashed border-theme-border/[0.08] rounded-2xl">
            No items
        </div>
    ) : viewMode === 'flat' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {colItems.map((item) => (
                <ActionItemCard
                    key={item.id}
                    item={item}
                    isOverdue={isOverdue(item)}
                    isExpanded={expandedId === item.id}
                    onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onStatusChange={updateStatus}
                    onDismiss={dismissItem}
                    onGroupLabelSave={handleGroupLabelSave}
                />
            ))}
        </div>
    ) : (
        <div className="space-y-3">
            {groups.map((group) => {
                if (group.label === null) {
                    // Ungrouped items — render in a responsive grid
                    return (
                        <div key="ungrouped" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.items.map((item) => (
                                <ActionItemCard
                                    key={item.id}
                                    item={item}
                                    isOverdue={isOverdue(item)}
                                    isExpanded={expandedId === item.id}
                                    onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                    onStatusChange={updateStatus}
                                    onDismiss={dismissItem}
                                    onGroupLabelSave={handleGroupLabelSave}
                                />
                            ))}
                        </div>
                    );
                }

                const groupKey = `${col.key}::${group.label}`;
                const isCollapsed = collapsedGroups.has(groupKey);

                return (
                    <div key={groupKey} className="border-l-2 border-brand-500/30 rounded-xl overflow-hidden">
                        {/* Group header */}
                        <button
                            onClick={() => toggleGroup(groupKey)}
                            className="w-full flex items-center justify-between px-4 py-2.5
                                bg-theme-bg-overlay/50 hover:bg-theme-bg-overlay/70
                                transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="text-xs text-theme-text-muted transition-transform duration-200"
                                    style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                                >
                                    &#9654;
                                </span>
                                <span className="text-sm font-semibold text-theme-text-primary">{group.label}</span>
                            </div>
                            <span className="text-xs text-theme-text-tertiary">{group.items.length}</span>
                        </button>

                        {/* Group items — responsive grid inside the group */}
                        {!isCollapsed && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-2 pt-2">
                                {group.items.map((item) => (
                                    <ActionItemCard
                                        key={item.id}
                                        item={item}
                                        isOverdue={isOverdue(item)}
                                        isExpanded={expandedId === item.id}
                                        onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                        onStatusChange={updateStatus}
                                        onDismiss={dismissItem}
                                        onGroupLabelSave={handleGroupLabelSave}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    )}
</div>
```

## Key Design Decisions

1. **Outer layout:** `space-y-6` stacks the three status sections vertically — no more side-by-side columns.
2. **Cards grid:** Within each section, cards use `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` so they tile responsively across the full width. On mobile they stack, on tablets they show 2 across, on desktop 3 across.
3. **Grouped view:** Named groups still have the collapsible header with the left border accent. Inside each group, the cards also use the responsive grid (not a single-column stack).
4. **Empty sections:** "No items" placeholder is full-width when a status has 0 items — takes minimal vertical space.

## What NOT to Change

- Do NOT modify any state variables, hooks, or filter logic
- Do NOT change the `ActionItemCard` component
- Do NOT change the `FilterSelect` component
- Do NOT modify the create modal
- Do NOT change the header section (Smart Group button, Add Item button)
- Do NOT change the filters bar
- Do NOT modify any API calls, `fetchItems`, `handleSmartGroup`, `updateStatus`, `dismissItem`, `handleCreate`, or `handleGroupLabelSave`
- Do NOT touch any other files

## Testing

1. Load the Action Items page — sections should stack vertically (Open on top, In Progress below, Done at bottom)
2. Cards within each section should tile in a multi-column grid (2-3 columns depending on screen width)
3. Toggle Grouped/Flat — both views should render correctly with the new layout
4. Collapse/expand a group — the group's cards should appear in the responsive grid
5. Resize the browser window — cards should reflow from 3 columns → 2 columns → 1 column
6. The "No items" placeholder should appear full-width for empty sections
7. All card interactions (expand, status change, dismiss, group label edit) should still work
