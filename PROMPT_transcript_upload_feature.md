# Prompt: Add Transcript File Upload Feature to MeetScript

Copy everything below this line and paste it into Claude in Antigravity.

---

## Task

Add a transcript file upload feature to the MeetScript dashboard so that users can manually upload `.txt`, `.vtt`, or `.sbv` transcript files and have them fully ingested into the database — chunked, embedded, and searchable via the existing RAG pipeline.

## Architecture Context

This is a Turborepo monorepo with these workspaces:

- `apps/web` — Next.js 14 (App Router) dashboard running on `localhost:3002`
- `apps/worker` — Express.js worker that handles Gmail pipeline processing
- `packages/shared` — Shared TypeScript interfaces (`types.ts`)
- `supabase/migrations/` — Database schema (PostgreSQL + pgvector via Supabase)

**Key constraint:** The worker runs as a separate service on Cloud Run and is NOT directly accessible from the web dashboard at runtime. Therefore, the upload processing pipeline must run server-side within the `apps/web` Next.js API routes (using Route Handlers), NOT by calling the worker. The good news is that the chunking, embedding, and normalization logic used by the worker can be extracted and reused.

## Existing Code You Must Reuse

The worker already has all the processing building blocks. You need to reuse these exact modules (or copy their logic into the web app) rather than reimplementing from scratch:

### 1. File Parsers (`apps/worker/src/extraction/parsers.ts`)
Already exports:
- `parseVtt(raw: string): string` — Strips WebVTT timecodes, extracts `<v Speaker>` tags, outputs `"Speaker: text"` lines
- `parseSbv(raw: string): string` — Strips SBV timecodes, preserves text lines
- `.txt` files need no parsing — raw text passthrough

### 2. Normalization (`apps/worker/src/extraction/normalize.ts`)
Already exports:
- `extractMeetingTitle(subject: string): string` — Strips "Notes from" / "Transcript for" prefixes
- `extractParticipants(text: string): string[]` — Regex finds `"Speaker Name: text"` patterns
- `generateTranscriptId(title: string, date: Date): string` — Creates `YYYY-MM-DD_slug` IDs
- `normalizeTranscript(params)` — Builds the full `MeetingTranscript` object. Note: this function currently expects an `emailId` param for `source_email_id`. For uploads, you'll need to generate a synthetic source ID like `upload_<timestamp>_<random>` instead.

### 3. Chunker (`apps/worker/src/chunking/chunker.ts`)
Already exports:
- `chunkTranscript(text: string): TextChunk[]` — Multi-level split (speaker turns → paragraphs → sentences) with ~2000 char chunks and ~400 char overlap

### 4. Embedder (`apps/worker/src/embedding/embedder.ts`)
Already exports:
- `generateEmbeddings(texts: string[]): Promise<number[][]>` — Batched OpenAI `text-embedding-3-small` with exponential backoff retry
- BUT this imports `config` from the worker's config module which validates worker-specific env vars. You'll need to create a standalone version for the web app that uses `process.env.OPENAI_API_KEY` directly.

### 5. Database Queries (`apps/worker/src/db/queries.ts`)
Already exports:
- `insertTranscript(transcript: MeetingTranscript): Promise<void>`
- `insertChunks(chunks: TranscriptChunk[]): Promise<void>`
- `logProcessing(params): Promise<void>`
- BUT these use the worker's Supabase client. The web app has its own at `apps/web/lib/supabase.ts` via `getServerSupabase()`. You'll need to replicate the insert logic using the web app's Supabase client.

## Database Schema (already exists, no migration needed)

```sql
-- transcripts table
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,                    -- Format: YYYY-MM-DD_meeting-slug
  meeting_title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL,
  participants TEXT[],
  raw_transcript TEXT NOT NULL,
  source_email_id TEXT UNIQUE NOT NULL,   -- For uploads, use "upload_<timestamp>_<random>"
  extraction_method TEXT,                 -- For uploads, use "upload"
  word_count INTEGER,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- transcript_chunks table (with pgvector)
CREATE TABLE transcript_chunks (
  id TEXT PRIMARY KEY,                    -- Format: {transcript_id}_chunk_{index}
  transcript_id TEXT REFERENCES transcripts(id) ON DELETE CASCADE,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  participants TEXT[],
  chunk_index INTEGER,
  total_chunks INTEGER,
  text TEXT NOT NULL,
  embedding VECTOR(1536),
  token_estimate INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- processing_log table
CREATE TABLE processing_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_email_id TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'error')),
  extraction_method TEXT,
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Shared Types (already exist in `packages/shared/src/types.ts`)

```typescript
export type ExtractionMethod = 'inline' | 'google_doc' | 'attachment';
// ⬆ You must add 'upload' to this union type

