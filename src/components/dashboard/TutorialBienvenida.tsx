import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";

// URL del video de capacitación (postulación al Convenio Marco), alojado en Google Drive.
// Se usa el formato /preview para poder incrustarlo en un iframe.
// IMPORTANTE: el archivo debe estar compartido como "cualquiera con el enlace" para
// que los clientes puedan verlo.
const VIDEO_EMBED = "https://drive.google.com/file/d/1LDjLXOOK38lNkZqc1Z0qI4LIWZQeBQre/preview";
const VISTO_KEY = "fvb_tutorial_bienvenida_visto";

/** Tutorial de bienvenida: muestra el video de capacitación la primera vez que el
 *  cliente entra al panel, y deja un botón "Ver tutorial" para volver a abrirlo
 *  cuando quiera. */
export function TutorialBienvenida() {
  const [abierto, setAbierto] = useState(false);

  // Auto-abrir solo la primera vez.
  useEffect(() => {
    try {
      if (localStorage.getItem(VISTO_KEY) !== "1") {
        setAbierto(true);
        localStorage.setItem(VISTO_KEY, "1");
      }
    } catch { /* noop */ }
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 border-firmavb-blue/30 text-firmavb-blue hover:bg-firmavb-blue/5"
        onClick={() => setAbierto(true)}
      >
        <PlayCircle className="h-4 w-4" /> Ver tutorial
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cómo postular al Convenio Marco</DialogTitle>
            <DialogDescription>
              Un video corto para que aprendas a postular paso a paso. Puedes volver a verlo
              cuando quieras desde el botón "Ver tutorial".
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={VIDEO_EMBED}
              title="Tutorial: postulación al Convenio Marco"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
