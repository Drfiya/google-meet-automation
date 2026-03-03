# Prompt: Reskin MeetScript → ScienceExperts.ai Branding

Copy everything below this line and paste it into Claude in Antigravity.

---

## Goal

Reskin the MeetScript transcript-pipeline app to match the **ScienceExperts.ai** brand identity exactly. The app must support **both light and dark mode** with a user-togglable theme switcher. Preserve all existing functionality — this is a visual/branding change only.

The ScienceExperts.ai design language is **flat, clean, and minimal** — no glassmorphism, no backdrop-blur, no gradient borders. Cards are solid-color with subtle borders and `shadow-sm`. The primary accent color is **red/coral (`#D94A4A`)**, not blue.

## Architecture Context

- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5.5
- **Styling:** Tailwind CSS 3.4.13, class-based dark mode (`darkMode: 'class'`)
- **Monorepo:** Turbo — frontend lives in `apps/web/`
- **Auth/DB:** Supabase
- **No external UI library** — all components are custom Tailwind

### Key Files to Modify

| Purpose | Path |
|---------|------|
| Tailwind config (colors, fonts, animations) | `apps/web/tailwind.config.js` |
| CSS variables + component classes | `apps/web/app/globals.css` |
| Root layout + theme script | `apps/web/app/layout.tsx` |
| Theme context & provider | `apps/web/lib/theme.tsx` |
| Sidebar (nav, branding, footer) | `apps/web/components/sidebar.tsx` |
| Theme toggle button | `apps/web/components/theme-toggle.tsx` |
| Dashboard page | `apps/web/app/page.tsx` |
| Calendar page | `apps/web/app/calendar/page.tsx` |
| Transcripts list | `apps/web/app/transcripts/page.tsx` |
| Transcript detail | `apps/web/app/transcripts/[id]/page.tsx` |
| Action items (Kanban) | `apps/web/app/action-items/page.tsx` |
| Ask AI page | `apps/web/app/ask/page.tsx` |
| Logs page | `apps/web/app/logs/page.tsx` |
| Upload modal | `apps/web/components/upload-modal.tsx` |

## ScienceExperts.ai Brand Identity (Extracted from Source Repo)

**Tagline:** "One World. Every Voice. Your Language."

**Brand personality:** Professional, scientific, inclusive, modern. Clean flat design — minimal shadows, solid backgrounds, clear hierarchy.

**Logo:** ScienceExperts.ai logo from Supabase storage:
```
https://rgltabjdjrbmbjrjoqga.supabase.co/storage/v1/object/public/community-assets/community-logo-1772070053980.png
```

### Exact Color System (from ScienceExperts.ai source)

These are the **exact** hex values from the ScienceExperts.ai production codebase. Apply them precisely.

#### Primary Accent — Red/Coral (CTA buttons, progress bars, "Post"/"Publish" actions)
```
Primary:       #D94A4A
Primary Hover: #C43E3E
```

#### Semantic Colors
```
Destructive:   #ef4444   (errors, delete actions)
Success:       #22c55e   (completed, positive states)
Blue Accent:   #3b82f6   (informational badges, links)
```

#### Category Dot Colors (used in navigation/filter pills)
```
Announcements: #ef4444   (red)
Introductions: #22c55e   (green)
Questions:     #3b82f6   (blue)
General:       #6b7280   (gray)
```

#### Light Mode Palette
```css
/* CSS Variables for :root */
--color-background:         248 249 250;    /* #f8f9fa — page background */
--color-foreground:          31 41 55;      /* #1f2937 — primary text */
--color-primary:             31 41 55;      /* #1f2937 — primary UI elements */
--color-primary-foreground: 255 255 255;    /* #ffffff — text on primary */
--color-secondary:          107 114 128;    /* #6b7280 — secondary text */
--color-muted:              243 244 246;    /* #f3f4f6 — muted backgrounds */
--color-muted-foreground:   107 114 128;    /* #6b7280 — muted text */
--color-border:             229 231 235;    /* #e5e7eb — borders */
--color-card:               255 255 255;    /* #ffffff — card backgrounds */
--color-card-border:        229 231 235;    /* #e5e7eb — card borders */
```

