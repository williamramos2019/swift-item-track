import { STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const cls: Record<OrderStatus, string> = {
  em_revisao: "bg-secondary text-secondary-foreground",
  aprovado: "bg-info/15 text-info",
  aguardando: "bg-warning/25 text-warning-foreground",
  parcial: "bg-primary/20 text-accent-foreground",
  total: "bg-success/15 text-success",
  divergencia: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", cls[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
