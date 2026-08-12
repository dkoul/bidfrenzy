"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuctionRealtime } from "@/hooks/useAuctionRealtime";
import { formatMoney } from "@/lib/format";

export default function HostLivePage() {
  const params = useParams<{ id: string }>();
  const { auction, items, participants, bids, loading, error } = useAuctionRealtime(params.id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentItem = useMemo(
    () => items.find((i) => i.id === auction?.current_item_id) ?? null,
    [items, auction?.current_item_id],
  );
  const pendingItems = useMemo(() => items.filter((i) => i.status === "pending"), [items]);
  const currentBidder = participants.find((p) => p.id === currentItem?.current_bidder_id);
  const recentBids = useMemo(() => {
    if (!currentItem) return [];
    return bids.filter((b) => b.item_id === currentItem.id).slice(0, 12);
  }, [bids, currentItem]);

  async function run(
    action: (
      supabase: ReturnType<typeof createClient>,
    ) => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true);
    setActionError(null);
    const supabase = createClient();
    const { error: err } = await action(supabase);
    setBusy(false);
    if (err) setActionError(err.message);
  }

  if (loading) return <main className="p-10">Loading live controls…</main>;
  if (error || !auction) return <main className="p-10">{error ?? "Auction missing"}</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/host/auctions/${auction.id}/lobby`} className="text-sm font-semibold text-ink-soft/70">
            ← Lobby
          </Link>
          <h1 className="mt-2 font-display text-4xl">{auction.name}</h1>
          <p className="text-sm text-ink-soft/70">
            {auction.status} · {auction.phase} · {participants.length} bidders
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/display/${auction.code}`} target="_blank" className="bf-btn bf-btn-ghost">
            Display
          </Link>
          <Link href={`/host/auctions/${auction.id}/summary`} className="bf-btn bf-btn-ghost">
            Summary
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="bf-panel rounded-[1.75rem] p-6">
          {currentItem ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft/55">Current item</p>
              <h2 className="mt-2 font-display text-4xl">{currentItem.name}</h2>
              <p className="mt-6 text-sm uppercase tracking-widest text-ink-soft/55">Current bid</p>
              <p className="font-display text-6xl text-signal">
                {formatMoney(currentItem.current_bid ?? currentItem.starting_price, auction.currency)}
              </p>
              <p className="mt-2 text-ink-soft/75">
                Highest: {currentBidder?.display_name ?? "—"} · {currentItem.bid_count} bids
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl">No item open</h2>
              <p className="mt-2 text-ink-soft/70">Open the next item to start receiving bids.</p>
            </>
          )}

          {actionError ? <p className="mt-4 text-sm text-signal-deep">{actionError}</p> : null}

          <div className="mt-8 flex flex-wrap gap-2">
            {pendingItems[0] ? (
              <button
                type="button"
                className="bf-btn bf-btn-primary"
                disabled={busy || !!currentItem}
                onClick={() =>
                  void run((supabase) =>
                    supabase.rpc("host_open_item", {
                      p_auction_id: auction.id,
                      p_item_id: pendingItems[0].id,
                    }),
                  )
                }
              >
                Open bidding
              </button>
            ) : null}
            <button
              type="button"
              className="bf-btn bf-btn-dark"
              disabled={busy || !currentItem || currentItem.status !== "open"}
              onClick={() =>
                void run((supabase) =>
                  supabase.rpc("host_close_item", { p_auction_id: auction.id }),
                )
              }
            >
              Close bidding
            </button>
            <button
              type="button"
              className="bf-btn bf-btn-primary"
              disabled={busy || !currentItem || !["closed", "open"].includes(currentItem.status)}
              onClick={() =>
                void run((supabase) =>
                  supabase.rpc("host_resolve_item", {
                    p_auction_id: auction.id,
                    p_outcome: "sold",
                  }),
                )
              }
            >
              Mark sold
            </button>
            <button
              type="button"
              className="bf-btn bf-btn-ghost"
              disabled={busy || !currentItem}
              onClick={() =>
                void run((supabase) =>
                  supabase.rpc("host_resolve_item", {
                    p_auction_id: auction.id,
                    p_outcome: "unsold",
                  }),
                )
              }
            >
              Unsold
            </button>
            <button
              type="button"
              className="bf-btn bf-btn-ghost"
              disabled={busy || auction.phase !== "item_result"}
              onClick={() =>
                void run((supabase) =>
                  supabase.rpc("host_next_item", { p_auction_id: auction.id }),
                )
              }
            >
              Next item
            </button>
          </div>
        </section>

        <section className="bf-panel rounded-[1.75rem] p-6">
          <h3 className="font-display text-2xl">Live bids</h3>
          <ul className="mt-4 max-h-[28rem] space-y-2 overflow-auto">
            {recentBids.map((bid) => {
              const bidder = participants.find((p) => p.id === bid.participant_id);
              return (
                <li key={bid.id} className="flex items-center justify-between rounded-xl bg-paper-deep/50 px-3 py-2">
                  <span className="font-semibold">{bidder?.display_name ?? "Bidder"}</span>
                  <span className="font-display text-lg text-signal">
                    {formatMoney(bid.amount, auction.currency)}
                  </span>
                </li>
              );
            })}
            {!recentBids.length ? (
              <li className="text-sm text-ink-soft/60">Bids will stream in here.</li>
            ) : null}
          </ul>

          <h3 className="mt-8 font-display text-xl">Up next</h3>
          <ul className="mt-3 space-y-2">
            {pendingItems.slice(0, 5).map((item) => (
              <li key={item.id} className="text-sm font-semibold text-ink-soft/80">
                #{item.item_number ?? item.position + 1} {item.name}
              </li>
            ))}
            {!pendingItems.length ? <li className="text-sm text-ink-soft/60">No pending items</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
