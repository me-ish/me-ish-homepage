// Private fixture validation only; never normalizes or repairs a DB response.
// Keep PostgreSQL microseconds: Date.parse alone would hide differing records.
function instant(value) {
  const m = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1
    || Number(m[3]) > new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()
    || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return null;
  const second = Date.parse(`${value.slice(0, 19)}${m[8]}`);
  return Number.isFinite(second) ? { second, fraction: m[7] ?? '' } : null;
}
export function compareFixtureTimes(left, right) {
  const a = instant(left), b = instant(right);
  if (!a || !b) throw Error('fixture_chronology_invalid_time');
  if (a.second !== b.second) return a.second < b.second ? -1 : 1;
  const length = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(length, '0'), bf = b.fraction.padEnd(length, '0');
  return af < bf ? -1 : af > bf ? 1 : 0;
}
export function sameFixtureTime(left, right) {
  return !!instant(left) && !!instant(right) && compareFixtureTimes(left, right) === 0;
}
export function assertFixtureChronology(project, quote, now) {
  const times = [project?.created_at, project?.updated_at, quote?.created_at,
    quote?.issued_at, quote?.accepted_at, project?.quote_accepted_at, quote?.expires_at];
  const observed = Number.isFinite(now) ? new Date(now).toISOString() : null;
  if (!observed || times.some(time => !instant(time))
    || times.slice(0, -1).some(time => compareFixtureTimes(time, observed) > 0)
    || compareFixtureTimes(project.created_at, quote.created_at) > 0
    || compareFixtureTimes(quote.created_at, quote.issued_at) > 0
    || compareFixtureTimes(quote.issued_at, quote.accepted_at) > 0
    || !sameFixtureTime(quote.accepted_at, project.quote_accepted_at)
    || compareFixtureTimes(project.updated_at, quote.accepted_at) < 0
    || compareFixtureTimes(quote.accepted_at, quote.expires_at) >= 0) {
    throw Error('fixture_chronology_inconsistent');
  }
}
