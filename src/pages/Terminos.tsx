import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terminos = () => (
  <div className="min-h-screen bg-background">
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a FirmaVB
      </Link>

      <h1 className="text-3xl font-heading font-bold mb-2">Términos de Servicio</h1>
      <p className="text-sm text-muted-foreground mb-10">Última actualización: septiembre de 2026</p>

      <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Qué es FirmaVB</h2>
          <p>
            FirmaVB es una plataforma que ayuda a empresas chilenas (principalmente PYMEs) a encontrar,
            evaluar y postular a oportunidades de venta al Estado a través de Mercado Público —incluyendo
            licitaciones y Compras Ágiles—, usando inteligencia artificial para hacer coincidir tu inventario
            con lo que los organismos públicos están comprando. FirmaVB es un servicio independiente y no está
            afiliado ni respaldado por la Dirección ChileCompra ni por Mercado Público.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Tu cuenta</h2>
          <p>
            Para usar FirmaVB necesitas crear una cuenta con datos verídicos de tu empresa (razón social, RUT,
            email de contacto). Eres responsable de mantener la confidencialidad de tu contraseña y de toda
            actividad que ocurra bajo tu cuenta. Si invitas a otros miembros de tu equipo, tú sigues siendo
            responsable del uso que hagan de la cuenta de tu empresa.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Uso del servicio</h2>
          <p>
            Puedes usar FirmaVB para gestionar tu inventario, revisar oportunidades de negocio, generar
            propuestas y hacer seguimiento de tus postulaciones. No está permitido usar la plataforma para
            extraer datos de forma masiva fuera de tu propio uso comercial, interferir con su funcionamiento,
            ni intentar acceder a información de otras empresas clientes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Postulaciones y responsabilidad sobre tus ofertas</h2>
          <p>
            FirmaVB te ayuda a preparar y a postular tus ofertas —incluyendo, si lo activas, una extensión de
            navegador que autocompleta datos dentro del sitio de Mercado Público mientras tú postulas—, pero la
            decisión de postular, los precios que ofertas y el cumplimiento de lo comprometido frente al
            organismo comprador son siempre tu responsabilidad. FirmaVB no participa como parte en la relación
            contractual entre tu empresa y el Estado, y no garantiza la adjudicación de ninguna oportunidad.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Planes y pagos</h2>
          <p>
            FirmaVB ofrece un plan gratuito con funcionalidad limitada y un plan Pro pagado con acceso completo,
            cuyo valor vigente puedes revisar en{" "}
            <Link to="/planes" className="text-primary underline">
              firmavb.cl/planes
            </Link>
            . Las suscripciones se cobran de forma periódica y puedes cancelarlas en cualquier momento desde tu
            cuenta; la cancelación aplica desde el siguiente ciclo de facturación.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Datos de terceros y fuentes públicas</h2>
          <p>
            Parte de la información que muestra FirmaVB (licitaciones, compras ágiles, órdenes de compra,
            precios de referencia) proviene de datos públicos publicados por Mercado Público / ChileCompra.
            FirmaVB hace su mejor esfuerzo por mantener esta información actualizada, pero no garantiza su
            exactitud total ni se hace responsable de discrepancias frente a la fuente oficial —siempre
            verifica las bases y condiciones directamente en mercadopublico.cl antes de postular.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Propiedad intelectual</h2>
          <p>
            El software, el diseño y las marcas de FirmaVB son propiedad de FirmaVB. Los datos que subes
            (inventario, precios, documentos) siguen siendo tuyos; nos das permiso para usarlos únicamente para
            operar el servicio en tu beneficio (por ejemplo, para calcular matches y generar propuestas).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estos Términos de Servicio para reflejar cambios en el producto o en la ley.
            Si el cambio es significativo, te avisaremos por correo o dentro de la plataforma antes de que
            entre en vigencia.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Contacto</h2>
          <p>
            Si tienes preguntas sobre estos términos, escríbenos a{" "}
            <a href="mailto:contacto@firmavb.cl" className="text-primary underline">
              contacto@firmavb.cl
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  </div>
);

export default Terminos;
