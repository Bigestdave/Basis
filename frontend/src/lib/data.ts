export const account = {
  holder: "Ava Mercado",
  primaryWallet: "0x7f42…3c21",
  primaryChain: "Base",
  asOf: "Today, 2:14 PM",
  creditLimit: 18000,
  available: 14200,
  borrowed: 3800,
  interestAccrued: 27.41,
  apr: 8.4,
  nextPayment: 312,
  nextPaymentDate: "March 1",
  openedOn: "March 18, 2025",
  reviewDate: "March 5",
};

export const evidence = {
  rating: "Strong",
  strength: 4, // of 5
  lastVerified: "2 hours ago",
  transactionsReviewed: 412,
  qualifyingEvents: 8,
  summary:
    "Eight economic events across two protocols, funded from three unrelated sources and settled with six distinct counterparties.",
  headline: [
    { label: "Verified economic events", value: "8" },
    { label: "Independent funding sources", value: "3" },
    { label: "Unique counterparties", value: "6" },
    { label: "Protocols", value: "2" },
  ],
};

export type Factor = {
  name: string;
  value: string;
  note: string;
  strength: number; // 0–4
  detail: string;
  contribution: string;
};

export const factors: Factor[] = [
  {
    name: "Funding independence",
    value: "3 sources",
    note: "Capital arrives from three origins with no shared history",
    strength: 4,
    detail:
      "Deposits originate from a payroll contract, a centralised exchange withdrawal and a counterparty settlement. None of the three share a funding ancestor, so a single source failing would not remove your income.",
    contribution: "+$6,400 of limit",
  },
  {
    name: "Counterparty diversity",
    value: "6 counterparties",
    note: "Settled with six addresses that are unrelated to each other",
    strength: 4,
    detail:
      "Six distinct addresses have sent or received value in a settlement context. Repeated transfers between your own wallets are excluded from this count.",
    contribution: "+$4,100 of limit",
  },
  {
    name: "Protocol depth",
    value: "2 protocols",
    note: "Lending position held 94 days, never withdrawn under stress",
    strength: 3,
    detail:
      "Positions on Aave v3 and Morpho have been maintained through two periods of elevated volatility. Duration of a position is weighted far more heavily than the number of times it is opened.",
    contribution: "+$4,300 of limit",
  },
  {
    name: "Repayment behaviour",
    value: "4 of 4 on time",
    note: "No late or partial repayments since the line opened",
    strength: 4,
    detail:
      "Four scheduled repayments have settled on or before their due date, including one repaid from a different address you control.",
    contribution: "+$3,200 of limit",
  },
  {
    name: "Durability",
    value: "11 months",
    note: "Continuous monthly activity with no gap longer than 19 days",
    strength: 3,
    detail:
      "Economic activity has been present in every month since March 2025. Newer wallets can reach a Strong rating, but the limit ceiling rises with sustained history.",
    contribution: "+$2,000 of limit",
  },
];

export const excluded = {
  count: 404,
  line: "404 transactions were reviewed and did not change your limit — routine transfers between your own wallets, repeated swaps of the same pair, and testnet-style dust.",
};

export type ActivityKind =
  | "deposit"
  | "swap"
  | "lend"
  | "borrow"
  | "repay"
  | "settlement";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  counterparty: string;
  chain: string;
  date: string;
  amount: number;
  direction: "in" | "out" | "neutral";
  evidence: "verified" | "pending" | "none";
  evidenceNote: string;
};

