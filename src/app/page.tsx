"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,77,46,0.22),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(240,180,41,0.18),transparent_30%),linear-gradient(135deg,#101820_0%,#1c2a3a_55%,#0f171f_100%)]" />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-white">
        <div className="font-display text-2xl tracking-tight">BidFrenzy</div>
        <div className="flex items-center gap-3">
          <Link href="/join" className="bf-btn bf-btn-ghost border-white/20 text-white">
            Join room
          </Link>
          <Link href="/host/login" className="bf-btn bf-btn-primary">
            Host login
          </Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[78vh] w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={mounted ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.5 }}
            className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#f0b429]"
          >
            Live event bidding
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={mounted ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="font-display text-5xl leading-[0.95] text-white sm:text-7xl"
          >
            BidFrenzy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={mounted ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mt-5 max-w-xl text-lg text-white/75"
          >
            Mentimeter for live auctions. Open a room, flash a QR, and watch phones light up as
            the room fights for the next item.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={mounted ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link href="/host/login" className="bf-btn bf-btn-primary text-base">
              Create an auction
            </Link>
            <Link
              href="/join"
              className="bf-btn border border-white/25 bg-white/10 text-white backdrop-blur"
            >
              Enter room code
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={mounted ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,77,46,0.45),transparent_70%)]" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Now bidding</p>
          <h2 className="mt-3 font-display text-3xl">Sony WH-1000XM6</h2>
          <p className="mt-8 text-sm uppercase tracking-widest text-white/50">Current bid</p>
          <p className="font-display text-6xl text-[#ff4d2e]">₹5,500</p>
          <div className="mt-8 flex items-center justify-between gap-4">
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm">12 people bidding</span>
            <span className="rounded-full bg-[#ff4d2e] px-4 py-2 text-sm font-bold">BID ₹6,000</span>
          </div>
          <div className="mt-6 overflow-hidden rounded-xl bg-black/25 py-2">
            <div className="bid-ticker gap-8 px-4 text-sm text-white/70">
              <span>Maya · ₹5,500</span>
              <span>Arjun · ₹5,000</span>
              <span>Leah · ₹4,500</span>
              <span>Omar · ₹4,000</span>
              <span>Maya · ₹5,500</span>
              <span>Arjun · ₹5,000</span>
              <span>Leah · ₹4,500</span>
              <span>Omar · ₹4,000</span>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