export interface MeetingTranscript {
  transcript_id: string;       // YYYY-MM-DD_meeting-title-slug
  meeting_title: string;
  meeting_date: string;        // ISO 8601
  participants: string[];
  raw_transcript: string;
  source_email_id: string;     // For uploads: "upload_<timestamp>_<random>"
  extraction_method: ExtractionMethod;
  word_count: number;
  processed_at: string;
}
```

## What to Build

### Step 1: Update Shared Types
**File:** `packages/shared/src/types.ts`

Add `'upload'` to the `ExtractionMethod` union type:
```typescript
export type ExtractionMethod = 'inline' | 'google_doc' | 'attachment' | 'upload';
```

### Step 2: Create Server-Side Upload Processing Library
**Location:** `apps/web/lib/upload-pipeline.ts`

Create a module that encapsulates the upload processing pipeline for use in the API route. This module should:

1. Accept the parsed transcript text, a meeting title, and an optional meeting date.
2. Extract participants from the text (reuse the regex logic from `normalize.ts`).
3. Generate a transcript ID using the `YYYY-MM-DD_slug` format.
4. Create a synthetic `source_email_id` like `upload_${Date.now()}_${randomChars}`.
5. Build a `MeetingTranscript` object with `extraction_method: 'upload'`.
6. Insert the transcript into Supabase using `getServerSupabase()`.
7. Chunk the text using the same multi-level splitting strategy (speaker turns → paragraphs → sentences → merge with overlap). Target: ~2000 chars per chunk, ~400 char overlap.
8. Generate embeddings via OpenAI `text-embedding-3-small` with batching (batch size 20) and exponential backoff retry.
9. Insert all chunks with their embeddings into `transcript_chunks`.
10. Log the processing result to `processing_log`.
11. Return the created transcript record.

**Important implementation details:**
- Use `getServerSupabase()` from `apps/web/lib/supabase.ts` for all database operations
- Use `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` for embeddings
- The chunker and parsers are pure functions with no external dependencies — you can copy them directly or import from the worker package
- Handle errors gracefully: if embedding fails, clean up the transcript record; log errors to `processing_log`

### Step 3: Create the API Route
**File:** `apps/web/app/api/upload/route.ts`

Create a `POST /api/upload` route that:

1. Accepts `multipart/form-data` with:
   - `file` (required): The `.txt`, `.vtt`, or `.sbv` file
   - `title` (optional): Meeting title override. If not provided, derive from filename (strip extension, replace dashes/underscores with spaces, title-case).
   - `date` (optional): Meeting date as ISO string. If not provided, use current date/time.

2. Validates the upload:
   - File must be present
   - File extension must be `.txt`, `.vtt`, or `.sbv`
   - File size must be < 10 MB
   - File must contain non-empty text after parsing

3. Parses the file based on extension:
   - `.vtt` → run through VTT parser (strip timecodes, extract speaker tags)
   - `.sbv` → run through SBV parser (strip timecodes)
   - `.txt` → use raw text as-is

4. Passes the parsed text, title, and date to the upload processing pipeline from Step 2.

5. Returns the created `MeetingTranscript` object as JSON on success, or an error with appropriate HTTP status code.

**Response format:**
```typescript
// Success (201)
{ transcript: MeetingTranscript }

// Validation error (400)
{ error: "File is required" }
{ error: "Unsupported file type. Accepted: .txt, .vtt, .sbv" }
{ error: "File exceeds 10 MB limit" }
{ error: "File contains no transcript text after parsing" }

