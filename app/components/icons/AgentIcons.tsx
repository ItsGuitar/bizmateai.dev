import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LeadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2 12.9 12.9 9.2 14.8 11.1 11.1Z" />
    </svg>
  );
}

export function ReceivablesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 13.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4.5" />
      <path d="M4 13.5h3.6a1.4 1.4 0 0 1 1.3.85c.35.8 1.1 1.3 2 1.3h2.2c.9 0 1.65-.5 2-1.3a1.4 1.4 0 0 1 1.3-.85H20" />
      <path d="M12 3.5v8" />
      <path d="M8.8 8.3 12 11.5l3.2-3.2" />
    </svg>
  );
}

export function ProcurementIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.8 7.4 12 3.5l8.2 3.9-8.2 3.9z" />
      <path d="M3.8 7.4v9.2L12 20.5l8.2-3.9V7.4" />
      <path d="M12 11.3v9.2" />
    </svg>
  );
}

export function FinancingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 9.5 12 4l8.5 5.5" />
      <path d="M4.5 9.5h15v9.5h-15z" />
      <path d="M8 13v4" />
      <path d="M12 13v4" />
      <path d="M16 13v4" />
      <path d="M3.5 19h17" />
    </svg>
  );
}

export function GuardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.3 19 6v6c0 4.3-3 7.2-7 8.7-4-1.5-7-4.4-7-8.7V6Z" />
      <path d="M9.3 12.1 11.4 14l3.4-4" />
    </svg>
  );
}

export const AGENT_ICON_MAP = {
  lead: LeadIcon,
  receivables: ReceivablesIcon,
  procurement: ProcurementIcon,
  financing: FinancingIcon,
  guard: GuardIcon,
} as const;

export type AgentIconId = keyof typeof AGENT_ICON_MAP;

export function AgentIcon({ id, ...props }: { id: string } & IconProps) {
  const Comp = AGENT_ICON_MAP[id as AgentIconId] ?? GuardIcon;
  return <Comp {...props} />;
}
