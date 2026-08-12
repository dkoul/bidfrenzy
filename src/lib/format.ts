const currencySymbols: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function formatMoney(amount: number | null | undefined, currency = "INR") {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  const symbol = currencySymbols[currency] ?? `${currency} `;
  return `${symbol}${Number(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

export function nextBidAmount(
  currentBid: number | null | undefined,
  startingPrice: number,
  minimumIncrement: number,
) {
  if (currentBid == null) return startingPrice;
  return Number(currentBid) + Number(minimumIncrement);
}

export function sessionKey(auctionIdOrCode: string) {
  return `bidfrenzy_session_${auctionIdOrCode.toUpperCase()}`;
}

export function participantKey(auctionIdOrCode: string) {
  return `bidfrenzy_participant_${auctionIdOrCode.toUpperCase()}`;
}
