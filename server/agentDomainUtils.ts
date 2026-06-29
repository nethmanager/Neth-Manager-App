export const DEFAULT_TIME_ZONE = "America/Cancun";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

const SEARCH_STOP_WORDS = new Set([
  "a", "an", "the", "my", "me", "with", "for", "from", "to", "at", "on", "in", "of",
  "and", "or", "by", "please", "hey", "boss", "emily", "nala", "meeting", "event",
  "calendar", "schedule", "task", "project", "expense", "contact", "yesterday", "today",
  "tomorrow", "next", "last", "this", "that", "move", "reschedule", "shift", "update",
  "edit", "delete", "remove", "cancel", "create", "add", "book", "set", "change"
]);

export type DateReference = {
  label: string;
  dateKey: string;
  position: number;
};

export type CalendarDateReferences = {
  requestedDate: DateReference | null;
  sourceDate: DateReference | null;
  targetDate: DateReference | null;
  all: DateReference[];
};

export function getSafeTimeZone(input: any): string {
  if (typeof input !== "string" || !input.trim()) {
    return DEFAULT_TIME_ZONE;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: input });
    return input;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getLocalDateKey(value: Date | string, timeZone: string = DEFAULT_TIME_ZONE): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value || "0000";
  const month = parts.find((p) => p.type === "month")?.value || "00";
  const day = parts.find((p) => p.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

export function addDaysToLocalDateKey(dateKey: string, days: number, timeZone: string = DEFAULT_TIME_ZONE): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return getLocalDateKey(date, timeZone);
}

function getWeekdayIndex(name: string): number {
  return WEEKDAYS.indexOf(String(name || "").toLowerCase());
}

function getDateKeyForWeekday(baseDateKey: string, weekdayName: string, direction: "next" | "last" | "nearest"): string {
  const [year, month, day] = baseDateKey.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const currentWeekday = base.getUTCDay();
  const targetWeekday = getWeekdayIndex(weekdayName);
  if (targetWeekday < 0) return baseDateKey;

  let offset = targetWeekday - currentWeekday;
  if (direction === "next") {
    if (offset <= 0) offset += 7;
  } else if (direction === "last") {
    if (offset >= 0) offset -= 7;
  } else if (offset < 0) {
    offset += 7;
  }

  base.setUTCDate(base.getUTCDate() + offset);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
}

export function extractCalendarDateReferences(message: string, timeZone: string = DEFAULT_TIME_ZONE): CalendarDateReferences {
  const msg = String(message || "").toLowerCase();
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const refs: DateReference[] = [];

  const pushRef = (label: string, dateKey: string, matchIndex: number) => {
    refs.push({ label, dateKey, position: matchIndex });
  };

  for (const match of msg.matchAll(/\b(yesterday|today|tomorrow)\b/g)) {
    const label = match[1];
    if (label === "yesterday") pushRef(label, addDaysToLocalDateKey(todayKey, -1, timeZone), match.index || 0);
    if (label === "today") pushRef(label, todayKey, match.index || 0);
    if (label === "tomorrow") pushRef(label, addDaysToLocalDateKey(todayKey, 1, timeZone), match.index || 0);
  }

  for (const match of msg.matchAll(/\b(next|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    const direction = match[1] as "next" | "last";
    const weekday = match[2];
    pushRef(`${direction} ${weekday}`, getDateKeyForWeekday(todayKey, weekday, direction), match.index || 0);
  }

  for (const match of msg.matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    const weekday = match[1];
    const overlap = refs.some((ref) => ref.position <= (match.index || 0) && (match.index || 0) <= ref.position + ref.label.length);
    if (!overlap) {
      pushRef(weekday, getDateKeyForWeekday(todayKey, weekday, "nearest"), match.index || 0);
    }
  }

  refs.sort((a, b) => a.position - b.position);

  const isMoveLike = /\b(move|reschedule|shift|postpone|bring forward|push|change|update|edit)\b/.test(msg);
  const sourceDate = isMoveLike && refs.length >= 2 ? refs[0] : null;
  const targetDate = isMoveLike && refs.length >= 2 ? refs[1] : refs[0] || null;
  const requestedDate = targetDate || refs[0] || null;

  return {
    requestedDate,
    sourceDate,
    targetDate,
    all: refs
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value || 0);
  const month = Number(parts.find((p) => p.type === "month")?.value || 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || 1);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const second = Number(parts.find((p) => p.type === "second")?.value || 0);

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - date.getTime();
}

function makeUtcDateForTimeZone(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
    utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return new Date(utcGuess);
}

function getLocalDateParts(baseDate: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(baseDate);

  return {
    year: Number(parts.find((p) => p.type === "year")?.value || 0),
    month: Number(parts.find((p) => p.type === "month")?.value || 1),
    day: Number(parts.find((p) => p.type === "day")?.value || 1),
    hour: Number(parts.find((p) => p.type === "hour")?.value || 0),
    minute: Number(parts.find((p) => p.type === "minute")?.value || 0)
  };
}

function parseTimeExpression(input: string): { hour: number; minute: number; ambiguous: boolean } | null {
  const twelveHour = input.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] || 0);
    const meridiem = twelveHour[3].toLowerCase();
    if (hour === 12) hour = 0;
    if (meridiem === "pm") hour += 12;
    return { hour, minute, ambiguous: false };
  }

  const twentyFour = input.match(/\b(\d{1,2}):(\d{2})\b/);
  if (twentyFour) {
    const rawHour = twentyFour[1];
    let hour = Number(rawHour);
    const minute = Number(twentyFour[2]);
    if (hour <= 23 && minute <= 59) {
      const hasLeadingZero = rawHour.length > 1 && rawHour.startsWith("0");
      const hasDayPart = /\bmorning|afternoon|evening|tonight|night\b/i.test(input);
      if (!hasLeadingZero && !hasDayPart && hour >= 1 && hour <= 7) {
        hour += 12;
      }
      return { hour, minute, ambiguous: false };
    }
  }

  const hourOnly = input.match(/\bat\s+(\d{1,2})\b|\b(\d{1,2})\s*o'?clock\b/i);
  if (hourOnly) {
    const hour = Number(hourOnly[1] || hourOnly[2]);
    if (hour >= 1 && hour <= 12) {
      return { hour, minute: 0, ambiguous: true };
    }
  }

  if (/\bmorning\b/.test(input)) return { hour: 9, minute: 0, ambiguous: false };
  if (/\bafternoon\b/.test(input)) return { hour: 14, minute: 0, ambiguous: false };
  if (/\bevening\b/.test(input)) return { hour: 18, minute: 0, ambiguous: false };
  if (/\btonight\b|\bnight\b/.test(input)) return { hour: 20, minute: 0, ambiguous: false };
  return null;
}

