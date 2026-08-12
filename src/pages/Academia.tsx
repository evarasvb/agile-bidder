import {
  ArrowLeft,
  Youtube,
  Music2,
  Linkedin,
  BookOpen,
  GraduationCap,
  ClipboardList,
  MessageCircle,
  Mail,
  ExternalLink,
  Star,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";
import { AcademiaLeadForm } from "@/components/academia/AcademiaLeadForm";
import { CURSOS, ACENTO } from "@/data/academiaCursos";

// =============================================================================
//  CONTENIDO DE LA ACADEMIA  ← EDITA AQUÍ TUS LINKS Y TEXTOS
// -----------------------------------------------------------------------------
//  Todo lo que se muestra en la página sale de este objeto. No necesitas tocar
//  el diseño: solo cambia los textos y pega tus enlaces reales.
//
//  Cómo obtener el ID de un video de YouTube:
//    En la url  https://www.youtube.com/watch?v=ABC123  → el ID es  ABC123
//  Para una canción de Spotify:
//    Comparte → "Copiar enlace" y pégalo en "url".
//  Para un post de LinkedIn:
//    Abre el post → "..." → "Copiar enlace al post" y pégalo en "url".
// =============================================================================

const CONTENIDO = {
  // --- Encabezado / presentación -------------------------------------------
  perfil: {
    nombre: "Enrique Varas",
    titulo: "Fundador de FirmaVB · Experto en Compras Públicas",
    bio: "Ayudo a empresas a vender al Estado de forma constante y rentable. Aquí reúno mis videos, mi música, mis libros, mis cursos y la comunidad de proveedores del Estado.",
    // Reemplaza por la url de tu foto (o déjalo en null para usar las iniciales)
    fotoUrl: "/media/academia/foto-enrique.jpg" as string | null,
  },

  // --- Banner destacado -----------------------------------------------------
  // Imagen grande destacada. Deja imagenUrl en "" para ocultarlo.
  banner: {
    imagenUrl: "/media/academia/convenio-software.jpg",
    alt: "Postula al Convenio Marco de Software",
    enlaceUrl: "#asesoria", // a dónde lleva al hacer clic (# = sección de esta página)
  },

  // --- Videos de YouTube ----------------------------------------------------
  // Pega el ID de cada video (la parte después de watch?v= )
  youtube: {
    canalUrl: "https://youtube.com/@firmavb", // ← tu canal
    videos: [
      // Pega el ID de cada video (la parte después de watch?v= o youtu.be/ ).
      { id: "ktBYadx4CD4", titulo: "" },
      { id: "OuTCy3DESxQ", titulo: "" },
      { id: "SJ7PZZw1vNM", titulo: "" },
      { id: "kxpU_2H1J_Y", titulo: "" },
    ],
  },

  // --- Música / canciones ---------------------------------------------------
  // Puedes poner el link de tu perfil (Suno) o links de canciones sueltas
  // (Spotify/YouTube). Los de Spotify se reproducen incrustados; el resto
  // se muestran con un botón "Escuchar".
  musica: [
    { titulo: "Escucha todas mis canciones en Suno", url: "https://suno.com/@eevb" },
  ],

  // --- Posts de LinkedIn ----------------------------------------------------
  linkedin: {
    perfilUrl: "https://www.linkedin.com/in/evaras", // ← tu perfil de LinkedIn
    // Cada post puede tener una imagen (imagenUrl) y/o un enlace a la
    // publicación (url). Si no hay url, la tarjeta solo muestra la imagen.
    posts: [
      {
        titulo: "Postula al Convenio Marco de Software",
        resumen: "Cómo se vende por Convenio Marco de Software: oportunidades que impulsan la innovación.",
        url: "https://www.linkedin.com/posts/evaras_como-se-vende-por-convenio-marco-se-software-activity-7490531320801062913-j55j",
        imagenUrl: "/media/academia/convenio-software.jpg",
      },
      {
        titulo: "¿Tu empresa quiere aterrizar en Chile?",
        resumen: "Se buscan empresas expertas en Softlanding para acompañar a compañías extranjeras.",
        url: "https://www.linkedin.com/posts/evaras_se-busca-empresas-expertas-en-softlanding-activity-7491291813044076544-Tbep",
        imagenUrl: "/media/academia/softlanding.jpg",
      },
      {
        titulo: "Gracias, comunidad: 31.355 seguidores",
        resumen: "Seguimos creciendo, aprendiendo y compartiendo valor juntos.",
        url: "",
        imagenUrl: "/media/academia/gracias-comunidad.jpg",
      },
      {
        titulo: "Cómo estudiar un Convenio Marco con IA",
        resumen: "Usa la inteligencia artificial para analizar un Convenio Marco antes de postular.",
        url: "https://www.linkedin.com/posts/evaras_c%C3%B3mo-estudiar-un-convenio-marco-con-ia-activity-7492799322430967808-yz0X",
        imagenUrl: null as string | null,
      },
      {
        titulo: "¿Qué tal este Trato Directo?",
        resumen: "Un caso de trato directo que vale la pena mirar de cerca.",
        url: "https://www.linkedin.com/posts/evaras_que-tal-este-trato-directo-activity-7490290661707956225-KnbH",
        imagenUrl: null,
      },
      {
        titulo: "Un Trato Directo de $67.990.000.000",
        resumen: "El llamativo trato directo del 30 de julio.",
        url: "https://www.linkedin.com/posts/evaras_un-trato-directo-de-67990000000-30-julio-activity-7490245431042555904-77hL",
        imagenUrl: null,
      },
      {
        titulo: "Se abrió el Convenio Marco de Desarrollo",
        resumen: "Mi publicación sobre la apertura de este Convenio Marco en Mercado Público.",
        url: "https://www.linkedin.com/posts/evaras_se-abri%C3%B3-el-convenio-marco-de-desarrollo-ugcPost-7485053898337218560-oIVj/",
        imagenUrl: null,
      },
    ],
  },

  // --- Libros a la venta ----------------------------------------------------
  libros: [
    {
      titulo: "Véndele al Estado y No Mueras en el Intento",
      resena:
        "Por Enrique Evaristo Varas Bahamonde. Serie de 7 volúmenes que te guía paso a paso en el mundo de las licitaciones públicas y las ventas al Estado: desde los fundamentos hasta estrategias avanzadas para convertirte en un proveedor exitoso del sector público, sin morir en el intento.",
      precio: "", // ← opcional (ej. "$12.000"); si lo dejas vacío no se muestra
      portadaUrl: "/media/academia/libro-portada.jpg" as string | null,
      comprarUrl: "https://www.amazon.com/-/es/dp/B0G4NLY5TL", // link de compra
    },
  ],

  // --- Cursos que imparto ---------------------------------------------------
  cursos: [
    {
      titulo: "Nombre del curso",
      descripcion: "Qué aprenderás y para quién es.",
      accesoUrl: "", // link de acceso / inscripción
    },
  ],

  // --- Asesoría gratuita (Google Form) --------------------------------------
  asesoria: {
    descripcion:
      "¿Cómo quieres venderle al Estado y no morir en el intento? Cuéntame tu situación en 1 minuto y te contacto para orientarte, gratis.",
    formUrl: "", // ← link de tu Google Form
  },

  // --- Grupo de WhatsApp de proveedores del Estado --------------------------
  whatsappGrupo: {
    descripcion:
      "Únete a la comunidad de proveedores del Estado: dudas, oportunidades y novedades de Mercado Público.",
    invitacionUrl: "https://chat.whatsapp.com/GL4VBjnNpck9uLYiNltNic", // ← link de invitación al grupo
  },

  // --- Contacto directo -----------------------------------------------------
  contacto: {
    whatsapp: "https://wa.me/56994259157",
    email: "contacto@firmavb.cl",
  },
};

// Convierte una url de Spotify en su versión "embed"
function spotifyEmbed(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}`;
}

// Extrae el ID de YouTube de un link completo o devuelve el id tal cual
function youtubeId(idOrUrl: string): string {
  const m = idOrUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : idOrUrl.trim();
}

// -----------------------------------------------------------------------------
//  Sección genérica (título + icono + descripción)
// -----------------------------------------------------------------------------
function Seccion({
  id,
  icon: Icon,
  titulo,
  subtitulo,
  children,
  alt = false,
}: {
  id: string;
  icon: React.ElementType;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  alt?: boolean;
}) {
  return (
    <section id={id} className={`py-16 px-6 ${alt ? "bg-muted/30" : ""}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-firmavb-blue" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{titulo}</h2>
        </div>
        {subtitulo && (
          <p className="text-muted-foreground mb-8 max-w-2xl">{subtitulo}</p>
        )}
        {!subtitulo && <div className="mb-8" />}
        {children}
      </div>
    </section>
  );
}

