import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-4xl" aria-hidden>🎻</p>
      <h1 className="mt-3 text-xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">
        This link may have expired or the ticket may have been removed.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to the board
      </Link>
    </main>
  );
}
