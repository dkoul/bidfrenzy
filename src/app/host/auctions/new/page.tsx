"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewAuctionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { data, error: err } = await supabase.rpc("create_auction", {
      p_name: String(form.get("name") || "").trim(),
      p_description: String(form.get("description") || "").trim() || null,
      p_currency: String(form.get("currency") || "INR"),
      p_default_starting_bid: Number(form.get("starting") || 1000),
      p_default_bid_increment: Number(form.get("increment") || 500),
    });

    if (err || !data) {
      setError(err?.message ?? "Could not create auction");
      setLoading(false);
      return;
    }

    router.push(`/host/auctions/${data.id}`);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
      <Link href="/host" className="text-sm font-semibold text-ink-soft/70">
        ← Back
      </Link>
      <h1 className="mt-4 font-display text-4xl">Create auction</h1>
      <form onSubmit={onSubmit} className="bf-panel mt-8 grid gap-5 rounded-[1.5rem] p-6">
        <div>
          <label className="bf-label" htmlFor="name">
            Auction name
          </label>
          <input id="name" name="name" required className="bf-input" placeholder="Charity Gala 2026" />
        </div>
        <div>
          <label className="bf-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            className="bf-input min-h-24"
            placeholder="Optional notes for your team"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="bf-label" htmlFor="currency">
              Currency
            </label>
            <select id="currency" name="currency" className="bf-input" defaultValue="INR">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label className="bf-label" htmlFor="starting">
              Default starting bid
            </label>
            <input id="starting" name="starting" type="number" min={1} defaultValue={1000} className="bf-input" />
          </div>
          <div>
            <label className="bf-label" htmlFor="increment">
              Default increment
            </label>
            <input id="increment" name="increment" type="number" min={1} defaultValue={500} className="bf-input" />
          </div>
        </div>
        {error ? <p className="text-sm text-signal-deep">{error}</p> : null}
        <button type="submit" className="bf-btn bf-btn-primary" disabled={loading}>
          {loading ? "Creating…" : "Create auction"}
        </button>
      </form>
    </main>
  );
}
