"use client";

import { useEffect } from "react";

/** Fires the print dialog once the tag view has painted. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
