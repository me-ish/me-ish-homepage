/**
 * The payment-link stop job runs once a day at 00:20 UTC (09:20 JST), see the
 * natori-payment-expiry cron in vercel.json. A deadline between two runs would
 * be shown to the client but not enforced until the next run, so deadlines are
 * rounded up to the next run. The client never gets less than the time shown.
 */
const STOP_RUN_MINUTES_UTC = 20;

export function alignPaymentDeadlineToStopRun(deadlineIso: string): string {
  const deadline = new Date(deadlineIso);
  const run = new Date(Date.UTC(
    deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate(), 0, STOP_RUN_MINUTES_UTC, 0, 0,
  ));
  if (run.getTime() < deadline.getTime()) run.setUTCDate(run.getUTCDate() + 1);
  return run.toISOString();
}