export function resolveNaturalDateTime(
  input: any,
  timeZone: string = DEFAULT_TIME_ZONE,
  baseDate: Date = new Date(),
  options?: { defaultHour?: number; defaultMinute?: number }
): { iso: string | null; ambiguous: boolean; reason?: string } {
  if (input === undefined || input === null) {
    return { iso: null, ambiguous: false };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { iso: null, ambiguous: false };
  }

  const localIsoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (localIsoMatch) {
    const [, year, month, day, hour, minute] = localIsoMatch;
    const utcDate = makeUtcDateForTimeZone(
      Number(year),
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      timeZone
    );
    return { iso: utcDate.toISOString(), ambiguous: false };
  }
  const directTimestamp = Date.parse(raw);
  const hasRelativeDateWord = /\b(today|tomorrow|yesterday|next|last|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(raw);
  const hasExplicitCalendarDate = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(raw);
  if (!hasRelativeDateWord && !Number.isNaN(directTimestamp) && hasExplicitCalendarDate) {
    return { iso: new Date(directTimestamp).toISOString(), ambiguous: false };
  }

  const refs = extractCalendarDateReferences(raw, timeZone);
  const dateRef = refs.requestedDate;
  const baseParts = getLocalDateParts(baseDate, timeZone);
  const timeParts = parseTimeExpression(raw);

  if (!dateRef && !timeParts) {
    return { iso: null, ambiguous: false, reason: `Could not interpret date/time '${raw}'.` };
  }

  const targetDateKey = dateRef?.dateKey || getLocalDateKey(baseDate, timeZone);
  const [year, month, day] = targetDateKey.split("-").map(Number);
  const hour = timeParts
    ? timeParts.hour
    : (typeof options?.defaultHour === "number" ? options.defaultHour : baseParts.hour);
  const minute = timeParts
    ? timeParts.minute
    : (typeof options?.defaultMinute === "number" ? options.defaultMinute : baseParts.minute);
  const utcDate = makeUtcDateForTimeZone(year, month, day, hour, minute, timeZone);

  return {
    iso: utcDate.toISOString(),
    ambiguous: !!timeParts?.ambiguous,
    reason: timeParts?.ambiguous ? `Time '${raw}' is ambiguous without AM/PM.` : undefined
  };
}

export function extractSearchTerms(input: string): string[] {
  return String(input || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !SEARCH_STOP_WORDS.has(term));
}

export function scoreTextMatch(haystack: string, searchText: string): number {
  const normalizedHaystack = String(haystack || "").toLowerCase();
  const terms = extractSearchTerms(searchText);
  if (!terms.length || !normalizedHaystack) return 0;

  let score = 0;
  for (const term of terms) {
    if (normalizedHaystack.includes(term)) {
      score += term.length > 4 ? 8 : 5;
    }
  }

  if (terms.length && normalizedHaystack.includes(terms.join(" "))) {
    score += 20;
  }

  return score;
}

export function findBestTextMatch<T>(items: T[], searchText: string, selectors: Array<(item: T) => string | null | undefined>): { item: T | null; score: number } {
  let bestItem: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const haystack = selectors
      .map((selector) => selector(item))
      .filter(Boolean)
      .join(" \n ");

    const score = scoreTextMatch(haystack, searchText);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { item: bestItem, score: bestScore };
}

export function findCalendarEventCandidates(events: any[], message: string, timeZone: string = DEFAULT_TIME_ZONE, sourceDateKey?: string | null): any[] {
  const searchTerms = extractSearchTerms(message);
  if (!searchTerms.length) return [];

  return [...events]
    .map((event) => {
      const haystack = [event.title, event.description, event.location].filter(Boolean).join(" \n ");
      let score = scoreTextMatch(haystack, message);
      const eventDateKey = event.start_at ? getLocalDateKey(event.start_at, timeZone) : null;
      if (sourceDateKey && eventDateKey === sourceDateKey) {
        score += 30;
      }
      return { ...event, _matchScore: score, _eventDateKey: eventDateKey };
    })
    .filter((event) => event._matchScore > 0)
    .sort((a, b) => b._matchScore - a._matchScore)
    .slice(0, 5);
}

