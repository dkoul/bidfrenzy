import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export default async function HostDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/host/login");

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Host dashboard</h1>
          <p className="mt-1 text-sm text-ink-soft/70">Your live bidding rooms</p>
        </div>
        <Link href="/host/auctions/new" className="bf-btn bf-btn-primary">
          New auction
        </Link>
      </header>

      {!auctions?.length ? (
        <div className="bf-panel rounded-[1.5rem] p-10 text-center">
          <h2 className="font-display text-2xl">No auctions yet</h2>
          <p className="mt-2 text-ink-soft/75">Create your first room and share the QR.</p>
          <Link href="/host/auctions/new" className="bf-btn bf-btn-primary mt-6">
            Create auction
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {auctions.map((auction) => (
            <Link
              key={auction.id}
              href={`/host/auctions/${auction.id}`}
              className="bf-panel block rounded-2xl p-5 transition hover:-translate-y-0.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{auction.name}</h2>
                  <p className="mt-1 text-sm text-ink-soft/70">
                    Code {auction.code} · {formatMoney(auction.default_starting_bid, auction.currency)}{" "}
                    start · +{formatMoney(auction.default_bid_increment, auction.currency)}
                  </p>
                </div>
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {auction.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
