const montrealClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function montrealWallTime(timestamp) {
  const parts = Object.fromEntries(montrealClock.formatToParts(timestamp)
    .map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseHeureMontreal(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const wallTime = Date.parse(`${value}Z`);
  if (!Number.isFinite(wallTime)) return NaN;
  // Montréal alternates between UTC−04:00 and UTC−05:00. During the repeated
  // hour in November, use the first occurrence.
  return [4, 5].map((offset) => wallTime + offset * 3600000)
    .find((timestamp) => montrealWallTime(timestamp) === value) ?? NaN;
}

