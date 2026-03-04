/**
 * Canonical assignee names used across the application.
 * All name variants are normalised to exactly these values.
 */
export const CANONICAL_NAMES = {
    LUTFIYA: 'Lutfiya Miller',
    CHRIS: 'Chris Müller',
} as const;

/**
 * Patterns that indicate a name refers to Chris (case-insensitive).
 * Covers: Chris Müller, Chris-Steven Müller, Chris Muller, Chris Mueller, etc.
 */
const CHRIS_PATTERN = /chris/i;

/** Patterns that indicate a name refers to Lutfiya (case-insensitive). */
const LUTFIYA_PATTERN = /lutfiya/i;

/** Values that represent joint / "both" assignment. */
const BOTH_PATTERNS = [/^both$/i, /\band\b/i];

/**
 * Normalise a raw `assigned_to` value into an array of canonical names.
 *
 * - `null`, empty, or `"Unassigned"` → `[]` (unassigned)
 * - `"Both"` or any composite like "Lutfiya Miller and Chris-Steven Müller" → both canonical names
 * - Any Chris variant → `["Chris Müller"]`
 * - `"Lutfiya Miller"` → `["Lutfiya Miller"]`
 * - Unknown names → pass through unchanged as `[rawTrimmed]`
 */
export function normalizeAssignee(raw: string | null | undefined): string[] {
    if (raw == null) return [];

    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unassigned') return [];

    // Check for composite / "both" values first
    const isBoth = BOTH_PATTERNS.some((p) => p.test(trimmed));
    if (isBoth) {
        return [CANONICAL_NAMES.LUTFIYA, CANONICAL_NAMES.CHRIS];
    }

    // Single-person matching
    if (CHRIS_PATTERN.test(trimmed)) return [CANONICAL_NAMES.CHRIS];
    if (LUTFIYA_PATTERN.test(trimmed)) return [CANONICAL_NAMES.LUTFIYA];

    // Unknown name — keep as-is so we don't silently discard data
    return [trimmed];
}

/**
 * Convenience wrapper that returns a single canonical name (or null).
 * If the raw value maps to multiple people it returns the first match.
 *
 * Use this in write paths where the DB column is `string | null`
 * and you handle the multi-assignment case separately.
 */
export function normalizeAssigneeSingle(raw: string | null | undefined): string | null {
    const result = normalizeAssignee(raw);
    return result.length > 0 ? result[0] : null;
}
