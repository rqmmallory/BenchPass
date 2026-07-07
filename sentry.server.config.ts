import * as Sentry from "@sentry/nextjs";

// No DSN → Sentry stays inert (local dev without the env var).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Customer data must never reach Sentry: drop console breadcrumbs (they
    // could echo message bodies) and strip request cookies.
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb.category === "console" ? null : breadcrumb;
    },
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
      }
      return event;
    },
  });
}
