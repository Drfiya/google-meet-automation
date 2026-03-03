import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../lib/supabase';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/transcripts/[id] — Fetch a single transcript by ID.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getServerSupabase();

        const { data, error } = await supabase
            .from('transcripts')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
        }

        const transcript = {
            transcript_id: data.id,
            meeting_title: data.meeting_title,
            meeting_date: data.meeting_date,
            participants: data.participants,
            raw_transcript: data.raw_transcript,
            source_email_id: data.source_email_id,
            extraction_method: data.extraction_method,
            word_count: data.word_count,
            processed_at: data.processed_at,
        };

        return NextResponse.json(transcript);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * DELETE /api/transcripts/[id] — Delete a transcript and its related data.
 * Removes associated action_items, transcript_chunks, and logs the deletion.
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getServerSupabase();

        // Verify the transcript exists first (and grab title for the activity log)
        const { data: existing, error: fetchErr } = await supabase
            .from('transcripts')
            .select('id, meeting_title')
            .eq('id', id)
            .single();

        if (fetchErr || !existing) {
            return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
        }

        // Delete related action items
        await supabase.from('action_items').delete().eq('transcript_id', id);

        // Delete related embedding chunks
        await supabase.from('transcript_chunks').delete().eq('transcript_id', id);

        // Delete the transcript itself
        const { error: deleteErr } = await supabase
            .from('transcripts')
            .delete()
            .eq('id', id);

        if (deleteErr) {
            return NextResponse.json({ error: deleteErr.message }, { status: 500 });
        }

        // Log the deletion
        await supabase.from('activity_log').insert({
            event_type: 'transcript.deleted',
            entity_type: 'transcript',
            entity_id: id,
            summary: `Deleted transcript: ${existing.meeting_title}`,
            actor: 'user',
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
