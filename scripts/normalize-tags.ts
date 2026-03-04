/**
 * One-shot migration script to normalize all `assigned_to` values
 * in the `action_items` table to canonical names.
 *
 * Usage:
 *   npx tsx scripts/normalize-tags.ts              # apply changes
 *   npx tsx scripts/normalize-tags.ts --dry-run    # preview only
 */

import { createClient } from '@supabase/supabase-js';
import { normalizeAssignee } from '@meet-pipeline/shared';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env from project root
const scriptDir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(scriptDir, '..', '.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const isDryRun = process.argv.includes('--dry-run');

interface ActionItemRow {
    id: string;
    title: string;
    description: string | null;
    assigned_to: string | null;
    transcript_id: string | null;
    status: string;
    priority: string;
    due_date: string | null;
    source_text: string | null;
    created_by: string;
    group_label: string | null;
}

async function main() {
    console.log(`\n🏷️  Assignee Tag Normalizer ${isDryRun ? '(DRY RUN)' : ''}\n`);

    const { data: items, error } = await supabase
        .from('action_items')
        .select('id, title, description, assigned_to, transcript_id, status, priority, due_date, source_text, created_by, group_label');

    if (error) {
        console.error('Failed to fetch action items:', error.message);
        process.exit(1);
    }

    const rows = (items ?? []) as ActionItemRow[];
    console.log(`Found ${rows.length} action items total.\n`);

    let renamed = 0;
    let split = 0;
    let cleared = 0;
    let unchanged = 0;

    for (const row of rows) {
        const canonical = normalizeAssignee(row.assigned_to);

        // Already correct — no change needed
        if (canonical.length === 1 && canonical[0] === row.assigned_to) {
            unchanged++;
            continue;
        }
        if (canonical.length === 0 && row.assigned_to === null) {
            unchanged++;
            continue;
        }

        if (canonical.length === 0) {
            // Clear to null (was "Unassigned" string)
            console.log(`  ✂️  "${row.assigned_to}" → null  (${row.title})`);
            if (!isDryRun) {
                await supabase
                    .from('action_items')
                    .update({ assigned_to: null })
                    .eq('id', row.id);
            }
            cleared++;
        } else if (canonical.length === 1) {
            // Simple rename
            console.log(`  🔄 "${row.assigned_to}" → "${canonical[0]}"  (${row.title})`);
            if (!isDryRun) {
                await supabase
                    .from('action_items')
                    .update({ assigned_to: canonical[0] })
                    .eq('id', row.id);
            }
            renamed++;
        } else {
            // Split: update original with first name, clone for second
            console.log(`  📋 "${row.assigned_to}" → split into "${canonical[0]}" + "${canonical[1]}"  (${row.title})`);
            if (!isDryRun) {
                await supabase
                    .from('action_items')
                    .update({ assigned_to: canonical[0] })
                    .eq('id', row.id);

                await supabase
                    .from('action_items')
                    .insert({
                        title: row.title,
                        description: row.description,
                        transcript_id: row.transcript_id,
                        assigned_to: canonical[1],
                        status: row.status,
                        priority: row.priority,
                        due_date: row.due_date,
                        source_text: row.source_text,
                        created_by: row.created_by,
                        group_label: row.group_label,
                    });
            }
            split++;
        }
    }

    console.log('\n── Summary ─────────────────');
    console.log(`  Renamed:   ${renamed}`);
    console.log(`  Split:     ${split}`);
    console.log(`  Cleared:   ${cleared}`);
    console.log(`  Unchanged: ${unchanged}`);
    console.log(`  Total:     ${rows.length}`);

    if (isDryRun) {
        console.log('\n⚠️  Dry run complete — no changes were written.\n');
    } else {
        console.log('\n✅ Migration complete.\n');
    }
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
