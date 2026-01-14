import { cn } from "@/lib/utils";
import firmavbLogo from "@/assets/firmavb-logo.png";

interface FirmaVBHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  showLogo?: boolean;
}

export function FirmaVBLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* FV Circle Logo */}
      <img 
        src={firmavbLogo} 
        alt="FirmaVB Logo" 
        className="h-10 w-10 rounded-full object-cover shadow-md"
      />
      {/* Brand Name */}
      <div className="flex flex-col">
        <span className="text-xl font-heading font-bold text-firmavb-blue leading-tight">FirmaVB</span>
        <span className="text-[10px] text-muted-foreground font-medium tracking-wide">Inteligencia para Ganar Más</span>
      </div>
    </div>
  );
}

export function FirmaVBHeader({ 
  title = "Dashboard", 
  subtitle = "Centro de control de oportunidades",
  className,
  showLogo = true
}: FirmaVBHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-6">
        {showLogo && <FirmaVBLogo />}
        <div className="h-8 w-px bg-border hidden lg:block" />
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
