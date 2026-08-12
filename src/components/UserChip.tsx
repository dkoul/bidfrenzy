"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/useUser";

type UserChipProps = {
  tone?: "light" | "dark";
  showHostLogin?: boolean;
};

export function UserChip({ tone = "light", showHostLogin = true }: UserChipProps) {
  const { user, loading } = useUser();
  const router = useRouter();

  const isDark = tone === "dark";
  const chipClass = isDark
    ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
    : "border-[var(--line)] bg-white text-ink hover:bg-paper-deep/80";
  const muted = isDark ? "text-white/65" : "text-ink-soft/65";

  if (loading) {
    return (
      <div
        className={`h-10 w-28 animate-pulse rounded-full border ${isDark ? "border-white/10 bg-white/10" : "border-[var(--line)] bg-white/70"}`}
        aria-hidden
      />
    );
  }

  if (!user) {
    if (!showHostLogin) return null;
    return (
      <Link
        href="/host/login"
        className={`bf-btn ${isDark ? "bf-btn-primary" : "bf-btn-dark"}`}
      >
        Host login
      </Link>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Host";
  const avatar =
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    null;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className={`flex items-center gap-2 rounded-full border px-2 py-1.5 ${chipClass}`}>
      <Link href="/host" className="flex min-w-0 items-center gap-2">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-signal text-sm font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate text-sm font-semibold sm:inline">
          {name}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className={`rounded-full px-2 py-1 text-xs font-bold ${muted}`}
      >
        Sign out
      </button>
    </div>
  );
}
