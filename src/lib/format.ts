export const usd = (v: number, opts: { decimals?: boolean; sign?: boolean } = {}) => {
  const { decimals = false, sign = false } = opts;
  const formatted = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  const prefix = sign ? (v >= 0 ? "+" : "-") : v < 0 ? "-" : "";
  return `${prefix}$${formatted}`;
};

export const num = (v: number, decimals = 4) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const pct = (v: number, decimals = 2) => `${v.toFixed(decimals)}%`;

export const shorten = (addr: string, lead = 6, tail = 4) =>
  addr.length <= lead + tail ? addr : `${addr.slice(0, lead)}...${addr.slice(-tail)}`;

export const signedAmount = (amount: number, symbol: string) => {
  const abs = Math.abs(amount);
  const decimals = abs >= 100 ? 2 : 4;
  return `${amount >= 0 ? "+" : "-"}${abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${symbol}`;
};
