import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "primary";
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  const variantStyles = {
    default: {
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
    },
    success: {
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    warning: {
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
    },
    primary: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="group relative rounded-xl border border-border bg-card p-5 shadow-sm card-hover">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="metric-value text-3xl text-foreground animate-count-up">
              {typeof value === 'number' ? value.toLocaleString('es-CL') : value}
            </p>
            {trend && (
              <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "flex h-11 w-11 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
          styles.iconBg
        )}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
      </div>
    </div>
  );
}
