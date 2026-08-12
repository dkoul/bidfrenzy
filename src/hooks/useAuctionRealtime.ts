"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Auction, AuctionItem, AuctionResult, Bid, Participant } from "@/lib/supabase/types";

type LiveState = {
  auction: Auction | null;
  items: AuctionItem[];
  participants: Participant[];
  bids: Bid[];
  results: AuctionResult[];
  loading: boolean;
  error: string | null;
};

export function useAuctionRealtime(auctionId: string | null | undefined) {
  const [state, setState] = useState<LiveState>({
    auction: null,
    items: [],
    participants: [],
    bids: [],
    results: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!auctionId) return;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const [auctionRes, itemsRes, participantsRes, resultsRes] = await Promise.all([
        supabase.from("auctions").select("*").eq("id", auctionId).single(),
        supabase
          .from("auction_items")
          .select("*")
          .eq("auction_id", auctionId)
          .order("position", { ascending: true }),
        supabase
          .from("participants")
          .select("*")
          .eq("auction_id", auctionId)
          .order("joined_at", { ascending: true }),
        supabase.from("auction_results").select("*"),
      ]);

      if (cancelled) return;

      if (auctionRes.error) {
        setState((s) => ({ ...s, loading: false, error: auctionRes.error.message }));
        return;
      }

      const itemIds = (itemsRes.data ?? []).map((i) => i.id);
      let bids: Bid[] = [];
      if (itemIds.length) {
        const bidsRes = await supabase
          .from("bids")
          .select("*")
          .in("item_id", itemIds)
          .order("created_at", { ascending: false })
          .limit(100);
        bids = (bidsRes.data as Bid[]) ?? [];
      }

      const results = ((resultsRes.data as AuctionResult[]) ?? []).filter((r) =>
        itemIds.includes(r.item_id),
      );

      setState({
        auction: auctionRes.data as Auction,
        items: (itemsRes.data as AuctionItem[]) ?? [],
        participants: (participantsRes.data as Participant[]) ?? [],
        bids,
        results,
        loading: false,
        error: null,
      });
    }

    void load();

    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setState((s) => ({ ...s, auction: payload.new as Auction }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_items",
          filter: `auction_id=eq.${auctionId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `auction_id=eq.${auctionId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids" },
        (payload) => {
          const bid = payload.new as Bid;
          setState((s) => {
            const itemIds = s.items.map((i) => i.id);
            if (!itemIds.includes(bid.item_id)) return s;
            return { ...s, bids: [bid, ...s.bids.filter((b) => b.id !== bid.id)].slice(0, 100) };
          });
          void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auction_results" },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [auctionId]);

  return state;
}

export function useAuctionByCode(code: string | null | undefined) {
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const live = useAuctionRealtime(auctionId);

  useEffect(() => {
    if (!code) return;
    const supabase = createClient();
    void (async () => {
      const { data, error: err } = await supabase
        .from("auctions")
        .select("id")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (err) setError(err.message);
      else if (!data) setError("Auction not found");
      else setAuctionId(data.id);
      setLoading(false);
    })();
  }, [code]);

  return {
    ...live,
    loading: loading || live.loading,
    error: error || live.error,
  };
}
