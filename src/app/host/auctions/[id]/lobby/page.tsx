"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuctionRealtime } from "@/hooks/useAuctionRealtime";

export default function HostLobbyPage() {
  const params = useParams<{ id: string }>();
  const { auction, participants, items, loading, error } = useAuctionRealtime(params.id);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const joinUrl = useMemo(() => {
    if (!auction || !origin) return "";
    return `${origin}/join/${auction.code}`;
  }, [auction, origin]);

  async function startAuction() {
    if (!auction) return;
    setBusy(true);
    setActionError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("host_set_auction_status", {
      p_auction_id: auction.id,
      p_status: "live",
      p_phase: "lobby",
    });
    setBusy(false);
    if (err) setActionError(err.message);
  }

  if (loading) return <main className="p-10">Loading lobby…</main>;
  if (error || !auction) return <main className="p-10">{error ?? "Auction missing"}</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/host/auctions/${auction.id}`} className="text-sm font-semibold text-ink-soft/70">
          ← Manage items
        </Link>
        <div className="flex gap-2">
          <Link href={`/display/${auction.code}`} target="_blank" className="bf-btn bf-btn-ghost">
            Big screen
          </Link>
          <Link href={`/host/auctions/${auction.id}/live`} className="bf-btn bf-btn-primary">
            Live control
          </Link>
        </div>
      </div>

      <h1 className="mt-4 font-display text-4xl">{auction.name}</h1>
      <p className="mt-2 text-ink-soft/75">Share the code or QR. Participants join from their phones.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bf-panel flex flex-col items-center rounded-[1.75rem] p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-soft/60">Room code</p>
          <p className="mt-2 font-display text-6xl tracking-widest">{auction.code}</p>
          {joinUrl ? (
            <div className="mt-6 rounded-2xl bg-white p-4">
              <QRCodeSVG value={joinUrl} size={220} bgColor="#ffffff" fgColor="#101820" />
            </div>
          ) : null}
          <p className="mt-4 break-all text-sm text-ink-soft/60">{joinUrl}</p>
        </div>

        <div className="bf-panel rounded-[1.75rem] p-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl">{participants.length} joined</h2>
              <p className="text-sm text-ink-soft/70">{items.length} items ready</p>
            </div>
            {auction.status !== "live" ? (
              <button
                type="button"
                className="bf-btn bf-btn-primary"
                disabled={busy || !items.length}
                onClick={() => void startAuction()}
              >
                {busy ? "Starting…" : "Start auction"}
              </button>
            ) : (
              <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Live
              </span>
            )}
          </div>
          {actionError ? <p className="mt-3 text-sm text-signal-deep">{actionError}</p> : null}
          <ul className="mt-6 max-h-80 space-y-2 overflow-auto">
            {participants.map((p) => (
              <li key={p.id} className="rounded-xl bg-paper-deep/60 px-3 py-2 text-sm font-semibold">
                {p.display_name}
              </li>
            ))}
            {!participants.length ? (
              <li className="text-sm text-ink-soft/60">Waiting for the first phone to join…</li>
            ) : null}
          </ul>
        </div>
      </div>
    </main>
  );
}
