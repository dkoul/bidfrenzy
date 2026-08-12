"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { nanoid } from "nanoid";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuctionByCode } from "@/hooks/useAuctionRealtime";
import { formatMoney, nextBidAmount, participantKey, sessionKey } from "@/lib/format";
import type { Participant } from "@/lib/supabase/types";

export default function JoinRoomPage() {
  const params = useParams<{ code: string }>();
  const code = params.code.toUpperCase();
  const { auction, items, participants, loading, error } = useAuctionByCode(code);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!auction) return;
    const raw = localStorage.getItem(participantKey(auction.code));
    if (raw) {
      try {
        setParticipant(JSON.parse(raw) as Participant);
      } catch {
        /* ignore */
      }
    }
  }, [auction]);

  const currentItem = useMemo(
    () => items.find((i) => i.id === auction?.current_item_id) ?? null,
    [items, auction?.current_item_id],
  );
  const currentBidder = participants.find((p) => p.id === currentItem?.current_bidder_id);
  const isHighest = !!(participant && currentItem?.current_bidder_id === participant.id);
  const isOutbid = !!(
    participant &&
    currentItem?.current_bidder_id &&
    currentItem.current_bidder_id !== participant.id &&
    currentItem.bid_count > 0
  );
  const nextAmount = currentItem
    ? nextBidAmount(currentItem.current_bid, currentItem.starting_price, currentItem.minimum_increment)
    : 0;

  async function join(e: FormEvent) {
    e.preventDefault();
    if (!auction) return;
    setJoining(true);
    setJoinError(null);
    const supabase = createClient();
    let sessionId = localStorage.getItem(sessionKey(auction.code));
    if (!sessionId) {
      sessionId = nanoid(24);
      localStorage.setItem(sessionKey(auction.code), sessionId);
    }
    const { data, error: err } = await supabase.rpc("join_auction", {
      p_code: auction.code,
      p_display_name: name.trim(),
      p_session_id: sessionId,
    });
    setJoining(false);
    if (err || !data) {
      setJoinError(err?.message ?? "Could not join");
      return;
    }
    localStorage.setItem(participantKey(auction.code), JSON.stringify(data));
    setParticipant(data as Participant);
  }

  async function placeBid() {
    if (!auction || !currentItem || !participant) return;
    setBidding(true);
    setBidError(null);
    const supabase = createClient();
    const sessionId = localStorage.getItem(sessionKey(auction.code));
    if (!sessionId) {
      setBidError("Session missing — rejoin the room");
      setBidding(false);
      return;
    }
    const { error: err } = await supabase.rpc("place_bid", {
      p_item_id: currentItem.id,
      p_session_id: sessionId,
      p_amount: nextAmount,
      p_client_request_id: nanoid(16),
    });
    setBidding(false);
    if (err) {
      setBidError(err.message);
      return;
    }
    setPulse(true);
    setTimeout(() => setPulse(false), 450);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="font-display text-2xl">Joining {code}…</p>
      </main>
    );
  }

  if (error || !auction) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="bf-panel max-w-md rounded-2xl p-8 text-center">
          <h1 className="font-display text-3xl">Room not found</h1>
          <p className="mt-2 text-ink-soft/70">{error ?? "Check the code and try again."}</p>
        </div>
      </main>
    );
  }

  if (!participant) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-soft/55">Room {auction.code}</p>
        <h1 className="mt-2 font-display text-4xl">{auction.name}</h1>
        <p className="mt-2 text-ink-soft/75">Enter a display name — no account needed.</p>
        <form onSubmit={join} className="bf-panel mt-8 rounded-[1.5rem] p-6">
          <label className="bf-label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="bf-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            required
            placeholder="Maya"
          />
          {joinError ? <p className="mt-3 text-sm text-signal-deep">{joinError}</p> : null}
          <button type="submit" className="bf-btn bf-btn-primary mt-5 w-full" disabled={joining}>
            {joining ? "Joining…" : "Join room"}
          </button>
        </form>
      </main>
    );
  }

  if (auction.status === "completed") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <h1 className="font-display text-4xl">Auction finished</h1>
        <p className="mt-3 text-ink-soft/75">Thanks for bidding, {participant.display_name}.</p>
      </main>
    );
  }

  if (!currentItem || auction.phase === "lobby") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-mint">You&apos;re in</p>
        <h1 className="mt-3 font-display text-4xl">Waiting room</h1>
        <p className="mt-3 text-ink-soft/75">
          Hi {participant.display_name}. {participants.length} people here. Hang tight for the next item.
        </p>
        <div className="mt-8 overflow-hidden rounded-full bg-ink/10">
          <motion.div
            className="h-2 bg-signal"
            initial={{ width: "15%" }}
            animate={{ width: ["15%", "85%", "40%", "95%", "30%"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </main>
    );
  }

  if (auction.phase === "item_result" && currentItem) {
    const won = currentItem.status === "sold" && currentItem.current_bidder_id === participant.id;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bf-panel rounded-[1.75rem] p-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-soft/55">
              {currentItem.name}
            </p>
            <h1 className="mt-3 font-display text-5xl">
              {currentItem.status === "sold" ? (won ? "You won!" : "Sold") : "Unsold"}
            </h1>
            {currentItem.status === "sold" ? (
              <p className="mt-4 font-display text-3xl text-signal">
                {formatMoney(currentItem.current_bid, auction.currency)}
              </p>
            ) : null}
            <p className="mt-4 text-ink-soft/70">Waiting for the next item…</p>
          </motion.div>
        </AnimatePresence>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-soft/60">Room {auction.code}</p>
        <p className="text-sm font-semibold text-ink-soft/60">{participant.display_name}</p>
      </div>

      <section className={`bf-panel mt-6 flex-1 rounded-[1.75rem] p-6 ${pulse ? "bid-pulse" : ""}`}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft/55">Current item</p>
        <h1 className="mt-2 font-display text-4xl leading-none">{currentItem?.name}</h1>
        {currentItem?.description ? (
          <p className="mt-3 text-sm text-ink-soft/70">{currentItem.description}</p>
        ) : null}

        <p className="mt-10 text-sm uppercase tracking-widest text-ink-soft/55">Current bid</p>
        <p className="font-display text-6xl text-signal">
          {formatMoney(currentItem?.current_bid ?? currentItem?.starting_price, auction.currency)}
        </p>
        <p className="mt-2 text-ink-soft/75">
          {currentBidder ? `Highest: ${currentBidder.display_name}` : "Be the first bidder"}
        </p>

        <AnimatePresence>
          {isOutbid ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5 rounded-2xl bg-signal/10 px-4 py-3 text-sm font-bold text-signal-deep"
            >
              You&apos;ve been outbid — tap to jump to{" "}
              {formatMoney(nextAmount, auction.currency)}
            </motion.div>
          ) : null}
          {isHighest ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-2xl bg-mint/15 px-4 py-3 text-sm font-bold text-mint"
            >
              You&apos;re the highest bidder
            </motion.div>
          ) : null}
        </AnimatePresence>

        {auction.phase === "item_closed" ? (
          <p className="mt-8 text-center font-display text-2xl">Bidding closed</p>
        ) : (
          <button
            type="button"
            className="bf-btn bf-btn-primary mt-8 w-full py-5 text-xl"
            disabled={bidding || !currentItem || currentItem.status !== "open"}
            onClick={() => void placeBid()}
          >
            {bidding ? "Bidding…" : `BID ${formatMoney(nextAmount, auction.currency)}`}
          </button>
        )}
        {bidError ? <p className="mt-3 text-center text-sm text-signal-deep">{bidError}</p> : null}
        <p className="mt-5 text-center text-sm text-ink-soft/60">
          {participants.length} people are bidding
        </p>
      </section>
    </main>
  );
}