// Processing error (500)
{ error: "Failed to process transcript: <details>" }
```

### Step 4: Create the Upload UI Component
**File:** `apps/web/components/upload-modal.tsx`

Build a modal dialog component with:

1. **Trigger:** An "Upload Transcript" button that will be placed in the dashboard and transcripts pages.

2. **Modal content:**
   - A drag-and-drop zone that also works as a file picker on click
   - Accepted file types: `.txt`, `.vtt`, `.sbv`
   - File type label: "Drag and drop a transcript file here, or click to browse. Supported: .txt, .vtt, .sbv"
   - Once a file is selected, show: filename, file size, detected format
   - Text input for "Meeting Title" (pre-filled from filename, editable)
   - Date picker input for "Meeting Date" (defaults to today)
   - "Upload & Process" button (primary CTA)
   - "Cancel" button

3. **Processing state:**
   - While uploading, show a progress indicator with status text cycling through: "Uploading file..." → "Parsing transcript..." → "Generating embeddings..." → "Storing in database..."
   - These are cosmetic stages — the actual processing is a single API call; the UI just cycles through messages to indicate progress during the wait.
   - On success: show a green success message with the meeting title and a link to view the transcript at `/transcripts/{transcript_id}`
   - On error: show a red error message with the server's error text

4. **Styling:** Use the existing glassmorphism design system:
   - Modal overlay: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50`
   - Modal card: `glass-card` class with `p-6`
   - Inputs: `input-glow` class
   - Primary button: Same gradient style as the dashboard "Ask AI" button (`bg-gradient-to-r from-brand-500 to-brand-600`)
   - Drag zone: Dashed border, `border-theme-border/[0.15]`, highlight on drag with `border-brand-500`
   - All text uses `text-theme-text-primary`, `text-theme-text-secondary`, `text-theme-text-tertiary` as appropriate
   - The modal should work in both light and dark mode

5. **Accessibility:** Close on Escape key, close on backdrop click, focus trap within modal.

### Step 5: Integrate Upload Button into Dashboard and Transcripts Pages

**File:** `apps/web/app/page.tsx` (Dashboard)
Add an "Upload Transcript" button in the header area next to the "Dashboard" heading. Clicking it opens the upload modal.

**File:** `apps/web/app/transcripts/page.tsx` (Transcript Library)
Add an "Upload Transcript" button in the top-right area of the page header, next to the search bar. Same modal behavior.

After a successful upload in either location, refresh the transcript list so the new transcript appears immediately without a page reload.

### Step 6: Add Upload to Sidebar Navigation
**File:** `apps/web/components/sidebar.tsx`

Add a small upload icon/button in the sidebar (below the nav items or as a quick-action button) that opens the upload modal from anywhere in the app. This is a secondary access point — the primary ones are in the dashboard and transcripts pages.

## File Format Reference

**VTT (WebVTT) example:**
```
WEBVTT

00:00:01.000 --> 00:00:05.000
<v John Smith>Hello everyone, let's get started.

00:00:05.500 --> 00:00:10.000
<v Jane Doe>Thanks John. I have updates on the project.
```
After parsing: `"John Smith: Hello everyone, let's get started.\nJane Doe: Thanks John. I have updates on the project."`

**SBV (SubViewer) example:**
```
0:00:01.000,0:00:05.000
Hello everyone, let's get started.

0:00:05.500,0:00:10.000
Thanks John. I have updates on the project.
```
After parsing: `"Hello everyone, let's get started.\nThanks John. I have updates on the project."`

**TXT:** Raw text passthrough, no parsing needed.

## Environment Variables Already Available

The web app already has these configured (no new env vars needed):
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Testing Checklist

After implementing, verify:
1. Upload a `.txt` file → appears in transcript list → viewable on detail page → searchable via Ask AI
2. Upload a `.vtt` file → timecodes stripped, speakers extracted → correct participant list
3. Upload a `.sbv` file → timecodes stripped → text preserved correctly
4. Upload with custom title → title overrides filename-derived title
5. Upload with custom date → meeting_date reflects chosen date
6. Upload a duplicate file (same content) → should succeed (since source_email_id is unique per upload, not per content)
7. Upload an empty file → returns 400 error
8. Upload a file > 10 MB → returns 400 error
9. Upload a `.pdf` file → returns 400 error (unsupported type)
10. After upload, use Ask AI to search for content from the uploaded transcript → returns relevant results with correct similarity scores

## Do NOT

- Do NOT modify the worker service (`apps/worker/`) — the upload pipeline runs entirely within the web app
- Do NOT add any new npm dependencies unless absolutely necessary — the web app already has `openai`, `@supabase/supabase-js`, `next`, and `react`
- Do NOT create a separate database migration — the existing schema handles uploads (just use `'upload'` as the extraction_method)
- Do NOT break existing functionality — the Gmail-based pipeline, Ask AI, transcript viewing, and all other features must continue working
