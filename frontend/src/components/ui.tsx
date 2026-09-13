import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { ChevronRight } from "./Icons";

/* ---------------------------------------------------------------- buttons */

type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  full?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  full,
  onClick,
  disabled,
  className,
}: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
        size === "md" ? "h-10 px-5 text-[14.5px]" : "h-8 px-3.5 text-[13px]",
        full && "w-full",
        variant === "primary" &&
          "bg-blue text-white hover:bg-blue-2 disabled:bg-surface-2 disabled:text-ink-3",
        variant === "secondary" &&
          "bg-surface text-ink hover:bg-surface-2 disabled:text-ink-3",
        variant === "ghost" && "text-ink-2 hover:bg-surface hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextLink({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[13.5px] font-medium text-blue hover:text-blue-2 hover:underline underline-offset-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- sections */

export function SectionHeader({
  title,
  action,
  onAction,
  subtitle,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13.5px] text-ink-2">{subtitle}</p>}
      </div>
      {action && <TextLink onClick={onAction}>{action}</TextLink>}
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-[12.5px] font-medium tracking-[0.01em] text-ink-2", className)}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- strength bar */

export function Strength({ value, max = 4 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-[3px]" aria-label={`${value} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-[3px] w-[14px] rounded-full",
            i < value ? "bg-ink" : "bg-line-2/70",
          )}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- list row */

export function Chevron() {
  return (
    <ChevronRight
      size={16}
      className="shrink-0 text-ink-3 transition-colors group-hover:text-ink-2"
    />
  );
}

export function IconDisc({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ misc */

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

export function StatCell({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className="num mt-1.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
        {value}
      </div>
      {note && <div className="mt-1 text-[12.5px] text-ink-3">{note}</div>}
    </div>
  );
}

export function KeyValue({
  k,
  v,
  sub,
  muted,
}: {
  k: string;
  v: ReactNode;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <div className="text-[13.5px] text-ink-2">{k}</div>
      <div className="text-right">
        <div
          className={cn(
            "num text-[13.5px] font-medium",
            muted ? "text-ink-2" : "text-ink",
          )}
        >
          {v}
        </div>
        {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}


