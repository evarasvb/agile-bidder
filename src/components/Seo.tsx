import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  path: string; // ej. "/academia" — sin dominio
}

const SITE = "https://www.firmavb.cl";

// Antes todo el sitio (SPA) compartía el mismo <title>/<meta description>
// estático de index.html — Landing, Academia y cada curso de la Academia se
// veían idénticos para Google. Esto los hace únicos por ruta.
export function Seo({ title, description, path }: SeoProps) {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:url" content={url} />
    </Helmet>
  );
}
