"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useAuctionRealtime } from "@/hooks/useAuctionRealtime";
import { formatMoney } from "@/lib/format";

export default function HostSummaryPage() {
  const params = useParams<{ id: string }>();
  const { auction, items, participants, results, loading, error } = useAuctionRealtime(params.id);

  const summary = useMemo(() => {
    const sold = results.filter((r) => r.outcome === "sold");
    const unsold = results.filter((r) => r.outcome === "unsold");
    const total = sold.reduce((sum, r) => sum + Number(r.winning_bid ?? 0), 0);
    const avg = sold.length ? total / sold.length : 0;
    return { sold, unsold, total, avg };
  }, [results]);

  if (loading) return <main className="p-10">Loading summary…</main>;
  if (error || !auction) return <main className="p-10">{error ?? "Auction missing"}</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <Link href={`/host/auctions/${auction.id}/live`} className="text-sm font-semibold text-ink-soft/70">
        ← Live control
      </Link>
      <h1 className="mt-4 font-display text-4xl">Auction summary</h1>
      <p className="mt-2 text-ink-soft/70">{auction.name}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="bf-panel rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft/55">Total value</p>
          <p className="mt-2 font-display text-3xl text-signal">
            {formatMoney(summary.total, auction.currency)}
          </p>
        </div>
        <div className="bf-panel rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft/55">Avg winning bid</p>
          <p className="mt-2 font-display text-3xl">{formatMoney(summary.avg, auction.currency)}</p>
        </div>
        <div className="bf-panel rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft/55">Results</p>
          <p className="mt-2 font-display text-3xl">
            {summary.sold.length} sold · {summary.unsold.length} unsold
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-3">
        {items.map((item) => {
          const result = results.find((r) => r.item_id === item.id);
          const winner = participants.find((p) => p.id === result?.participant_id);
          return (
            <div key={item.id} className="bf-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">
                    #{item.item_number ?? item.position + 1} {item.name}
                  </p>
                  <p className="text-sm text-ink-soft/70">
                    {result
                      ? result.outcome === "sold"
                        ? `Sold to ${winner?.display_name ?? "Winner"}`
                        : "Unsold"
                      : item.status}
                  </p>
                </div>
                <p className="font-display text-2xl">
                  {result?.winning_bid != null
                    ? formatMoney(result.winning_bid, auction.currency)
                    : "—"}
                </p>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
