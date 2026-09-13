import React, { useId } from "react";
import { cn } from "../../utils/cn";

interface Point {
  label: string;
  value: number;
}

export function LineChart({
  data,
  height = 150,
  labels,
  className,
  showDot = true,
  grid = false,
}: {
  data: Point[];
  height?: number;
  labels?: string[];
  className?: string;
  showDot?: boolean;
  grid?: boolean;
}) {
  const gid = useId().replace(/:/g, "");
  const w = 600;
  const h = height;
  const pad = 6;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * (w - pad * 2) + pad;
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0052FF" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
          </linearGradient>
          {grid && (
            <pattern id={`grid-${gid}`} width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="#dbe2ee" />
            </pattern>
          )}
        </defs>
        {grid && <rect x="0" y="0" width={w} height={h} fill={`url(#grid-${gid})`} opacity="0.5" />}
        <path d={area} fill={`url(#fill-${gid})`} />
        <path
          d={line}
          fill="none"
          stroke="#0052FF"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {showDot && (
          <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r="3.4" fill="#0052FF" stroke="#fff" strokeWidth="1.6" />
        )}
      </svg>
      {labels && (
        <div className="mt-2 flex justify-between px-1 text-[12px] text-faint">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  segments,
  size = 168,
  thickness = 20,
  center,
}: {
  segments: { pct: number; color: string }[];
  size?: number;
  thickness?: number;
  center?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F3F8" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.pct / 100) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len - 2} ${c - len + 2}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function RingProgress({
  value,
  size = 124,
  thickness = 12,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  thickness?: number;
  label: string;
  sublabel?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const len = (Math.min(100, value) / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F8" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#0052FF"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${len} ${c - len}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="text-[20px] font-bold tracking-[-0.02em] text-ink tnum">{label}</div>
        {sublabel && <div className="text-[12px] text-muted">{sublabel}</div>}
      </div>
    </div>
  );
}