#### Dark Mode Palette
```css
/* CSS Variables for .dark */
--color-background:          10 10 10;      /* #0a0a0a — page background */
--color-foreground:         229 229 229;    /* #e5e5e5 — primary text */
--color-primary:            229 229 229;    /* #e5e5e5 — primary UI elements */
--color-primary-foreground:  10 10 10;      /* #0a0a0a — text on primary */
--color-secondary:          163 163 163;    /* #a3a3a3 — secondary text */
--color-muted:               23 23 23;      /* #171717 — muted backgrounds */
--color-muted-foreground:   163 163 163;    /* #a3a3a3 — muted text */
--color-border:              38 38 38;      /* #262626 — borders */
--color-card:                31 41 55;      /* #1f2937 — card backgrounds (neutral-800) */
--color-card-border:         38 38 38;      /* #262626 — card borders (neutral-700) */
```

### Typography

**Keep Inter** as the primary font — ScienceExperts.ai uses Inter. Do NOT change to DM Sans or Space Grotesk. Keep JetBrains Mono for monospace.

```js
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
},
```

#### Font Weights Used
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

#### Font Sizes
- Page titles: `text-2xl` to `text-4xl` (fluid: `clamp(2.25rem, 5vw, 3.75rem)` for hero)
- Section headings: `text-xl` / `text-lg`
- Body: `text-base` / `text-sm`
- Small/caption: `text-xs`

### Border Radius
```
Default:     rounded-xl    (16px)  — cards, modals
Buttons:     rounded-md    (6px)   — standard buttons
Pill:        rounded-full  (9999px) — nav tabs, category filters, CTA buttons
Input:       rounded-lg    (8px)
Small:       rounded-lg    (8px)   — comment cards, inner elements
```

## Detailed Changes by File

### 1. `tailwind.config.js`

Replace the **entire** `brand` color ramp. The primary brand is now a neutral dark gray for structural elements, with `#D94A4A` as the accent/CTA color:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ScienceExperts.ai brand palette
        brand: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#e05a5a',
          500: '#D94A4A',   // PRIMARY ACCENT — CTA buttons, active states
          600: '#C43E3E',   // Hover state
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        surface: {
          DEFAULT: '#0a0a0a',
          raised:  '#1f2937',
          overlay: '#171717',
          muted:   '#262626',
        },
        accent: {
          teal:    '#06b6d4',
          violet:  '#8b5cf6',
          amber:   '#f59e0b',
          rose:    '#ef4444',
          emerald: '#22c55e',
          blue:    '#3b82f6',
        },
        // Semantic theme tokens backed by CSS variables
        theme: {
          base:    'rgb(var(--color-background) / <alpha-value>)',
          raised:  'rgb(var(--color-card) / <alpha-value>)',
          overlay: 'rgb(var(--color-muted) / <alpha-value>)',
          muted:   'rgb(var(--color-muted) / <alpha-value>)',
        },
        'theme-text': {
          primary:   'rgb(var(--color-foreground) / <alpha-value>)',
          secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
          tertiary:  'rgb(var(--color-secondary) / <alpha-value>)',
          muted:     'rgb(var(--color-muted-foreground) / <alpha-value>)',
        },
        'theme-border': 'rgb(var(--color-border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.5s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
