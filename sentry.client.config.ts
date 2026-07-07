import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Never ship customer text (notes, messages) in breadcrumbs.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console" || breadcrumb.category === "xhr") {
        return null;
      }
      return breadcrumb;
    },
  });
}
