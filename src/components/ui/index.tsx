import React, { useEffect, useState } from "react";
import { cn } from "../../utils/cn";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  X,
} from "lucide-react";

/* ---------------------------------------------------------------- Buttons */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  loading?: boolean;
  full?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover shadow-[0_1px_2px_rgba(0,82,255,0.18)]",
  secondary: "bg-brand-soft text-brand hover:bg-[#dfe9ff]",
  outline: "bg-white text-ink border border-line hover:bg-soft",
  ghost: "bg-transparent text-muted hover:bg-soft hover:text-ink",
  danger: "bg-neg text-white hover:bg-[#bb271c]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-[14px]",
  lg: "h-12 px-5 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  pill,
  loading,
  full,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1",
        "disabled:opacity-45 disabled:pointer-events-none",
        pill ? "rounded-full" : "rounded-[10px]",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted",
        "transition-colors duration-150 hover:text-ink hover:border-[#d8dee8]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Cards */

export function Card({
  className,
  children,
  padded = true,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-[14px] border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.025em] text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-[14px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Badges */

type Tone = "neutral" | "positive" | "brand" | "warning" | "negative";

const tones: Record<Tone, string> = {
  neutral: "bg-soft text-muted",
  positive: "bg-pos-soft text-[#067647]",
  brand: "bg-brand-soft text-brand",
  warning: "bg-warn-soft text-[#B54708]",
  negative: "bg-neg-soft text-neg",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[12px] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "positive" && "bg-[#17b26a]",
            tone === "neutral" && "bg-[#98a2b3]",
            tone === "brand" && "bg-brand",
            tone === "warning" && "bg-warn",
            tone === "negative" && "bg-neg",
          )}
        />
      )}
      {children}
    </span>
  );
}

export function StatusDot({ tone = "positive" }: { tone?: "positive" | "neutral" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        tone === "positive" && "bg-[#17b26a]",
        tone === "neutral" && "bg-[#98a2b3]",
        tone === "warning" && "bg-warn",
      )}
    />
  );
}

export function Delta({ value, pctValue, className }: { value: number; pctValue?: number; className?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[14px] font-medium tnum",
        positive ? "text-pos" : "text-neg",
        className,
      )}
    >
      <span className="text-[13px]">{positive ? "↗" : "↘"}</span>
      {`${positive ? "" : "-"}$${Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`}
      {pctValue !== undefined && ` (${Math.abs(pctValue).toFixed(2)}%)`}
    </span>
  );
}

/* ------------------------------------------------------------------ Icons */

export function IconTile({
  children,
  tone = "brand",
  size = 40,
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "positive" | "violet" | "neutral" | "warning";
  size?: number;
  className?: string;
}) {
  const toneCls = {
    brand: "bg-brand-soft text-brand",
    positive: "bg-pos-soft text-[#067647]",
    violet: "bg-[#F1ECFE] text-[#6938EF]",
    neutral: "bg-soft text-muted",
    warning: "bg-warn-soft text-[#B54708]",
  }[tone];
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("grid shrink-0 place-items-center rounded-full", toneCls, className)}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Forms */