```

### 2. `globals.css` — Complete Rewrite

Replace the entire `globals.css` with the ScienceExperts.ai flat design system. **Remove all glassmorphism (`backdrop-blur`, transparent backgrounds, `glass-card`) and replace with clean flat cards.**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* ── Light theme (default) ── */
  :root {
    --color-background:         248 249 250;
    --color-foreground:          31  41  55;
    --color-primary:             31  41  55;
    --color-primary-foreground: 255 255 255;
    --color-secondary:          107 114 128;
    --color-muted:              243 244 246;
    --color-muted-foreground:   107 114 128;
    --color-border:             229 231 235;
    --color-card:               255 255 255;
    --color-card-border:        229 231 235;
    --color-destructive:        239  68  68;
    --color-success:             34 197  94;

    --shadow-opacity-sm: 0.05;
    --shadow-opacity-lg: 0.1;
  }

  /* ── Dark theme ── */
  .dark {
    --color-background:          10  10  10;
    --color-foreground:         229 229 229;
    --color-primary:            229 229 229;
    --color-primary-foreground:  10  10  10;
    --color-secondary:          163 163 163;
    --color-muted:               23  23  23;
    --color-muted-foreground:   163 163 163;
    --color-border:              38  38  38;
    --color-card:                31  41  55;
    --color-card-border:         38  38  38;
    --color-destructive:        239  68  68;
    --color-success:             34 197  94;

    --shadow-opacity-sm: 0;
    --shadow-opacity-lg: 0;
  }

  * {
    border-color: rgb(var(--color-border));
  }

  body {
    background-color: rgb(var(--color-background));
    color: rgb(var(--color-foreground));
    @apply antialiased;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
}

@layer components {
  /*
   * FLAT CARD — replaces the old .glass-card
   * Clean solid background, subtle border, minimal shadow.
   * Matches ScienceExperts.ai post-card styling exactly.
   */
  .glass-card {
    background-color: rgb(var(--color-card));
    border: 1px solid rgb(var(--color-card-border));
    box-shadow: 0 1px 2px rgb(0 0 0 / var(--shadow-opacity-sm));
    @apply rounded-xl transition-all duration-200;
  }
  .glass-card:hover {
    box-shadow: 0 4px 6px rgb(0 0 0 / var(--shadow-opacity-lg));
  }

  /* Stat card — flat version with colored top accent */
  .stat-card {
    @apply glass-card p-6 relative overflow-hidden;
  }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: #D94A4A;
  }

  /* Input fields — flat, clean borders */
  .input-glow {
    background-color: rgb(var(--color-card));
    border: 1px solid rgb(var(--color-border));
    color: rgb(var(--color-foreground));
    @apply rounded-lg px-4 py-3
           focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20
           transition-all duration-200;
  }
  .input-glow::placeholder {
    color: rgb(var(--color-muted-foreground));
  }

  /* Table rows */
  .table-row {
    border-bottom: 1px solid rgb(var(--color-border) / 0.5);
    @apply transition-colors duration-150 cursor-pointer;
  }
  .table-row:hover {
    background-color: rgb(var(--color-muted));
  }

  /* Badge styles */
  .badge {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
  }
  .badge-success {
    @apply badge bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20;
  }
  .badge-error {
    @apply badge bg-red-500/10 text-red-600 dark:text-red-400 ring-1 ring-red-500/20;
  }
  .badge-warning {
    @apply badge bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20;
  }
  .badge-info {
    @apply badge bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20;
  }

  /* Primary CTA button — red/coral pill */
  .btn-primary {
    background-color: #D94A4A;
    color: #ffffff;
    @apply rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide
           shadow-sm transition-colors duration-200;
  }
  .btn-primary:hover {
    background-color: #C43E3E;
  }
  .btn-primary:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  /* Pill-shaped navigation tabs */
  .nav-pill {
    @apply rounded-full px-4 py-2 text-sm font-medium transition-colors;
  }
  .nav-pill-active {
    @apply nav-pill bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100;
  }
  .nav-pill-inactive {
    @apply nav-pill text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800;
  }

  /* Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    @apply bg-transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgb(var(--color-border));
    @apply rounded-full;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgb(var(--color-secondary));
  }
}
```

### 3. `sidebar.tsx`

**Replace the brand section** (the "MT" gradient badge + "MeetScript" text):

