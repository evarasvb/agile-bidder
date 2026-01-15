import { cn } from "@/lib/utils";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";
import logoFirmavbNegro from "@/assets/logo-firmavb-negro.png";

interface FirmaVBHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  showLogo?: boolean;
}

type LogoVariant = 'original' | 'blanco' | 'negro';

const logoVariants = {
  original: logoFirmavbOriginal,
  blanco: logoFirmavbBlanco,
  negro: logoFirmavbNegro,
};

export function FirmaVBLogo({ 
  className, 
  variant = 'original',
  size = 'md' 
}: { 
  className?: string; 
  variant?: LogoVariant;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
  };

  return (
    <div className={cn("flex items-center", className)}>
      <img 
        src={logoVariants[variant]} 
        alt="FirmaVB Logo" 
        className={cn("w-auto object-contain", sizeClasses[size])}
      />
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