export function Input({
  className,
  prefix,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-[10px] border border-line bg-white px-3",
        "transition-colors duration-150 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-ring/50",
        className,
      )}
    >
      {prefix}
      <input
        {...rest}
        className="h-full w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
      />
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white pl-3 pr-2 text-[14px] text-ink",
        "transition-colors duration-150 hover:border-[#d8dee8]",
        className,
      )}
    >
      {icon}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full cursor-pointer appearance-none bg-transparent pr-5 text-[14px] outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 text-faint"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[14px] text-ink">
      <span
        onClick={() => onChange(!checked)}
        className={cn(
          "grid h-[18px] w-[18px] place-items-center rounded-[5px] border transition-colors duration-150",
          checked ? "border-brand bg-brand text-white" : "border-[#d3d9e3] bg-white",
        )}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-brand" : "bg-[#d5dae3]",
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------- Tabs */

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-6 border-b border-line", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative -mb-px whitespace-nowrap pb-3 pt-1 text-[14px] transition-colors duration-150",
            value === t.id ? "font-semibold text-brand" : "text-muted hover:text-ink",
          )}
        >
          {t.label}
          {value === t.id && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-soft p-1", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-150",
            value === o.id ? "bg-white text-brand shadow-[0_1px_2px_rgba(16,24,40,0.06)]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Table */

export function TableHead({ cols, className }: { cols: (string | { label: string; align?: string })[]; className?: string }) {
  return (
    <div className={cn("grid items-center border-b border-line pb-3 text-[13px] text-muted", className)}>
      {cols.map((c, i) => {
        const label = typeof c === "string" ? c : c.label;
        const align = typeof c === "string" ? "" : c.align;
        return (
          <div key={i} className={align}>
            {label}
          </div>
        );
      })}
    </div>
  );
}

export function Row({
  className,
  children,
  onClick,
  chevron = true,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group grid items-center border-b border-line-soft py-[14px] text-[14px] transition-colors duration-150 last:border-0",
        onClick && "-mx-2 cursor-pointer rounded-lg px-2 hover:bg-subtle",
        className,
      )}
    >
      {children}
      {chevron && onClick && (
        <ChevronRight size={16} className="justify-self-end text-[#c4cbd6] transition-colors group-hover:text-muted" />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Progress */

export function ProgressBar({
  value,
  className,
  height = 8,
}: {
  value: number;
  className?: string;
  height?: number;
}) {
  return (
    <div
      style={{ height }}
      className={cn("w-full overflow-hidden rounded-full bg-[#eef1f6]", className)}
    >
      <div
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
      />
    </div>
  );
}

/* ----------------------------------------------------------- Wallet chips */

export function WalletAddress({
  address,
  className,
  short = true,
  onCopy,
}: {
  address: string;
  className?: string;
  short?: boolean;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const display = short ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(address);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 1400);
      }}
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[13px] text-muted transition-colors duration-150 hover:text-ink",
        className,
      )}
    >
      {display}
      {copied ? <Check size={13} className="text-pos" /> : <Copy size={13} />}
    </button>
  );
}

/* -------------------------------------------------------------- Overlays */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="animate-fade absolute inset-0 bg-[#0b1524]/25" onClick={onClose} />
      <aside
        style={{ width }}
        className="animate-slide-in relative flex h-full max-w-full flex-col border-l border-line bg-white shadow-[-8px_0_32px_rgba(16,24,40,0.08)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="animate-fade absolute inset-0 bg-[#0b1524]/25" onClick={onClose} />
      <div
        style={{ width }}
        className="animate-fade-up relative max-h-[88vh] w-full overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_24px_48px_-12px_rgba(16,24,40,0.18)]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="max-h-[60vh] overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="border-t border-line bg-subtle px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- States */

export function LoadingState({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="animate-fade" aria-busy="true" aria-label={label}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[#eef1f6]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-[#eef1f6]" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-[#f3f5f9]" />
            </div>
            <div className="h-3 w-20 animate-pulse rounded bg-[#eef1f6]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[#eef1f6]", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <IconTile size={48} tone="neutral" className="mb-4">
        {icon ?? <Info size={20} />}
      </IconTile>
      <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "We couldn't load this",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <IconTile size={48} tone="warning" className="mb-4">
        <AlertTriangle size={20} />
      </IconTile>
      <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function InfoHint({ text }: { text: string }) {
  return (
    <span title={text} className="inline-grid h-[15px] w-[15px] cursor-help place-items-center rounded-full text-[#b3bbc8]">
      <Info size={13} />
    </span>
  );
}

export function KeyValue({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-6 py-3", className)}>
      <span className="text-[13px] text-muted">{label}</span>
      <span className={cn("text-right text-[13px] font-medium text-ink", mono && "font-mono text-[12.5px]")}>
        {value}
      </span>
    </div>
  );
}
