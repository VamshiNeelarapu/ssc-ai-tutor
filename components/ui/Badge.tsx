import { clsx } from "clsx";

type RevisionStatus = "not_started" | "learning" | "needs_revision" | "revised";
type BadgeVariant = RevisionStatus | "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  not_started: "bg-gray-100 text-gray-700 border-gray-200",
  learning: "bg-blue-100 text-blue-700 border-blue-200",
  needs_revision: "bg-amber-100 text-amber-700 border-amber-200",
  revised: "bg-green-100 text-green-700 border-green-200",
  default: "bg-gray-100 text-gray-700 border-gray-200",
  success: "bg-green-100 text-green-700 border-green-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  error: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  not_started: "Not Started",
  learning: "Learning",
  needs_revision: "Needs Revision",
  revised: "Revised",
};

export function RevisionBadge({ status }: { status: RevisionStatus }) {
  return (
    <Badge variant={status}>
      {REVISION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
