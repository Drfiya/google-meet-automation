import { NextRequest, NextResponse } from 'next/server';
import { parseVtt, parseSbv, processUpload } from '../../../lib/upload-pipeline';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set(['.txt', '.vtt', '.sbv']);

/** Derive a meeting title from a filename: strip extension, replace separators, title-case. */
function titleFromFilename(filename: string): string {
    const base = filename.replace(/\.[^.]+$/, ''); // strip extension
    const words = base.replace(/[-_]+/g, ' ').trim().split(/\s+/);
    return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const titleOverride = formData.get('title') as string | null;
        const dateOverride = formData.get('date') as string | null;

        // ── Validation ──────────────────────────────────────────

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        const filename = file.name;
        const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return NextResponse.json(
                { error: 'Unsupported file type. Accepted: .txt, .vtt, .sbv' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 });
        }

        // ── Parse file content ──────────────────────────────────

        const rawText = await file.text();
        let parsedText: string;

        switch (ext) {
            case '.vtt':
                parsedText = parseVtt(rawText);
                break;
            case '.sbv':
                parsedText = parseSbv(rawText);
                break;
            default:
                parsedText = rawText;
        }

        if (!parsedText.trim()) {
            return NextResponse.json(
                { error: 'File contains no transcript text after parsing' },
                { status: 400 }
            );
        }

        // ── Process through pipeline ────────────────────────────

        const title = titleOverride?.trim() || titleFromFilename(filename);
        const date = dateOverride ? new Date(dateOverride) : undefined;

        const transcript = await processUpload({ text: parsedText, title, date });

        return NextResponse.json({ transcript }, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[upload] Processing failed:', message);
        return NextResponse.json(
            { error: `Failed to process transcript: ${message}` },
            { status: 500 }
        );
    }
}
