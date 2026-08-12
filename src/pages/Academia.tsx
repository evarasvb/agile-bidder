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
    fotoUrl: null as string | null,
  },

  // --- Videos de YouTube ----------------------------------------------------
  // Pega el ID de cada video (la parte después de watch?v= )
  youtube: {
    canalUrl: "https://youtube.com/@firmavb", // ← tu canal
    videos: [
      // Pega el ID de cada video (la parte después de watch?v= ). Ej: { id: "dQw4w9WgXcQ", titulo: "..." }
      { id: "", titulo: "" },
      { id: "", titulo: "" },
      { id: "", titulo: "" },
    ],
  },

  // --- Música / canciones ---------------------------------------------------
  musica: [
    { titulo: "Mi canción", url: "" }, // ← link de Spotify / YouTube
  ],

  // --- Posts de LinkedIn ----------------------------------------------------
  linkedin: {
    perfilUrl: "", // ← tu perfil de LinkedIn (ej. https://www.linkedin.com/in/tu-usuario)
    posts: [
      { titulo: "Post destacado 1", resumen: "Breve descripción del post.", url: "" },
      { titulo: "Post destacado 2", resumen: "Breve descripción del post.", url: "" },
    ],
  },

  // --- Libros a la venta ----------------------------------------------------
  libros: [
    {
      titulo: "Mi libro", // ← reemplaza por el título exacto
      resena: "Disponible ahora en Amazon.", // ← reemplaza por una reseña breve
      precio: "", // ← opcional (ej. "$12.000"); si lo dejas vacío no se muestra
      portadaUrl: null as string | null, // url de la portada (opcional)
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
      "Completa este breve cuestionario y te contacto para una asesoría gratuita sobre cómo vender al Estado.",
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
  const { perfil, youtube, musica, linkedin, libros, cursos, asesoria, whatsappGrupo, contacto } =
    CONTENIDO;

  const videosCargados = youtube.videos.filter((v) => v.id.trim() !== "");
  const musicaCargada = musica.filter((m) => m.url.trim() !== "");
  const postsCargados = linkedin.posts.filter((p) => p.url.trim() !== "");
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
          <div className="grid sm:grid-cols-2 gap-6">
            {postsCargados.map((p, i) => (
              <Card key={i} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="py-5">
                  <div className="flex items-center gap-2 mb-2 text-firmavb-blue">
                    <Linkedin className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">LinkedIn</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{p.titulo}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{p.resumen}</p>
                  <Button size="sm" variant="outline" asChild className="gap-2">
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      Ver publicación
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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
        subtitulo="Formación para vender al Estado. Accede o inscríbete."
        alt
      >
        {cursosCargados.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cursosCargados.map((c, i) => (
              <Card key={i} className="border-border/50 hover:shadow-md transition-shadow flex flex-col">
                <CardContent className="py-6 flex flex-col flex-1">
                  <GraduationCap className="h-8 w-8 text-firmavb-blue mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">{c.titulo}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{c.descripcion}</p>
                  {c.accesoUrl && (
                    <Button asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2 w-full">
                      <a href={c.accesoUrl} target="_blank" rel="noopener noreferrer">
                        Acceder al curso
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <PendientePorCargar texto="Aún no hay cursos cargados. Agrega tus cursos (título, descripción y link de acceso) en el bloque CONTENIDO." />
        )}
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
          <PendientePorCargar texto="Aún no hay cuestionario cargado. Pega el link de tu Google Form en el bloque CONTENIDO." />
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
