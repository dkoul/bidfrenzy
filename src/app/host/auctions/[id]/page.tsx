"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Auction, AuctionItem } from "@/lib/supabase/types";

export default function ManageAuctionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auctionId = params.id;
  const [auction, setAuction] = useState<Auction | null>(null);
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const supabase = createClient();
    const [{ data: a, error: ae }, { data: i, error: ie }] = await Promise.all([
      supabase.from("auctions").select("*").eq("id", auctionId).single(),
      supabase
        .from("auction_items")
        .select("*")
        .eq("auction_id", auctionId)
        .order("position", { ascending: true }),
    ]);
    if (ae) setError(ae.message);
    if (ie) setError(ie.message);
    setAuction(a as Auction | null);
    setItems((i as AuctionItem[]) ?? []);
  }

  useEffect(() => {
    void refresh();
  }, [auctionId]);

  const joinUrl = useMemo(() => {
    if (!auction || typeof window === "undefined") return "";
    return `${window.location.origin}/join/${auction.code}`;
  }, [auction]);

  async function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auction) return;
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const position = items.length;
    const { error: err } = await supabase.from("auction_items").insert({
      auction_id: auction.id,
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim() || null,
      starting_price: Number(form.get("starting") || auction.default_starting_bid),
      minimum_increment: Number(form.get("increment") || auction.default_bid_increment),
      position,
      item_number: position + 1,
      image_url: String(form.get("image_url") || "").trim() || null,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    e.currentTarget.reset();
    await refresh();
  }

  async function makeReady() {
    if (!auction) return;
    const supabase = createClient();
    const { error: err } = await supabase.rpc("host_set_auction_status", {
      p_auction_id: auction.id,
      p_status: "ready",
      p_phase: "lobby",
    });
    if (err) setError(err.message);
    else router.push(`/host/auctions/${auction.id}/lobby`);
  }

  async function deleteItem(id: string) {
    const supabase = createClient();
    await supabase.from("auction_items").delete().eq("id", id);
    await refresh();
  }

  if (!auction) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p>{error ?? "Loading auction…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/host" className="text-sm font-semibold text-ink-soft/70">
          ← Dashboard
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link href={`/display/${auction.code}`} className="bf-btn bf-btn-ghost" target="_blank">
            Open display
          </Link>
          <Link href={`/host/auctions/${auction.id}/lobby`} className="bf-btn bf-btn-ghost">
            Lobby
          </Link>
          <Link href={`/host/auctions/${auction.id}/live`} className="bf-btn bf-btn-ghost">
            Live control
          </Link>
          <Link href={`/host/auctions/${auction.id}/summary`} className="bf-btn bf-btn-ghost">
            Summary
          </Link>
        </div>
      </div>

      <h1 className="mt-4 font-display text-4xl">{auction.name}</h1>
      <p className="mt-2 text-ink-soft/75">
        Room code <span className="font-bold text-ink">{auction.code}</span> · status {auction.status}
      </p>
      {joinUrl ? (
        <p className="mt-1 text-sm text-ink-soft/60">Join URL: {joinUrl}</p>
      ) : null}

      <section className="bf-panel mt-8 rounded-[1.5rem] p-6">
        <h2 className="font-display text-2xl">Add item</h2>
        <form onSubmit={addItem} className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="bf-label" htmlFor="name">
                Item name
              </label>
              <input id="name" name="name" required className="bf-input" placeholder="Weekend getaway" />
            </div>
            <div>
              <label className="bf-label" htmlFor="image_url">
                Image URL
              </label>
              <input id="image_url" name="image_url" className="bf-input" placeholder="https://…" />
            </div>
          </div>
          <div>
            <label className="bf-label" htmlFor="description">
              Description
            </label>
            <textarea id="description" name="description" className="bf-input min-h-20" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="bf-label" htmlFor="starting">
                Starting price
              </label>
              <input
                id="starting"
                name="starting"
                type="number"
                min={1}
                defaultValue={auction.default_starting_bid}
                className="bf-input"
              />
            </div>
            <div>
              <label className="bf-label" htmlFor="increment">
                Minimum increment
              </label>
              <input
                id="increment"
                name="increment"
                type="number"
                min={1}
                defaultValue={auction.default_bid_increment}
                className="bf-input"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-signal-deep">{error}</p> : null}
          <button type="submit" className="bf-btn bf-btn-dark w-fit" disabled={saving}>
            {saving ? "Adding…" : "Add item"}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Items ({items.length})</h2>
        <div className="mt-4 grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="bf-panel flex items-start justify-between gap-4 rounded-2xl p-4">
              <div>
                <p className="font-bold">
                  #{item.item_number ?? item.position + 1} {item.name}
                </p>
                <p className="text-sm text-ink-soft/70">
                  Start {formatMoney(item.starting_price, auction.currency)} · +
                  {formatMoney(item.minimum_increment, auction.currency)} · {item.status}
                </p>
              </div>
              {auction.status === "draft" ? (
                <button type="button" className="bf-btn bf-btn-ghost" onClick={() => void deleteItem(item.id)}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {auction.status === "draft" ? (
        <button
          type="button"
          className="bf-btn bf-btn-primary mt-8"
          disabled={!items.length}
          onClick={() => void makeReady()}
        >
          Ready room & open lobby
        </button>
      ) : (
        <Link href={`/host/auctions/${auction.id}/lobby`} className="bf-btn bf-btn-primary mt-8 inline-flex">
          Go to lobby
        </Link>
      )}
    </main>
  );
}
