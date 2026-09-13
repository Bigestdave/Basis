import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 19V9.2a1 1 0 0 1 .38-.78l7-5.5a1 1 0 0 1 1.24 0l7 5.5a1 1 0 0 1 .38.78V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />
    <path d="M9.5 20v-6h5v6" />
  </Base>
);

export const CreditIcon = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
    <path d="M3 10h18" />
    <path d="M6.5 14.8h3.2" />
  </Base>
);

export const EvidenceIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 3.2 19 6v5.3c0 4.2-2.8 7.6-7 9.5-4.2-1.9-7-5.3-7-9.5V6l7-2.8Z" />
    <path d="m9.2 11.8 2 2 3.6-3.9" />
  </Base>
);

export const ActivityIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.4V12l3 1.8" />
  </Base>
);

export const WalletIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 8.2A2.2 2.2 0 0 1 6.2 6H17a2 2 0 0 1 2 2v1" />
    <rect x="4" y="8" width="16" height="10.5" rx="2.2" />
    <path d="M15.4 13.2h2.2" />
  </Base>
);

export const SettingsIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2.8" />
    <path d="M19.3 14a1.4 1.4 0 0 0 .28 1.55l.05.05a1.7 1.7 0 1 1-2.4 2.4l-.05-.05a1.4 1.4 0 0 0-1.55-.28 1.4 1.4 0 0 0-.85 1.29v.14a1.7 1.7 0 1 1-3.4 0v-.07a1.4 1.4 0 0 0-.92-1.29 1.4 1.4 0 0 0-1.55.28l-.05.05a1.7 1.7 0 1 1-2.4-2.4l.05-.05a1.4 1.4 0 0 0 .28-1.55 1.4 1.4 0 0 0-1.29-.85H5.4a1.7 1.7 0 1 1 0-3.4h.07a1.4 1.4 0 0 0 1.29-.92 1.4 1.4 0 0 0-.28-1.55l-.05-.05a1.7 1.7 0 1 1 2.4-2.4l.05.05a1.4 1.4 0 0 0 1.55.28h.07a1.4 1.4 0 0 0 .85-1.29V5.4a1.7 1.7 0 1 1 3.4 0v.07a1.4 1.4 0 0 0 .85 1.29 1.4 1.4 0 0 0 1.55-.28l.05-.05a1.7 1.7 0 1 1 2.4 2.4l-.05.05a1.4 1.4 0 0 0-.28 1.55v.07a1.4 1.4 0 0 0 1.29.85h.14a1.7 1.7 0 1 1 0 3.4h-.07a1.4 1.4 0 0 0-1.29.85Z" />
  </Base>
);

export const MoreIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="5.4" r=".9" fill="currentColor" />
    <circle cx="12" cy="12" r=".9" fill="currentColor" />
    <circle cx="12" cy="18.6" r=".9" fill="currentColor" />
  </Base>
);

export const SearchIcon = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m16 16 4 4" />
  </Base>
);

export const BellIcon = (p: P) => (
  <Base {...p}>
    <path d="M18 10.4a6 6 0 1 0-12 0c0 4.1-1.4 5.4-1.4 5.4h14.8S18 14.5 18 10.4Z" />
    <path d="M13.8 19a2 2 0 0 1-3.6 0" />
  </Base>
);

export const HelpIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M9.9 9.6a2.2 2.2 0 1 1 3 2.05c-.6.24-.9.78-.9 1.4v.35" />
    <circle cx="12" cy="16.4" r=".85" fill="currentColor" stroke="none" />
  </Base>
);

export const ChevronRight = (p: P) => (
  <Base {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Base>
);

export const ChevronDown = (p: P) => (
  <Base {...p}>
    <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
  </Base>
);

export const ArrowIn = (p: P) => (
  <Base {...p}>
    <path d="M16.5 7.5 7.5 16.5" />
    <path d="M15.4 16.5H7.5V8.6" />
  </Base>
);

export const ArrowOut = (p: P) => (
  <Base {...p}>
    <path d="M7.5 16.5 16.5 7.5" />
    <path d="M8.6 7.5h7.9v7.9" />
  </Base>
);

export const SwapIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 9h11.5l-2.8-2.9" />
    <path d="M19 15H7.5l2.8 2.9" />
  </Base>
);

export const LayersIcon = (p: P) => (
  <Base {...p}>
    <path d="m12 4 8 4-8 4-8-4 8-4Z" />
    <path d="m4.6 12.6 7.4 3.7 7.4-3.7" />
  </Base>
);

export const CheckIcon = (p: P) => (
  <Base {...p}>
    <path d="m5.5 12.5 4 4 9-9" />
  </Base>
);

export const PlusIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Base>
);

export const MenuIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const CloseIcon = (p: P) => (
  <Base {...p}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </Base>
);

export const ExternalIcon = (p: P) => (
  <Base {...p}>
    <path d="M14 5h5v5" />
    <path d="M19 5l-7.5 7.5" />
    <path d="M18 14.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V7.5A1.5 1.5 0 0 1 6 6h3.6" />
  </Base>
);

export const ShieldDot = (p: P) => (
  <Base {...p}>
    <path d="M12 3.4 18.6 6v5c0 4-2.6 7.2-6.6 9-4-1.8-6.6-5-6.6-9V6L12 3.4Z" />
  </Base>
);

export const NetworkIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="12" cy="20" r="2" />
    <path d="M6.8 7.2 10.2 10.4M17.2 7.2 13.8 10.4M12 14.5v3.5" />
  </Base>
);

export const FlaskIcon = (p: P) => (
  <Base {...p}>
    <path d="M9 3h6M10 3v6.5L5.5 18a1.5 1.5 0 0 0 1.3 2.2h10.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3" />
    <path d="M7.5 16h9" />
  </Base>
);

export function BasisMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="BASIS Logo"
      className="shrink-0 object-contain rounded-md"
      style={{ width: size, height: size }}
    />
  );
}
