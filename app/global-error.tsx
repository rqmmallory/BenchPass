"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: "2.5rem" }} aria-hidden>🔧</p>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Something broke on our bench</h1>
        <p style={{ color: "#64748b", marginTop: "0.5rem" }}>
          The error has been reported. Your data is safe.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.25rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.75rem",
            background: "#1a5cc7",
            color: "white",
            fontWeight: 600,
            border: "none",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
