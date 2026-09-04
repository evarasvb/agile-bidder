import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Privacidad = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a FirmaVB
      </Link>

      <h1 className="text-3xl font-heading font-bold mb-2">Política de Privacidad</h1>
      <p className="text-sm text-muted-foreground mb-10">Última actualización: septiembre de 2026</p>

      <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <p>
            En FirmaVB tratamos tus datos personales conforme a la Ley N° 19.628 sobre Protección de la Vida
            Privada de Chile. Esta política explica qué datos recopilamos, para qué los usamos y qué derechos
            tienes sobre ellos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">1. Qué datos recopilamos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Datos de cuenta: nombre, email, contraseña (o inicio de sesión con Google).</li>
            <li>Datos de empresa: razón social, RUT, giro, dirección, email de contacto.</li>
            <li>Datos de inventario y de negocio que tú cargas: productos, precios, ofertas, propuestas.</li>
            <li>
              Datos de uso: qué páginas visitas, qué oportunidades revisas, para mejorar las recomendaciones
              y detectar errores.
            </li>
            <li>
              Si usas la extensión de FirmaVB, datos de la actividad de postulación que realizas dentro de
              Mercado Público a través de ella.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Para qué usamos tus datos</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Operar tu cuenta y la funcionalidad central del producto (matching, propuestas, pipeline, reportes).</li>
            <li>Enviarte notificaciones sobre oportunidades relevantes para tu empresa.</li>
            <li>Dar soporte cuando nos contactas.</li>
            <li>Mejorar la calidad del matching y del producto en general, de forma agregada.</li>
            <li>Facturar tu suscripción, si tienes un plan pagado.</li>
          </ul>
          <p className="mt-2">No vendemos tus datos a terceros.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Con quién compartimos datos</h2>
          <p>
            Usamos proveedores externos para operar el servicio, quienes procesan datos en nuestro nombre bajo
            acuerdos de confidencialidad: Supabase (base de datos e infraestructura), proveedores de modelos de
            IA (para el matching de productos y la generación de contenido, como fichas técnicas o respuestas
            del asistente), y procesadores de pago para las suscripciones Pro. No compartimos tus datos de
            inventario o precios con otras empresas clientes de FirmaVB.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Seguridad</h2>
          <p>
            Tus datos están protegidos con controles de acceso a nivel de base de datos (cada empresa solo
            puede ver su propia información), conexiones cifradas y autenticación segura. Ante cualquier
            incidente de seguridad relevante, te avisaremos según lo exige la normativa aplicable.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Tus derechos (Ley 19.628)</h2>
          <p>
            Puedes solicitar acceso, rectificación, cancelación u oposición sobre tus datos personales (derechos
            ARCO) en cualquier momento. La mayoría de tus datos de empresa e inventario los puedes editar
            directamente desde tu cuenta; para lo demás, o para eliminar tu cuenta por completo, escríbenos a{" "}
            <a href="mailto:contacto@firmavb.cl" className="text-primary underline">
              contacto@firmavb.cl
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Retención</h2>
          <p>
            Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, eliminamos o
            anonimizamos tus datos personales dentro de un plazo razonable, salvo que debamos conservar cierta
            información por obligaciones legales o tributarias.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Cambios a esta política</h2>
          <p>
            Si hacemos cambios relevantes a esta política, te avisaremos por correo o dentro de la plataforma
            antes de que entren en vigencia.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Contacto</h2>
          <p>
            Para cualquier consulta sobre privacidad, escríbenos a{" "}
            <a href="mailto:contacto@firmavb.cl" className="text-primary underline">
              contacto@firmavb.cl
            </a>
            . Ver también nuestros{" "}
            <Link to="/terminos" className="text-primary underline">
              Términos de Servicio
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Privacidad;
