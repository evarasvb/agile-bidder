// Página del webinar único de Convenio Marco de SaaS (martes 8 de septiembre, ya pasado).
// Se reemplaza por la conversación semanal recurrente: cualquier link viejo a esta URL
// (redes, correos ya enviados) redirige ahí en vez de mostrar una fecha vencida con un
// formulario que dejaría una cita de calendario en el pasado.
import { Navigate } from "react-router-dom";

export default function WebinarConvenioMarcoSaas() {
  return <Navigate to="/webinar/vendele-al-estado" replace />;
}
