export type AuctionStatus = "draft" | "ready" | "live" | "completed";
export type AuctionPhase =
  | "lobby"
  | "item_open"
  | "bidding"
  | "item_closed"
  | "item_result";
export type ItemStatus = "pending" | "open" | "closed" | "sold" | "unsold";
export type ResultOutcome = "sold" | "unsold";

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Auction = {
  id: string;
  host_id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  default_starting_bid: number;
  default_bid_increment: number;
  status: AuctionStatus;
  phase: AuctionPhase;
  current_item_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

export type AuctionItem = {
  id: string;
  auction_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  starting_price: number;
  minimum_increment: number;
  current_bid: number | null;
  current_bidder_id: string | null;
  bid_count: number;
  position: number;
  item_number: number | null;
  status: ItemStatus;
  created_at: string;
};

export type Participant = {
  id: string;
  auction_id: string;
  display_name: string;
  session_id: string;
  joined_at: string;
  expires_at: string;
};

export type Bid = {
  id: string;
  item_id: string;
  participant_id: string;
  amount: number;
  created_at: string;
  client_request_id: string | null;
};

export type AuctionResult = {
  id: string;
  item_id: string;
  participant_id: string | null;
  winning_bid: number | null;
  outcome: ResultOutcome;
  created_at: string;
};
