import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '../../../lib/supabase';
import type { DayMeetingSummary, ScoreboardMetrics } from '@meet-pipeline/shared';
import {
    startOfMonth, endOfMonth, format, parseISO,
    eachDayOfInterval, getWeeksInMonth, isWeekend,
} from 'date-fns';

export const dynamic = 'force-dynamic';

// ── Helpers ──────────────────────────────────────

/** Check if a participant name matches one of the co-founders (case-insensitive partial match). */
function isLutfiya(name: string): boolean {
    return name.toLowerCase().includes('lutfiya');
}
function isChris(name: string): boolean {
    return name.toLowerCase().includes('chris');
}

/** Find the longest streak of consecutive days with at least one meeting. */
function computeStreak(allDays: Date[], dayMap: Map<string, DayMeetingSummary>): number {
    let longest = 0;
    let current = 0;
    for (const day of allDays) {
        const key = format(day, 'yyyy-MM-dd');
        if (dayMap.has(key)) {
            current++;
            longest = Math.max(longest, current);
        } else {
            current = 0;
        }
    }
    return longest;
}

/** Count the busiest day-of-week from transcript dates. */
function computeBusiestDay(transcripts: { meeting_date: string }[]): string {
    const counts = new Map<string, number>();
    for (const t of transcripts) {
        const dayName = format(parseISO(t.meeting_date), 'EEEE');
        counts.set(dayName, (counts.get(dayName) ?? 0) + 1);
    }
    let busiest = '';
    let max = 0;
    for (const [day, count] of counts) {
        if (count > max) { max = count; busiest = day; }
    }
    return busiest;
}

// ── Route handler ────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const supabase = getServerSupabase();
        const { searchParams } = new URL(request.url);

        const now = new Date();
        const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()));
        const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

        const monthDate = new Date(year, month - 1, 1);
        const startDate = startOfMonth(monthDate).toISOString();
        const endDate = endOfMonth(monthDate).toISOString();

        // Fetch transcripts in range
        const { data: transcripts } = await supabase
            .from('transcripts')
            .select('id, meeting_title, meeting_date, participants, word_count, extraction_method')
            .gte('meeting_date', startDate)
            .lte('meeting_date', endDate)
            .order('meeting_date', { ascending: true });

        // Fetch action items created in range
        const { data: actionItems } = await supabase
            .from('action_items')
            .select('id, status, group_label, assigned_to, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        const txns = transcripts ?? [];
        const items = actionItems ?? [];

        // ── Group transcripts by date ────────────────

        const dayMap = new Map<string, DayMeetingSummary>();

        for (const t of txns) {
            const dateKey = format(parseISO(t.meeting_date), 'yyyy-MM-dd');

            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, {
                    date: dateKey,
                    meetings: [],
                    totalMeetings: 0,
                    totalWords: 0,
                    uniqueParticipants: [],
                });
            }

            const day = dayMap.get(dateKey)!;
            day.meetings.push({
                transcript_id: t.id,
                title: t.meeting_title,
                participants: t.participants ?? [],
                word_count: t.word_count ?? 0,
                extraction_method: t.extraction_method ?? '',
            });
            day.totalMeetings = day.meetings.length;
            day.totalWords += t.word_count ?? 0;

            // Accumulate unique participants
            const pSet = new Set(day.uniqueParticipants);
            for (const p of (t.participants ?? [])) pSet.add(p);
            day.uniqueParticipants = [...pSet];
        }

        // ── Scoreboard calculations ──────────────────

        const totalWords = txns.reduce((sum, t) => sum + (t.word_count ?? 0), 0);
        const totalMeetings = txns.length;
        const totalHours = parseFloat((totalWords / 150 / 60).toFixed(1));

        // Action items
        const totalActionItems = items.length;
        const completedItems = items.filter(
            (i) => i.status === 'done' || i.status === 'dismissed'
        );
        const completedActionItems = completedItems.length;
        const actionItemCompletionRate = totalActionItems > 0
            ? parseFloat(((completedActionItems / totalActionItems) * 100).toFixed(1))
            : 0;

        // Topics (unique non-null group_labels)
        const topicSet = new Set<string>();
        for (const i of items) {
            if (i.group_label) topicSet.add(i.group_label);
        }

        // Participant meeting counts
        const participantCounts: Record<string, number> = {};
        for (const t of txns) {
            for (const p of (t.participants ?? [])) {
                participantCounts[p] = (participantCounts[p] ?? 0) + 1;
            }
        }

        // Busiest day of week
        const busiestDay = computeBusiestDay(txns);

        // Average meetings per week
        const weeksInMonth = getWeeksInMonth(monthDate, { weekStartsOn: 1 });
        const averageMeetingsPerWeek = parseFloat(
            (totalMeetings / Math.max(weeksInMonth, 1)).toFixed(1)
        );

        // Streak
        const allDays = eachDayOfInterval({
            start: startOfMonth(monthDate),
            end: endOfMonth(monthDate),
        });
        const streakDays = computeStreak(allDays, dayMap);

        // Co-founder pair analysis
        let meetingsTogether = 0;
        let lutfiyaSolo = 0;
        let chrisSolo = 0;
        let withExternalGuests = 0;

        for (const t of txns) {
            const participants = (t.participants ?? []) as string[];
            const hasLutfiya = participants.some(isLutfiya);
            const hasChris = participants.some(isChris);
            const hasExternal = participants.some(
                (p) => !isLutfiya(p) && !isChris(p)
            );

            if (hasLutfiya && hasChris) meetingsTogether++;
            else if (hasLutfiya && !hasChris) lutfiyaSolo++;
            else if (hasChris && !hasLutfiya) chrisSolo++;

            if (hasExternal) withExternalGuests++;
        }

        // No-meeting weekdays
        const freeDays = allDays.filter((d) => {
            if (isWeekend(d)) return false;
            const key = format(d, 'yyyy-MM-dd');
            return !dayMap.has(key);
        }).length;

        // Action item velocity
        const actionItemsCreated = totalActionItems;
        const actionItemsCompleted = completedActionItems;

        const scoreboard: ScoreboardMetrics = {
            period: format(monthDate, 'yyyy-MM'),
            totalMeetings,
            totalHours,
            totalActionItems,
            completedActionItems,
            topicsDiscussed: [...topicSet],
            meetingsByParticipant: participantCounts,
            busiestDay,
            averageMeetingsPerWeek,
            actionItemCompletionRate,
            streakDays,
            meetingsTogether,
            lutfiyaSolo,
            chrisSolo,
            withExternalGuests,
            actionItemsCreated,
            actionItemsCompleted,
            freeDays,
        };

        return NextResponse.json({
            days: [...dayMap.values()],
            scoreboard,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
