import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/activity — Fetch activity log entries.
 *
 * Query params:
 *   limit      — max rows to return (default 20, max 100)
 *   offset     — rows to skip for pagination (default 0)
 *   event_type — filter by event type (exact match)
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServerSupabase();
        const { searchParams } = req.nextUrl;

        const limit = Math.min(
            parseInt(searchParams.get('limit') ?? '20', 10) || 20,
            100
        );

        const offset = Math.max(
            parseInt(searchParams.get('offset') ?? '0', 10) || 0,
            0
        );

        let query = supabase
            .from('activity_log')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const eventType = searchParams.get('event_type');
        if (eventType) query = query.eq('event_type', eventType);

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data ?? []);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
