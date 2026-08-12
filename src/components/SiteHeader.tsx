"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserChip } from "@/components/UserChip";
import { useUser } from "@/hooks/useUser";

export function SiteHeader() {
  const pathname = usePathname();
  const { user } = useUser();

  // Keep the TV/projector display clean.
  if (pathname?.startsWith("/display/")) return null;

  const isHome = pathname === "/";
  const isHostLogin = pathname === "/host/login";

  if (isHome) {
    return (
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-white">
        <Link href="/" className="font-display text-2xl tracking-tight">
          BidFrenzy
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/join" className="bf-btn bf-btn-ghost border-white/20 text-white">
            Join room
          </Link>
          {user ? (
            <Link href="/host" className="bf-btn border border-white/25 bg-white/10 text-white">
              Dashboard
            </Link>
          ) : null}
          <UserChip tone="dark" />
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-20 border-b border-[var(--line)] bg-[rgba(255,252,247,0.75)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-2xl tracking-tight">
            BidFrenzy
          </Link>
          {!isHostLogin ? (
            <Link href="/join" className="text-sm font-semibold text-ink-soft/70 hover:text-ink">
              Join room
            </Link>
          ) : null}
          {user ? (
            <Link href="/host" className="text-sm font-semibold text-ink-soft/70 hover:text-ink">
              Dashboard
            </Link>
          ) : null}
        </div>
        <UserChip tone="light" showHostLogin={!isHostLogin} />
      </div>
    </header>
  );
}
