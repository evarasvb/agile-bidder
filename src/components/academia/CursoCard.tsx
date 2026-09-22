import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACENTO, type Curso } from "@/data/academiaCursos";

// Tarjeta de un curso individual (gratis o exprés de pago). destacar agrega un
// anillo y una etiqueta "Empieza aquí" para marcar el punto de partida.
export function CursoCard({ c, destacar = false }: { c: Curso; destacar?: boolean }) {
  return (
    <Card
      className={`border-border/50 hover:shadow-md transition-shadow flex flex-col overflow-hidden ${
        destacar ? "ring-2 ring-firmavb-blue" : ""
      }`}
    >
      <div className={`relative ${ACENTO[c.acento].portada} h-24 flex items-center justify-center`}>
        <span className="text-5xl drop-shadow-md">{c.emoji}</span>
        {destacar ? (
          <span className="absolute top-2 right-2 bg-firmavb-blue text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
            👉 Empieza aquí
          </span>
        ) : c.premium ? (
          <span className="absolute top-2 right-2 bg-white/90 text-firmavb-blue text-xs font-bold px-2 py-0.5 rounded-full shadow">
            💎 Premium
          </span>
        ) : (
          <span className="absolute top-2 right-2 bg-white/90 text-[hsl(var(--success))] text-xs font-bold px-2 py-0.5 rounded-full shadow">
            Gratis
          </span>
        )}
      </div>
      <CardContent className="py-6 flex flex-col flex-1">
        <h3 className="font-semibold text-foreground mb-1">{c.titulo}</h3>
        <p className="text-sm text-muted-foreground mb-4 flex-1">{c.descripcion}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="text-xs">{c.nivel}</Badge>
          <Badge variant="outline" className="text-xs">{c.duracion}</Badge>
          {c.premium && c.precio && (
            <Badge className="text-xs bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/20">
              {c.precio}
            </Badge>
          )}
        </div>
        <Button asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2 w-full">
          <Link to={`/academia/curso/${c.slug}`}>
            {c.premium ? "Ver programa" : "Ver curso gratis"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
