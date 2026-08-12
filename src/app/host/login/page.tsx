"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function HostLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const next = new URLSearchParams(window.location.search).get("next") ?? "/host";
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 font-display text-3xl text-ink">
        BidFrenzy
      </Link>
      <div className="bf-panel rounded-[1.75rem] p-8 shadow-sm">
        <h1 className="font-display text-3xl">Host login</h1>
        <p className="mt-2 text-ink-soft/80">
          Sign in with Google to create and run live bidding rooms.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl bg-signal/10 px-3 py-2 text-sm text-signal-deep">{error}</p>
        ) : null}
        <button
          type="button"
          className="bf-btn bf-btn-dark mt-8 w-full"
          onClick={() => void signInWithGoogle()}
          disabled={loading}
        >
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
