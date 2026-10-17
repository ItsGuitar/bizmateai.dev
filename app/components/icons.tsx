import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 21V7l8-4 8 4v14" />
      <path d="M4 21h16" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 10h.01M9 14h.01M15 10h.01M15 14h.01" />
    </svg>
  );
}

export function CoinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 15.2c.5.6 1.4 1 2.5 1 1.8 0 3-1 3-2.2 0-1.5-1.4-1.9-3-2.3-1.8-.5-3-.9-3-2.2 0-1.2 1.2-2.2 3-2.2 1.1 0 2 .4 2.5 1" />
      <path d="M12 7.3V6M12 18v-1.3" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 19c7 0 13-5.5 13-14-8.5 0-14 6-14 13v1z" />
      <path d="M5 19c2-3.5 5-7 13-11" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10.3 3.9 2.7 17.3a1.4 1.4 0 0 0 1.2 2.1h16.2a1.4 1.4 0 0 0 1.2-2.1L13.7 3.9a1.4 1.4 0 0 0-2.4 0z" />
      <path d="M12 9.5v4M12 16.5h.01" />
    </svg>
  );
}

export function StormIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 16.5a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.6-1.6A4.5 4.5 0 0 1 17 16.5H6.5z" />
      <path d="M11 18.5 9.5 21M15 18.5 13.5 21" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v5c0 4.6 3 7.9 7 10 4-2.1 7-5.4 7-10V6l-7-3z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  );
}

export function PulseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 12h2.3l1.4-3.5L13 15.5l1.4-3.5H17" />
    </svg>
  );
}

export function BankIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10 12 4l9 6" />
      <path d="M4 10h16v2H4z" />
      <path d="M5.5 12v7M9.5 12v7M14.5 12v7M18.5 12v7" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3z" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 15h4" />
    </svg>
  );
}

export function ScanIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M4 12h16" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19.5h16" />
    </svg>
  );
}
