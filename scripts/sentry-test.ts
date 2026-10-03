// Sends one test event to the Sentry project in NEXT_PUBLIC_SENTRY_DSN, to
// confirm the DSN is right before deploying with it:
//   NEXT_PUBLIC_SENTRY_DSN='https://…@….ingest.sentry.io/…' npm run monitoring:test
// It shows up in Sentry as a message called "ICT Practice monitoring test".
// Nothing about the app runs; this only exercises the configuration.

import * as Sentry from "@sentry/nextjs";
import { monitoringEnabled, sentryOptions } from "../src/lib/monitoring";

async function main() {
  if (!monitoringEnabled()) {
    console.error("NEXT_PUBLIC_SENTRY_DSN is not set (or is not an https DSN). Nothing sent.");
    process.exit(1);
  }
  Sentry.init({ ...sentryOptions(), environment: "monitoring-test" });
  Sentry.captureMessage("ICT Practice monitoring test");
  const delivered = await Sentry.flush(10_000);
  console.log(delivered ? "Test event sent. Look for it in Sentry → Issues (environment: monitoring-test)." : "Not confirmed delivered within 10s. Check the DSN and your network.");
  process.exit(delivered ? 0 : 1);
}

void main();