// Mensaje cuando una sección todavía no tiene contenido cargado
function PendientePorCargar({ texto }: { texto: string }) {
  return (
    <Card className="border-dashed border-2 border-border/60 bg-muted/20">
      <CardContent className="py-8 text-center text-muted-foreground text-sm">
        {texto}
      </CardContent>
    </Card>
  );
}

export default function Academia() {
  const { perfil, banner, youtube, musica, linkedin, libros, cursos, asesoria, whatsappGrupo, contacto } =
    CONTENIDO;

  const videosCargados = youtube.videos.filter((v) => v.id.trim() !== "");
  const musicaCargada = musica.filter((m) => m.url.trim() !== "");
  const postsCargados = linkedin.posts.filter(
    (p) => (p.url && p.url.trim() !== "") || p.imagenUrl
  );
  const librosCargados = libros.filter((l) => l.titulo.trim() !== "" && l.titulo !== "Título del libro");
  const cursosCargados = cursos.filter((c) => c.titulo.trim() !== "" && c.titulo !== "Nombre del curso");

  const nav = [
    { href: "#videos", label: "Videos", icon: Youtube },
    { href: "#musica", label: "Música", icon: Music2 },
    { href: "#libros", label: "Libros", icon: BookOpen },
    { href: "#cursos", label: "Cursos", icon: GraduationCap },
    { href: "#asesoria", label: "Asesoría", icon: ClipboardList },
    { href: "#comunidad", label: "Comunidad", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-firmavb-gray">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-white/90 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoFirmavbOriginal}
              alt="FirmaVB"
              className="h-10 w-auto object-contain drop-shadow-sm"
              style={{ padding: "2px" }}
            />
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-firmavb-blue transition-colors rounded-md"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="shrink-0">
              {perfil.fotoUrl ? (
                <img
                  src={perfil.fotoUrl}
                  alt={perfil.nombre}
                  className="h-32 w-32 md:h-40 md:w-40 rounded-full object-cover shadow-lg border-4 border-white"
                />
              ) : (
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-firmavb-blue/10 flex items-center justify-center shadow-lg border-4 border-white">
                  <span className="text-4xl md:text-5xl font-bold text-firmavb-blue">
                    {perfil.nombre
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                </div>
              )}
            </div>
            <div className="text-center md:text-left">
              <Badge className="mb-3 bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/20">
                <Sparkles className="h-3 w-3 mr-1" />
                Academia FirmaVB
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2">
                {perfil.nombre}
              </h1>
              <p className="text-lg text-firmavb-blue font-medium mb-3">{perfil.titulo}</p>
              <p className="text-muted-foreground max-w-2xl">{perfil.bio}</p>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-5">
                <Button asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2">
                  <a href="#asesoria">
                    <ClipboardList className="h-4 w-4" />
                    Asesoría gratuita
                  </a>
                </Button>
                <Button variant="outline" asChild className="gap-2">
                  <a href="#comunidad">
                    <MessageCircle className="h-4 w-4" />
                    Unirme a la comunidad
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner destacado */}
      {banner.imagenUrl && (
        <section className="px-6 pb-6">
          <div className="max-w-3xl mx-auto">
            {banner.enlaceUrl ? (
              <a href={banner.enlaceUrl} className="block group">
                <img
                  src={banner.imagenUrl}
                  alt={banner.alt}
                  className="w-full rounded-2xl shadow-lg border border-border/50 transition-transform group-hover:scale-[1.01]"
                />
              </a>
            ) : (
              <img
                src={banner.imagenUrl}
                alt={banner.alt}
                className="w-full rounded-2xl shadow-lg border border-border/50"
              />
            )}
          </div>
        </section>
      )}

      {/* Videos de YouTube */}
      <Seccion
        id="videos"
        icon={Youtube}
        titulo="Mis videos"
        subtitulo="Contenido en YouTube sobre compras públicas y cómo venderle al Estado."
        alt
      >
        {videosCargados.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {videosCargados.map((v, i) => (
              <Card key={i} className="overflow-hidden border-border/50">
                <div className="aspect-video bg-black">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${youtubeId(v.id)}`}
                    title={v.titulo || `Video ${i + 1}`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {v.titulo && (
                  <CardContent className="py-3">
                    <p className="font-medium text-sm text-foreground">{v.titulo}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <PendientePorCargar texto="Aún no hay videos individuales seleccionados. Mientras tanto, entra a mi canal 👇" />
        )}
        {youtube.canalUrl && (
          <div className="mt-6">
            <Button
              asChild
              className="bg-firmavb-red hover:bg-firmavb-red/90 gap-2"
            >
              <a href={youtube.canalUrl} target="_blank" rel="noopener noreferrer">
                <Youtube className="h-4 w-4" />
                Ver mi canal en YouTube
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        )}
      </Seccion>

      {/* Música */}
      <Seccion
        id="musica"
        icon={Music2}
        titulo="Mi música"
        subtitulo="Mis canciones. Dale play sin salir de la página."
      >
        {musicaCargada.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-6">
            {musicaCargada.map((m, i) => {
              const embed = spotifyEmbed(m.url);
              return (
                <Card key={i} className="overflow-hidden border-border/50">
                  {embed ? (
                    <iframe
                      className="w-full"
                      style={{ height: 152 }}
                      src={embed}
                      title={m.titulo}
                      loading="lazy"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    />
                  ) : (
                    <CardContent className="py-5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Music2 className="h-5 w-5 text-firmavb-blue" />
                        <span className="font-medium text-foreground">{m.titulo}</span>
                      </div>
                      <Button size="sm" variant="outline" asChild className="gap-2">
                        <a href={m.url} target="_blank" rel="noopener noreferrer">
                          Escuchar
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <PendientePorCargar texto="Aún no hay canciones cargadas. Pega los links de Spotify o YouTube en el bloque CONTENIDO." />
        )}
      </Seccion>

      {/* LinkedIn */}
      <Seccion
        id="linkedin"
        icon={Linkedin}
        titulo="En LinkedIn"
        subtitulo="Mis publicaciones destacadas."
        alt
      >
        {postsCargados.length > 0 ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {postsCargados.map((p, i) => (
                <Card
                  key={i}
                  className="border-border/50 hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >
                  {p.imagenUrl && (
                    <a
                      href={p.url || linkedin.perfilUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-muted"
                    >
                      <img
                        src={p.imagenUrl}
                        alt={p.titulo}
                        loading="lazy"
                        className="w-full aspect-square object-cover hover:opacity-95 transition-opacity"
                      />
                    </a>
                  )}
                  <CardContent className="py-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2 text-firmavb-blue">
                      <Linkedin className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">LinkedIn</span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{p.titulo}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">{p.resumen}</p>
                    {p.url && (
                      <Button size="sm" variant="outline" asChild className="gap-2 self-start">
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          Ver publicación
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {linkedin.perfilUrl && (
              <div className="mt-6">
                <Button variant="outline" asChild className="gap-2">
                  <a href={linkedin.perfilUrl} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" />
                    Ver mi perfil de LinkedIn
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <PendientePorCargar texto="Aún no hay posts cargados. Pega los links de tus publicaciones de LinkedIn en el bloque CONTENIDO." />
            {linkedin.perfilUrl && (
              <Button variant="outline" asChild className="gap-2">
                <a href={linkedin.perfilUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4" />
                  Ver mi perfil de LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        )}
      </Seccion>

      {/* Libros */}
      <Seccion
        id="libros"
        icon={BookOpen}
        titulo="Mis libros"
        subtitulo="Disponibles a la venta, con una breve reseña de cada uno."
      >
        {librosCargados.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {librosCargados.map((l, i) => (
              <Card key={i} className="border-border/50 overflow-hidden flex flex-col">
                <div className="aspect-[3/4] bg-muted/50 flex items-center justify-center">
                  {l.portadaUrl ? (
                    <img src={l.portadaUrl} alt={l.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-12 w-12 text-muted-foreground/40" />
                  )}
                </div>
                <CardContent className="py-5 flex flex-col flex-1">
                  <h3 className="font-semibold text-foreground mb-1">{l.titulo}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{l.resena}</p>
                  <div className="flex items-center justify-between gap-3">
                    {l.precio ? (
                      <span className="text-lg font-bold text-firmavb-blue">{l.precio}</span>
                    ) : (
                      <span />
                    )}
                    {l.comprarUrl && (
                      <Button size="sm" asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2">
                        <a href={l.comprarUrl} target="_blank" rel="noopener noreferrer">
                          Comprar en Amazon
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <PendientePorCargar texto="Aún no hay libros cargados. Agrega tus libros (título, reseña, precio y link de compra) en el bloque CONTENIDO." />
        )}
      </Seccion>

      {/* Cursos */}
      <Seccion
        id="cursos"
        icon={GraduationCap}
        titulo="Mis cursos"
        subtitulo="Cursos gratuitos, paso a paso, para venderle al Estado. Ábrelos y aprende a tu ritmo."
        alt
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CURSOS.map((c) => (
            <Card
              key={c.slug}
              className="border-border/50 hover:shadow-md transition-shadow flex flex-col overflow-hidden"
            >
              <div className={`${ACENTO[c.acento].portada} h-24 flex items-center justify-center`}>
                <span className="text-5xl drop-shadow-md">{c.emoji}</span>
              </div>
              <CardContent className="py-6 flex flex-col flex-1">
                <h3 className="font-semibold text-foreground mb-1">{c.titulo}</h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">{c.descripcion}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">{c.nivel}</Badge>
                  <Badge variant="outline" className="text-xs">{c.duracion}</Badge>
                </div>
                <Button asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2 w-full">
                  <Link to={`/academia/curso/${c.slug}`}>
                    Ver curso gratis
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Seccion>

      {/* Asesoría gratuita */}
      <Seccion
        id="asesoria"
        icon={ClipboardList}
        titulo="Asesoría gratuita"
        subtitulo={asesoria.descripcion}
      >
        {asesoria.formUrl ? (
          <Card className="border-border/50 overflow-hidden">
            <iframe
              src={asesoria.formUrl}
              title="Cuestionario de asesoría gratuita"
              className="w-full"
              style={{ height: 720 }}
              loading="lazy"
            >
              Cargando cuestionario…
            </iframe>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="py-8">
              <AcademiaLeadForm />
            </CardContent>
          </Card>
        )}
      </Seccion>

      {/* Comunidad WhatsApp + Contacto */}
      <Seccion
        id="comunidad"
        icon={MessageCircle}
        titulo="Comunidad y contacto"
        subtitulo="Únete al grupo de proveedores del Estado o escríbeme directamente."
        alt
      >
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-gradient-to-br from-[hsl(var(--success))]/10 to-transparent">
            <CardContent className="py-8">
              <MessageCircle className="h-10 w-10 text-[hsl(var(--success))] mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Grupo de WhatsApp · Proveedores del Estado
              </h3>
              <p className="text-muted-foreground mb-5">{whatsappGrupo.descripcion}</p>
              {whatsappGrupo.invitacionUrl ? (
                <Button
                  asChild
                  className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 gap-2"
                >
                  <a href={whatsappGrupo.invitacionUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Unirme al grupo
                  </a>
                </Button>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Link del grupo pendiente por cargar
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="py-8">
              <Mail className="h-10 w-10 text-firmavb-blue mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">Conversemos</h3>
              <p className="text-muted-foreground mb-5">
                ¿Tienes dudas o quieres trabajar conmigo? Escríbeme y te respondo.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="gap-2">
                  <a href={contacto.whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href={`mailto:${contacto.email}`}>
                    <Mail className="h-4 w-4" />
                    {contacto.email}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Seccion>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-border/50 bg-muted/20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logoFirmavbOriginal}
              alt="FirmaVB"
              className="h-8 w-auto object-contain"
              style={{ padding: "2px" }}
            />
            <span className="text-sm text-muted-foreground">Academia FirmaVB</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-firmavb-blue transition-colors">
              Ir a FirmaVB
            </Link>
            <Star className="h-4 w-4 text-warning fill-warning" />
          </div>
        </div>
      </footer>
    </div>
  );
}
