import { cn } from "@/lib/utils";
import firmavbLogo from "@/assets/firmavb-logo.png";

interface FirmaVBHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  showLogo?: boolean;
}

export function FirmaVBLogo({ className, showSlogan = true }: { className?: string; showSlogan?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Logo with Red Underline */}
      <img 
        src={firmavbLogo} 
        alt="FirmaVB Logo" 
        className="h-10 w-auto object-contain"
      />
      {showSlogan && (
        <div className="flex flex-col">
          <div className="firmavb-underline inline-block">
            <span className="text-xl font-bold text-firmavb-blue leading-tight tracking-tight">FirmaVB</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium tracking-wide mt-1.5">
            conectando grandes marcas con grandes clientes
          </span>
        </div>
      )}
    </div>
  );
}

export function FirmaVBHeader({ 
  title = "Dashboard", 
  subtitle = "Centro de control de oportunidades",
  className,
  showLogo = false
}: FirmaVBHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-6">
        {showLogo && <FirmaVBLogo />}
        {showLogo && <div className="h-8 w-px bg-border hidden lg:block" />}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground font-light">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}