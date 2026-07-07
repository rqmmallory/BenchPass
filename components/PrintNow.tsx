"use client";

export function PrintNow() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      Print tag
    </button>
  );
}
