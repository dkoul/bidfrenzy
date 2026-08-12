"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuctionByCode } from "@/hooks/useAuctionRealtime";
import { formatMoney } from "@/lib/format";

export default function DisplayPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { auction, items, participants, bids, loading, error } = useAuctionByCode(code);
  const [origin, setOrigin] = useState("");
  const [flashBidId, setFlashBidId] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const currentItem = useMemo(
    () => items.find((i) => i.id === auction?.current_item_id) ?? null,
    [items, auction?.current_item_id],
  );
  const currentBidder = participants.find((p) => p.id === currentItem?.current_bidder_id);
  const recentBids = useMemo(() => {
    if (!currentItem) return [];
    return bids.filter((b) => b.item_id === currentItem.id).slice(0, 8);
  }, [bids, currentItem]);

  useEffect(() => {
    if (!recentBids[0]) return;
    setFlashBidId(recentBids[0].id);
    const t = setTimeout(() => setFlashBidId(null), 700);
    return () => clearTimeout(t);
  }, [recentBids[0]?.id]);

  const joinUrl = origin && auction ? `${origin}/join/${auction.code}` : "";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-white">
        <p className="font-display text-4xl">Loading display…</p>
      </main>
    );
  }

  if (error || !auction) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-white">
        <p className="font-display text-3xl">{error ?? "Auction not found"}</p>
      </main>
    );
  }

  const showLobby =
    auction.phase === "lobby" || !currentItem || auction.status === "ready";

  if (showLobby && auction.status !== "completed") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(255,77,46,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(240,180,41,0.2),transparent_30%),linear-gradient(160deg,#0b1220,#152033_50%,#0b1220)] px-8 text-white">
        <p className="font-display text-5xl sm:text-7xl">BidFrenzy</p>
        <p className="mt-4 text-xl text-white/70">{auction.name}</p>
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#f0b429]">Join now</p>
            <p className="mt-3 font-display text-7xl tracking-[0.2em] sm:text-8xl">{auction.code}</p>
            <p className="mt-6 text-2xl text-white/70">{participants.length} phones in the room</p>
          </div>
          {joinUrl ? (
            <div className="mx-auto rounded-[2rem] bg-white p-6">
              <QRCodeSVG value={joinUrl} size={280} />
            </div>
          ) : null}
        </div>
      </main>
    );
  }

  if (auction.status === "completed") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-8 text-white">
        <p className="font-display text-6xl">Auction complete</p>
        <p className="mt-4 text-2xl text-white/70">{auction.name}</p>
      </main>
    );
  }

  if (auction.phase === "item_result" && currentItem) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-8 text-white">
        <AnimatePresence>
          <motion.div
            key={currentItem.id + currentItem.status}
            className="sold-burst text-center"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-xl uppercase tracking-[0.25em] text-white/50">{currentItem.name}</p>
            <h1 className="mt-4 font-display text-8xl text-signal sm:text-9xl">
              {currentItem.status === "sold" ? "SOLD" : "UNSOLD"}
            </h1>
            {currentItem.status === "sold" ? (
              <>
                <p className="mt-6 font-display text-5xl">
                  {formatMoney(currentItem.current_bid, auction.currency)}
                </p>
                <p className="mt-3 text-2xl text-white/70">
                  Winner: {currentBidder?.display_name ?? "—"}
                </p>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[linear-gradient(160deg,#0b1220,#152033_45%,#101820)] px-8 py-10 text-white">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-3xl">BidFrenzy</p>
          <p className="text-white/55">{auction.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm uppercase tracking-[0.2em] text-white/45">Room</p>
          <p className="font-display text-3xl tracking-widest">{auction.code}</p>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#f0b429]">Now bidding</p>
        <h1 className="mt-3 font-display text-6xl leading-none sm:text-8xl">{currentItem?.name}</h1>
        <p className="mt-10 text-sm uppercase tracking-[0.25em] text-white/45">Current bid</p>
        <motion.p
          key={currentItem?.current_bid ?? "start"}
          initial={{ scale: 0.92, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-display text-7xl text-signal sm:text-9xl ${flashBidId ? "bid-pulse" : ""}`}
        >
          {formatMoney(currentItem?.current_bid ?? currentItem?.starting_price, auction.currency)}
        </motion.p>
        <p className="mt-4 text-2xl text-white/70">
          {currentBidder ? currentBidder.display_name : "Waiting for first bid"} ·{" "}
          {participants.length} bidding
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl bg-white/5 py-3">
          <div className="bid-ticker gap-10 px-4 text-lg text-white/65">
            {recentBids.length
              ? [...recentBids, ...recentBids].map((bid, idx) => {
                  const bidder = participants.find((p) => p.id === bid.participant_id);
                  return (
                    <span key={`${bid.id}-${idx}`}>
                      {bidder?.display_name ?? "Bidder"} ·{" "}
                      {formatMoney(bid.amount, auction.currency)}
                    </span>
                  );
                })
              : Array.from({ length: 6 }).map((_, i) => (
                  <span key={i}>Waiting for bids…</span>
                ))}
          </div>
        </div>
      </section>
    </main>
  );
}
