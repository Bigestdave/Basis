import React from "react";
import { cn } from "../../utils/cn";

export function BasisLogo({ size = 30 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="BASIS Logo"
      className="shrink-0 object-contain rounded-lg"
      style={{ width: size, height: size }}
    />
  );
}

const Circle = ({
  bg,
  size,
  children,
  className,
}: {
  bg: string;
  size: number;
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    style={{ width: size, height: size, background: bg }}
    className={cn("grid shrink-0 place-items-center rounded-full", className)}
  >
    {children}
  </span>
);

export function NetworkIcon({ id, size = 32 }: { id: string; size?: number }) {
  const s = size;
  const inner = Math.round(size * 0.55);
  switch (id) {
    case "ethereum":
      return (
        <Circle bg="#6B7FE3" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <path d="M12 2 5.5 12.4 12 16.2l6.5-3.8L12 2Z" fill="#fff" fillOpacity=".92" />
            <path d="M12 17.6 5.5 13.8 12 22l6.5-8.2-6.5 3.8Z" fill="#fff" fillOpacity=".7" />
          </svg>
        </Circle>
      );
    case "base":
      return (
        <Circle bg="#0052FF" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 8.94-8H8.4v-2h12.54A9 9 0 0 0 12 3Z"
              fill="#fff"
            />
          </svg>
        </Circle>
      );
    case "creditcoin":
      return (
        <Circle bg="#0B1524" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.2" stroke="#fff" strokeWidth="1.6" />
            <path d="M15.5 9.3A4.6 4.6 0 1 0 15.5 14.7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M8 12h9" stroke="#fff" strokeWidth="1.3" />
          </svg>
        </Circle>
      );
    case "solana":
      return (
        <Circle bg="#0B1120" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="sol" x1="0" y1="0" x2="24" y2="24">
                <stop stopColor="#19FB9B" />
                <stop offset="1" stopColor="#9945FF" />
              </linearGradient>
            </defs>
            <path d="M6 8.2h11.4L15 5.6H3.6L6 8.2Z" fill="url(#sol)" />
            <path d="M6 13.3h11.4L15 10.7H3.6L6 13.3Z" fill="url(#sol)" />
            <path d="M6 18.4h11.4L15 15.8H3.6L6 18.4Z" fill="url(#sol)" />
          </svg>
        </Circle>
      );
    case "polygon":
      return (
        <Circle bg="#8247E5" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <circle cx="8.5" cy="12" r="3.4" stroke="#fff" strokeWidth="1.6" />
            <circle cx="15.5" cy="12" r="3.4" stroke="#fff" strokeWidth="1.6" />
          </svg>
        </Circle>
      );
    case "arbitrum":
      return (
        <Circle bg="#2D374B" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <path d="M12 4 5 16.5h3.2L12 9.8l3.8 6.7H19L12 4Z" fill="#9DCCED" />
            <path d="M14.2 20H17l-1.6-2.8L14.2 20Z" fill="#fff" />
          </svg>
        </Circle>
      );
    case "optimism":
      return (
        <Circle bg="#FF0420" size={s}>
          <span
            style={{ fontSize: Math.round(size * 0.36) }}
            className="font-bold italic leading-none text-white"
          >
            OP
          </span>
        </Circle>
      );
    case "aave":
      return (
        <Circle bg="#fff" size={s} className="border border-line">
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <path d="M4 18 12 5l8 13" stroke="#B6509E" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M8.4 14.6h7.2" stroke="#2EBAC6" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Circle>
      );
    case "uniswap":
      return (
        <Circle bg="#FF007A" size={s}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="10" r="2.6" stroke="#fff" strokeWidth="1.6" />
            <circle cx="15" cy="14" r="2.6" stroke="#fff" strokeWidth="1.6" />
          </svg>
        </Circle>
      );
    default:
      return (
        <Circle bg="#E6EAF0" size={s}>
          <span style={{ fontSize: size * 0.4 }} className="font-semibold text-muted">
            {id.slice(0, 1).toUpperCase()}
          </span>
        </Circle>
      );
  }
}

export function AssetIcon({ id, size = 32 }: { id: string; size?: number }) {
  const inner = Math.round(size * 0.58);
  switch (id) {
    case "usdc":
      return (
        <Circle bg="#2775CA" size={size}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.4" />
            <path
              d="M12 7v10M14.4 9.6c-.5-.8-1.4-1.2-2.4-1.2-1.4 0-2.4.7-2.4 1.9 0 2.5 5 1 5 3.6 0 1.2-1.1 1.9-2.6 1.9-1.1 0-2.1-.5-2.5-1.3"
              stroke="#fff"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </Circle>
      );
    case "eth":
      return <NetworkIcon id="ethereum" size={size} />;
    case "sol":
      return <NetworkIcon id="solana" size={size} />;
    case "btc":
      return (
        <Circle bg="#F7931A" size={size}>
          <span style={{ fontSize: size * 0.5 }} className="font-bold leading-none text-white">
            ₿
          </span>
        </Circle>
      );
    case "usdt":
      return (
        <Circle bg="#26A17B" size={size}>
          <span style={{ fontSize: size * 0.44 }} className="font-bold leading-none text-white">
            ₮
          </span>
        </Circle>
      );
    case "dai":
      return (
        <Circle bg="#F5AC37" size={size}>
          <span style={{ fontSize: size * 0.44 }} className="font-bold leading-none text-white">
            D
          </span>
        </Circle>
      );
    default:
      return (
        <Circle bg="#DCE1EA" size={size}>
          <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="10" r="2" fill="#6B7485" />
            <circle cx="15" cy="10" r="2" fill="#6B7485" />
            <circle cx="12" cy="15" r="2" fill="#6B7485" />
          </svg>
        </Circle>
      );
  }
}

export function WalletBrandIcon({ id, size = 36 }: { id: string; size?: number }) {
  switch (id) {
    case "MetaMask":
      return (
        <Circle bg="#FDF1E6" size={size}>
          <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
            <path d="m3 4 7.2 5.2h3.6L21 4l-2.2 7.1 1.5 6.1-4.6 2.6-3.7-2h0l-3.7 2L3.7 17l1.5-6L3 4Z" fill="#E2761B" />
            <path d="M8.3 12.6h7.4l-.6 2.6H8.9l-.6-2.6Z" fill="#fff" />
          </svg>
        </Circle>
      );
    case "WalletConnect":
      return (
        <Circle bg="#3B99FC" size={size}>
          <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
            <path
              d="M6.4 9.4a7.9 7.9 0 0 1 11.2 0l.4.4-1.3 1.3-.4-.4a6.1 6.1 0 0 0-8.6 0l-.5.4L6 9.8l.4-.4Zm13.7 2.2 1.2 1.1-5.3 5.2-2.7-2.6-2.7 2.6-5.3-5.2 1.2-1.1 4.1 4 2.7-2.6 2.7 2.6 4.1-4Z"
              fill="#fff"
            />
          </svg>
        </Circle>
      );
    default:
      return (
        <Circle bg="#0052FF" size={size}>
          <span className="block rounded-[3px] bg-white" style={{ width: size * 0.26, height: size * 0.26 }} />
        </Circle>
      );
  }
}
