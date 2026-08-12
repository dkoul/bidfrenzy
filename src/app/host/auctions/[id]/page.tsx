"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Auction, AuctionItem } from "@/lib/supabase/types";

export default function ManageAuctionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auctionId = params.id;
  const formRef = useRef<HTMLFormElement>(null);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data: a, error: ae }, { data: i, error: ie }] = await Promise.all([
      supabase.from("auctions").select("*").eq("id", auctionId).single(),
      supabase
        .from("auction_items")
        .select("*")
        .eq("auction_id", auctionId)
        .order("position", { ascending: true }),
    ]);
    if (ae) {
      setError(ae.message);
      setLoading(false);
      return;
    }
    if (ie) setError(ie.message);
    else setError(null);
    setAuction(a as Auction | null);
    setItems((i as AuctionItem[]) ?? []);
    setLoading(false);
  }, [auctionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const joinUrl = useMemo(() => {
    if (!auction || typeof window === "undefined") return "";
    return `${window.location.origin}/join/${auction.code}`;
  }, [auction]);

  async function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!auction) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const form = formRef.current ?? e.currentTarget;
    const formData = new FormData(form);
    const itemName = String(formData.get("name") || "").trim();
    if (!itemName) {
      setError("Item name is required.");
      setSaving(false);
      return;
    }

    const startingPrice = Number(formData.get("starting") || auction.default_starting_bid);
    const minimumIncrement = Number(formData.get("increment") || auction.default_bid_increment);
    const description = String(formData.get("description") || "").trim() || null;
    const imageUrl = String(formData.get("image_url") || "").trim() || null;
    const position = items.length;

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("auction_items")
      .insert({
        auction_id: auction.id,
        name: itemName,
        description,
        starting_price: startingPrice,
        minimum_increment: minimumIncrement,
        position,
        item_number: position + 1,
        image_url: imageUrl,
      })
      .select("*")
      .single();

    setSaving(false);

    if (err || !data) {
      setError(err?.message ?? "Could not add item. Check that you are signed in as the host.");
      return;
    }

    const created = data as AuctionItem;
    setItems((prev) => [...prev, created]);
    setSuccess(`“${itemName}” added to the auction.`);
    form.reset();

    // Keep server state in sync; don't clear the success toast on refresh.
    void refresh().then(() => {
      setSuccess(`“${itemName}” added to the auction.`);
    });
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

  async function deleteItem(item: AuctionItem) {
    if (!auction) return;
    if (item.status !== "pending") {
      setError("Only pending items can be deleted.");
      setSuccess(null);
      return;
    }
    if (auction.current_item_id === item.id) {
      setError("Close or finish the current item before deleting it.");
      setSuccess(null);
      return;
    }
    const confirmed = window.confirm(`Delete “${item.name}”?`);
    if (!confirmed) return;

    setError(null);
    setSuccess(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("auction_items").delete().eq("id", item.id);
    if (err) {
      setError(err.message);
      return;
    }

    const remaining = items
      .filter((i) => i.id !== item.id)
      .sort((a, b) => a.position - b.position);
    setItems(
      remaining.map((i, index) => ({
        ...i,
        position: index,
        item_number: index + 1,
      })),
    );
    setSuccess(`“${item.name}” deleted.`);

    await Promise.all(
      remaining.map((i, index) =>
        supabase
          .from("auction_items")
          .update({ position: index, item_number: index + 1 })
          .eq("id", i.id),
      ),
    );
    await refresh();
    setSuccess(`“${item.name}” deleted.`);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p>Loading auction…</p>
      </main>
    );
  }

  if (!auction) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p>{error ?? "Auction not found"}</p>
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

      {error ? (
        <p className="mt-4 rounded-xl bg-signal/10 px-3 py-2 text-sm font-semibold text-signal-deep">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 rounded-xl bg-mint/15 px-3 py-2 text-sm font-semibold text-mint"
        >
          {success}
        </p>
      ) : null}

      <section className="bf-panel mt-8 rounded-[1.5rem] p-6">
        <h2 className="font-display text-2xl">Add item</h2>
        <form ref={formRef} onSubmit={addItem} className="mt-4 grid gap-4">
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
          <button type="submit" className="bf-btn bf-btn-dark w-fit" disabled={saving}>
            {saving ? "Adding…" : "Add item"}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Items ({items.length})</h2>
        {!items.length ? (
          <p className="mt-4 text-sm text-ink-soft/60">No items yet. Add one above.</p>
        ) : null}
        <div className="mt-4 grid gap-3">
          {items.map((item) => {
            const canDelete =
              item.status === "pending" && auction.current_item_id !== item.id;
            return (
              <div
                key={item.id}
                className="bf-panel flex items-start justify-between gap-4 rounded-2xl p-4"
              >
                <div>
                  <p className="font-bold">
                    #{item.item_number ?? item.position + 1} {item.name}
                  </p>
                  <p className="text-sm text-ink-soft/70">
                    Start {formatMoney(item.starting_price, auction.currency)} · +
                    {formatMoney(item.minimum_increment, auction.currency)} · {item.status}
                  </p>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    className="bf-btn shrink-0 border border-signal/30 bg-signal/10 text-signal-deep"
                    onClick={() => void deleteItem(item)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            );
          })}
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