```tsx
{/* Brand */}
<div className="p-6 border-b border-theme-border">
  <div className="flex items-center gap-3">
    <img
      src="https://rgltabjdjrbmbjrjoqga.supabase.co/storage/v1/object/public/community-assets/community-logo-1772070053980.png"
      alt="ScienceExperts.ai"
      className="w-9 h-9 rounded-lg object-contain"
    />
    <div>
      <h1 className="text-sm font-bold text-theme-text-primary tracking-tight">
        ScienceExperts
      </h1>
      <p className="text-[11px] text-theme-text-secondary font-medium">
        Transcript Pipeline
      </p>
    </div>
  </div>
</div>
```

**Remove all `backdrop-blur` and semi-transparent backgrounds** from the sidebar container. Replace with:
```tsx
className="fixed left-0 top-0 bottom-0 w-64 z-50 bg-theme-raised border-r border-theme-border"
```

**Update nav active-state styling** — replace any `bg-brand-500/10 text-brand-400` with the new pill-style:
```tsx
// Active item:
className="nav-pill-active"
// Inactive item:
className="nav-pill-inactive"
```

Or if you prefer inline Tailwind (to match the existing pattern):
- **Active:** `bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 rounded-full`
- **Inactive:** `text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 rounded-full`

**Update the sidebar footer:**
```tsx
<p className="text-[11px] text-theme-text-muted text-center mt-2">
  ScienceExperts.ai — Powered by 3rd AI LLC
</p>
```

**Remove the gradient badge** on the brand logo. Replace with a simple wrapper or remove entirely — the ScienceExperts logo is already styled. No gradient badges are used in the ScienceExperts.ai design.

### 4. `layout.tsx`

- Update metadata:
  ```tsx
  <title>ScienceExperts.ai — Transcript Pipeline</title>
  <meta name="description" content="Where researchers, scientists, and innovators connect, learn, and grow together." />
  ```
- Keep the Inter font preconnect. Remove any other font preconnects if added previously.
- The inline `<script>` for FOUC prevention stays the same.

### 5. `theme-toggle.tsx`

- Keep the Sun/Moon icon toggle.
- ScienceExperts.ai uses a similar toggle (visible in the screenshots in the top nav bar).
- Update hover/focus: `hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full`
- Migrate the localStorage key from `'meetscript-theme'` to `'scienceexperts-theme'`.

### 6. All Page Components

Apply these changes **consistently** across every page:

- **Remove `backdrop-blur-xl`** and any `bg-*/60` (semi-transparent) backgrounds. Replace with solid `bg-theme-raised` or `bg-white dark:bg-neutral-800`.
- **Replace "MeetScript" text** with "ScienceExperts" everywhere it appears in the UI.
- **Stat card accent bars**: Change from gradient to solid `#D94A4A` (already handled by the `.stat-card::before` update).
- **Any blue brand references** (`text-brand-400`, `bg-brand-500/10`, etc.): These now map to the red/coral palette via the Tailwind config update. Verify visually that the red looks correct for each usage. For informational elements that should stay blue, use `text-accent-blue` or `text-blue-500` directly.
- **Buttons**: Any "primary action" button (submit, upload, save) should use the `.btn-primary` class or inline `bg-brand-500 hover:bg-brand-600 text-white rounded-full`.
- **Hardcoded hex values**: Grep for `#338bff`, `#1b6af5`, `#1454e1`, `#0a0f1e`, `#111827`, `#1a2236` and replace with Tailwind token equivalents.

### 7. Upload Modal (`upload-modal.tsx`)

- Replace any glassmorphism backdrop with `bg-black/50` (standard modal overlay).
- Modal card: `bg-white dark:bg-neutral-800 rounded-xl border border-gray-100 dark:border-neutral-700 shadow-xl`
- Upload/submit button: use `.btn-primary` (red/coral pill).

### 8. Favicon and Metadata

- Update favicon to use the ScienceExperts logo.
- Update OG tags with ScienceExperts branding and description.

## Theme Toggle Requirements

The app already has a working dark/light toggle. Ensure:

