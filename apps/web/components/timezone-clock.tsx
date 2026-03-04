'use client';

import { useState, useEffect } from 'react';

/** Time zones for the two meeting owners. */
const ZONES = [
    { label: 'Lutfiya', tz: 'America/Chicago', flag: '🇺🇸' },
    { label: 'Chris', tz: 'Europe/Berlin', flag: '🇩🇪' },
] as const;

/** Format a live clock string for the given IANA timezone. */
function formatTime(tz: string): string {
    return new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

/**
 * Dual timezone clock showing US Central (Lutfiya) and
 * Europe/Berlin (Chris) side by side. Updates every second.
 */
export function TimezoneClock() {
    const [times, setTimes] = useState<string[]>([]);

    useEffect(() => {
        // Hydration-safe: only render times on the client
        const tick = () => setTimes(ZONES.map((z) => formatTime(z.tz)));
        tick();
        const id = setInterval(tick, 1_000);
        return () => clearInterval(id);
    }, []);

    // Don't render until client-side hydration completes
    if (times.length === 0) return null;

    return (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl
                        bg-theme-overlay border border-theme-border">
            {ZONES.map((z, i) => (
                <div key={z.tz} className="flex items-center gap-1.5">
                    <span className="text-2xl">{z.flag}</span>
                    <div className="leading-tight">
                        <span className="text-sm font-medium text-theme-text-primary tabular-nums">
                            {times[i]}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
