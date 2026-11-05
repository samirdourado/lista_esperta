import {
  WEEK_DAYS,
  type OpeningHours,
  type TimeRange,
  type WeekDay,
} from '../stores/store.types.js';

const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/** Local wall clock in São Paulo (UTC-3, no daylight saving since 2019). */
export function saoPauloClock(at: Date): { day: number; minutes: number } {
  const local = new Date(at.getTime() - 3 * 60 * 60 * 1000);
  // getUTCDay: 0 = Sunday → our index 0 = Monday.
  return {
    day: (local.getUTCDay() + 6) % 7,
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function inRanges(
  ranges: TimeRange[],
  minutes: number,
  previousDay: TimeRange[],
): boolean {
  const today = ranges.some(({ open, close }) => {
    const [o, c] = [toMinutes(open), toMinutes(close)];
    return c > o ? minutes >= o && minutes < c : minutes >= o; // closes after midnight
  });
  // A range that started yesterday and crosses midnight.
  const spill = previousDay.some(
    ({ open, close }) =>
      toMinutes(close) <= toMinutes(open) && minutes < toMinutes(close),
  );
  return today || spill;
}

/**
 * Subset of the OSM opening_hours syntax that covers most shops:
 * "24/7", "Mo-Sa 08:00-21:00; Su 09:00-13:00", "Mo-Fr 08:00-12:00,14:00-18:00".
 * Returns null when it does not understand the string.
 */
export function parseOsmHours(
  value: string,
): Partial<Record<WeekDay, TimeRange[]>> | null {
  const text = value.trim();
  if (text === '24/7')
    return Object.fromEntries(
      WEEK_DAYS.map((d) => [d, [{ open: '00:00', close: '00:00' }]]),
    );
  const weekly: Partial<Record<WeekDay, TimeRange[]>> = {};
  for (const rule of text
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)) {
    const match = rule.match(
      /^((?:[A-Z][a-z](?:-[A-Z][a-z])?,?)+)\s+(off|closed|(?:\d{2}:\d{2}-\d{2}:\d{2},?)+)$/,
    );
    if (!match) return null;
    const days = match[1]
      .split(',')
      .filter(Boolean)
      .flatMap((part) => {
        const [from, to] = part.split('-') as [
          (typeof OSM_DAYS)[number],
          (typeof OSM_DAYS)[number] | undefined,
        ];
        const start = OSM_DAYS.indexOf(from);
        const end = to ? OSM_DAYS.indexOf(to) : start;
        if (start < 0 || end < 0) return [];
        const span: number[] = [];
        for (let i = start; ; i = (i + 1) % 7) {
          span.push(i);
          if (i === end) break;
        }
        return span;
      });
    if (days.length === 0) return null;
    const ranges =
      match[2] === 'off' || match[2] === 'closed'
        ? []
        : match[2]
            .split(',')
            .filter(Boolean)
            .map((range) => {
              const [open, close] = range.split('-');
              return { open, close: close === '24:00' ? '00:00' : close };
            });
    for (const day of days) weekly[WEEK_DAYS[day]] = ranges;
  }
  return weekly;
}

/**
 * true/false when the store publishes hours, null when unknown. Stores with
 * unknown hours stay in the verdict (spec: "quando houver horário cadastrado").
 */
export function isOpenAt(
  hours: OpeningHours | null | undefined,
  at: Date,
): boolean | null {
  const weekly =
    hours?.weekly ?? (hours?.osm ? parseOsmHours(hours.osm) : null);
  if (!weekly || Object.keys(weekly).length === 0) return null;
  const { day, minutes } = saoPauloClock(at);
  const today = weekly[WEEK_DAYS[day]] ?? [];
  const yesterday = weekly[WEEK_DAYS[(day + 6) % 7]] ?? [];
  return inRanges(today, minutes, yesterday);
}