1. **Default theme**: `"system"` (respects OS preference, same as ScienceExperts.ai).
2. **Toggle behavior**: Click the Sun/Moon button in the sidebar footer.
3. **Persistence**: `localStorage` key `'scienceexperts-theme'`.
4. **System preference**: Falls back to `prefers-color-scheme` if no stored value.
5. **No FOUC**: The inline `<script>` in `layout.tsx` sets the `dark` class before React hydrates.
6. **Transition**: `transition: background-color 0.2s ease, color 0.2s ease` on `body`.
7. **Both modes must look polished**: Light mode = clean white cards on light gray bg. Dark mode = dark gray cards on near-black bg. Both must have proper contrast (WCAG AA: 4.5:1 body, 3:1 large text).

## Critical Design Principles (from ScienceExperts.ai)

1. **FLAT, NOT GLASSY** — No `backdrop-blur`, no semi-transparent card backgrounds, no gradient borders. Solid colors only.
2. **MINIMAL SHADOWS** — `shadow-sm` for cards (light mode only), `shadow-xl` for modals. Dark mode has near-zero shadows.
3. **RED/CORAL IS THE ACCENT** — `#D94A4A` for primary CTAs, progress bars, and active highlights. NOT blue.
4. **PILL-SHAPED INTERACTIONS** — Navigation tabs, CTA buttons, and category filters use `rounded-full`.
5. **NEUTRAL STRUCTURE** — The structural UI (text, borders, backgrounds) is gray/neutral. Color is reserved for accents and interactive elements.
6. **CLEAN BORDERS** — Cards use `border border-gray-100 dark:border-neutral-700`. Subtle, not invisible.

## Constraints

- **Do NOT** change any business logic, API routes, database queries, or TypeScript types.
- **Do NOT** add new npm dependencies. Inter is already loaded via Google Fonts CSS import.
- **Do NOT** remove existing Tailwind utility classes from component markup unless replacing with updated equivalents.
- **Do NOT** restructure the file/folder layout.
- Preserve all existing animations and micro-interactions.
- Ensure all text passes WCAG AA contrast in both light and dark mode.

## Implementation Order

1. `globals.css` — replace CSS variables + component classes (biggest change)
2. `tailwind.config.js` — replace color ramps, keep fonts and animations
3. `sidebar.tsx` — swap brand logo/text, remove glassmorphism, update nav states
4. `layout.tsx` — update metadata
5. `theme-toggle.tsx` — update localStorage key + hover styles
6. Page components (dashboard → calendar → transcripts → action-items → ask → logs) — remove glassmorphism, update to flat cards, replace "MeetScript" text
7. `upload-modal.tsx` — flat modal styling
8. Test both light and dark modes end-to-end

## Verification Checklist

After implementation, confirm:

- [ ] ScienceExperts.ai logo renders in sidebar (not "MT" gradient badge)
- [ ] Brand name reads "ScienceExperts" (not "MeetScript") everywhere
- [ ] Footer reads "ScienceExperts.ai — Powered by 3rd AI LLC"
- [ ] Default theme respects system preference
- [ ] Light mode: white cards on `#f8f9fa` background, subtle `#e5e7eb` borders
- [ ] Dark mode: `#1f2937` cards on `#0a0a0a` background, `#262626` borders
- [ ] Primary CTA buttons are red/coral `#D94A4A` with pill shape
- [ ] No glassmorphism remains (no `backdrop-blur`, no semi-transparent `bg-*/60` backgrounds)
- [ ] Navigation uses pill-shaped tabs (`rounded-full`)
- [ ] Text uses Inter font throughout
- [ ] All badge colors work: success (green), error (red), warning (amber), info (blue)
- [ ] No remaining references to "MeetScript" in visible UI text
- [ ] No hardcoded old hex values (`#338bff`, `#0a0f1e`, etc.)
- [ ] Cards use `shadow-sm` in light mode, near-zero shadow in dark mode
- [ ] Page transitions / fade-in animations still fire
- [ ] Upload modal has flat styling (not glassy)
- [ ] Browser tab title reads "ScienceExperts.ai — Transcript Pipeline"
- [ ] Both themes pass WCAG AA contrast requirements
