import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatosEmpresaCard } from '@/components/settings/DatosEmpresaCard';

/**
 * Página dedicada a los datos de la empresa (logo, RUT, dirección, contacto).
 * Antes vivía dentro de "Configurar Filtros", lo que confundía. Ahora tiene su
 * propio lugar claro: Configuración → Mi empresa.
 */
export default function MiEmpresa() {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Mi empresa
          </h1>
          <p className="text-muted-foreground">
            Estos datos aparecen en tus PDF (ficha técnica y cotización).
          </p>
        </div>
      </div>

      <DatosEmpresaCard />
    </div>
  );
}