export const activity: ActivityItem[] = [
  {
    id: "a1",
    kind: "repay",
    title: "Repayment to BASIS",
    counterparty: "Scheduled payment",
    chain: "Creditcoin",
    date: "Feb 14",
    amount: 500,
    direction: "out",
    evidence: "verified",
    evidenceNote: "On time",
  },
  {
    id: "a2",
    kind: "deposit",
    title: "USDC deposit",
    counterparty: "Kraken withdrawal",
    chain: "Base",
    date: "Feb 12",
    amount: 5000,
    direction: "in",
    evidence: "verified",
    evidenceNote: "Independent source",
  },
  {
    id: "a3",
    kind: "lend",
    title: "Lending deposit",
    counterparty: "Aave v3",
    chain: "Base",
    date: "Feb 9",
    amount: 4200,
    direction: "out",
    evidence: "verified",
    evidenceNote: "Held 94 days",
  },
  {
    id: "a4",
    kind: "settlement",
    title: "Repayment from 0x4c…9d12",
    counterparty: "Counterparty settlement",
    chain: "Ethereum",
    date: "Feb 6",
    amount: 1250,
    direction: "in",
    evidence: "verified",
    evidenceNote: "New counterparty",
  },
  {
    id: "a5",
    kind: "swap",
    title: "Token swap",
    counterparty: "USDC → ETH · Uniswap v3",
    chain: "Base",
    date: "Feb 4",
    amount: 820,
    direction: "neutral",
    evidence: "none",
    evidenceNote: "Repeat pair — no weight",
  },
  {
    id: "a6",
    kind: "borrow",
    title: "Borrowed from credit line",
    counterparty: "BASIS credit line",
    chain: "Creditcoin",
    date: "Jan 30",
    amount: 3800,
    direction: "in",
    evidence: "verified",
    evidenceNote: "Drawn against limit",
  },
  {
    id: "a7",
    kind: "deposit",
    title: "Payroll deposit",
    counterparty: "Superfluid stream · Northwind Labs",
    chain: "Base",
    date: "Jan 28",
    amount: 3400,
    direction: "in",
    evidence: "verified",
    evidenceNote: "Recurring source",
  },
  {
    id: "a8",
    kind: "swap",
    title: "Token swap",
    counterparty: "ETH → USDC · Uniswap v3",
    chain: "Base",
    date: "Jan 24",
    amount: 640,
    direction: "neutral",
    evidence: "none",
    evidenceNote: "Repeat pair — no weight",
  },
  {
    id: "a9",
    kind: "lend",
    title: "Lending deposit",
    counterparty: "Morpho",
    chain: "Ethereum",
    date: "Jan 19",
    amount: 2600,
    direction: "out",
    evidence: "verified",
    evidenceNote: "Second protocol",
  },
  {
    id: "a10",
    kind: "repay",
    title: "Repayment to BASIS",
    counterparty: "Paid from 0x91b0…8ef4",
    chain: "Creditcoin",
    date: "Jan 12",
    amount: 500,
    direction: "out",
    evidence: "verified",
    evidenceNote: "Different address, same owner",
  },
  {
    id: "a11",
    kind: "deposit",
    title: "USDC deposit",
    counterparty: "Circle mint",
    chain: "Ethereum",
    date: "Dec 26",
    amount: 2500,
    direction: "in",
    evidence: "verified",
    evidenceNote: "Independent source",
  },
  {
    id: "a12",
    kind: "swap",
    title: "Internal transfer",
    counterparty: "To 0x91b0…8ef4 · own wallet",
    chain: "Base",
    date: "Dec 21",
    amount: 1200,
    direction: "neutral",
    evidence: "none",
    evidenceNote: "Self transfer — no weight",
  },
];

export const buildActions = [
  {
    title: "Add a second funding source on Arbitrum",
    note: "Two eligible deposits are already visible but unverified",
    impact: "+$1,500 est.",
  },
  {
    title: "Hold your Morpho position past 90 days",
    note: "26 days remaining — duration is weighted above size",
    impact: "+$900 est.",
  },
  {
    title: "Settle with one new counterparty",
    note: "Diversity of settlement is the strongest single signal",
    impact: "+$700 est.",
  },
];

export const limitHistory = [
  {
    date: "Feb 3, 2026",
    change: "+$3,000",
    limit: "$18,000",
    reason: "Third independent funding source verified on Ethereum",
  },
  {
    date: "Dec 12, 2025",
    change: "+$4,000",
    limit: "$15,000",
    reason: "Lending position held beyond 90 days without withdrawal",
  },
  {
    date: "Sep 2, 2025",
    change: "+$5,000",
    limit: "$11,000",
    reason: "Four consecutive repayments settled on time",
  },
  {
    date: "Mar 18, 2025",
    change: "Opened",
    limit: "$6,000",
    reason: "Initial evidence verified across two chains",
  },
];

export const payments = [
  { date: "Mar 1", amount: 312, status: "Scheduled", note: "Auto-pay from Base wallet" },
  { date: "Feb 14", amount: 500, status: "Paid", note: "Settled on time" },
  { date: "Jan 12", amount: 500, status: "Paid", note: "Paid from 0x91b0…8ef4" },
  { date: "Dec 14", amount: 500, status: "Paid", note: "Settled on time" },
];

export const wallets = [
  {
    address: "0x7f42…3c21",
    label: "Primary",
    chain: "Base",
    events: 5,
    verified: "2 hours ago",
    state: "verified" as const,
  },
  {
    address: "0x91b0…8ef4",
    label: "Secondary",
    chain: "Ethereum",
    events: 3,
    verified: "2 hours ago",
    state: "verified" as const,
  },
  {
    address: "0x2ad9…71f5",
    label: "Detected",
    chain: "Arbitrum",
    events: 2,
    verified: "Not verified",
    state: "unverified" as const,
  },
];

export const chains = [
  { name: "Base", events: 5, status: "Verified · 2h ago" },
  { name: "Ethereum", events: 3, status: "Verified · 2h ago" },
  { name: "Arbitrum", events: 2, status: "2 eligible events" },
];

export function usd(n: number, cents = true) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}
