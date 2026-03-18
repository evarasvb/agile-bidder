/**
 * Trust Score Service - FirmaVB
 * Calcula el nivel de confianza del usuario basado en la completitud de su perfil.
 */

export interface ProfileData {
  id?: string;
  user_id?: string;
  email?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  rut?: string | null;
  phone?: string | null;
  about_me?: string | null;
  instagram_username?: string | null;
  instagram_verified?: boolean | null;
  website?: string | null;
  company_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VerificationItem {
  key: string;
  label: string;
  description: string;
  verified: boolean;
  weight: number;
}

export interface TrustScoreResult {
  score: number; // 0-100
  level: 'bajo' | 'medio' | 'alto' | 'verificado';
  levelLabel: string;
  color: string;
  items: VerificationItem[];
  completedCount: number;
  totalCount: number;
}

/**
 * Valida un RUT chileno (formato XX.XXX.XXX-X o XXXXXXXX-X)
 */
export function validateRut(rut: string): boolean {
  if (!rut || rut.trim().length === 0) return false;

  // Limpiar el RUT: remover puntos y espacios
  const cleanRut = rut.replace(/\./g, '').replace(/\s/g, '').trim();

  // Debe tener guión
  if (!cleanRut.includes('-')) return false;

  const [body, dv] = cleanRut.split('-');

  if (!body || !dv || body.length < 7 || body.length > 8) return false;

  // Validar que el cuerpo sea numérico
  if (!/^\d+$/.test(body)) return false;

  // Validar dígito verificador
  const dvExpected = calculateDv(parseInt(body, 10));
  return dv.toUpperCase() === dvExpected.toUpperCase();
}

/**
 * Calcula el dígito verificador de un RUT
 */
function calculateDv(rutBody: number): string {
  let sum = 0;
  let multiplier = 2;
  let rutStr = rutBody.toString();

  for (let i = rutStr.length - 1; i >= 0; i--) {
    sum += parseInt(rutStr[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return remainder.toString();
}

/**
 * Formatea un RUT chileno al formato XX.XXX.XXX-X
 */
export function formatRut(rut: string): string {
  if (!rut) return '';

  // Limpiar: solo números y K
  let clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();

  if (clean.length < 2) return clean;

  // Separar cuerpo y DV
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);

  // Agregar puntos al cuerpo
  let formatted = '';
  for (let i = body.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = body[i] + formatted;
  }

  return `${formatted}-${dv}`;
}

/**
 * Limpia un RUT a solo números y DV (sin puntos ni guión)
 */
export function cleanRut(rut: string): string {
  if (!rut) return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Valida un número de teléfono chileno
 */
function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone || phone.trim().length === 0) return false;
  // Aceptar formatos: +569XXXXXXXX, 569XXXXXXXX, 9XXXXXXXX, etc.
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  return clean.length >= 8 && /^(\+?56)?9?\d{7,8}$/.test(clean);
}

/**
 * Obtiene el estado de verificación de cada campo del perfil
 */
export function getVerificationStatus(profile: ProfileData | null): VerificationItem[] {
  if (!profile) {
    return getDefaultItems();
  }

  // Verificar nombre completo (first_name + last_name o full_name)
  const hasFirstName = !!(profile.first_name && profile.first_name.trim().length > 0);
  const hasLastName = !!(profile.last_name && profile.last_name.trim().length > 0);
  const hasFullName = !!(profile.full_name && profile.full_name.trim().length > 1);
  const nameOk = (hasFirstName && hasLastName) || hasFullName;

  // Verificar email
  const emailOk = !!(profile.email && profile.email.includes('@'));

  // Verificar RUT
  const rutOk = !!(profile.rut && profile.rut.trim().length >= 9 && validateRut(profile.rut));

  // Verificar teléfono
  const phoneOk = isValidPhone(profile.phone);

  // Verificar "Sobre mí"
  const aboutOk = !!(profile.about_me && profile.about_me.trim().length >= 3);

  // Verificar avatar/foto de perfil
  const avatarOk = !!(profile.avatar_url && profile.avatar_url.trim().length > 0);

  // Verificar Instagram - la variable instagramOk se define aquí
  const instagramOk = !!(profile.instagram_username && profile.instagram_username.trim().length > 0 && profile.instagram_verified === true);

  // Verificar sitio web
  const websiteOk = !!(profile.website && profile.website.trim().length > 5);

  // Verificar nombre de empresa
  const companyOk = !!(profile.company_name && profile.company_name.trim().length > 1);

  const items: VerificationItem[] = [
    {
      key: 'name',
      label: 'Nombre completo',
      description: 'Nombre y apellido registrados',
      verified: nameOk,
      weight: 20,
    },
    {
      key: 'email',
      label: 'Email verificado',
      description: 'Correo electrónico confirmado',
      verified: emailOk,
      weight: 15,
    },
    {
      key: 'rut',
      label: 'RUT verificado',
      description: 'RUT chileno válido ingresado',
      verified: rutOk,
      weight: 20,
    },
    {
      key: 'phone',
      label: 'Teléfono verificado',
      description: 'Número de teléfono/WhatsApp ingresado',
      verified: phoneOk,
      weight: 15,
    },
    {
      key: 'about',
      label: 'Sobre mí',
      description: 'Descripción personal completada',
      verified: aboutOk,
      weight: 10,
    },
    {
      key: 'avatar',
      label: 'Foto de perfil',
      description: 'Imagen de perfil subida',
      verified: avatarOk,
      weight: 5,
    },
    {
      key: 'instagram',
      label: 'Instagram verificado',
      description: 'Cuenta de Instagram vinculada y verificada',
      verified: instagramOk,
      weight: 5,
    },
    {
      key: 'website',
      label: 'Sitio web',
      description: 'URL del sitio web o portafolio',
      verified: websiteOk,
      weight: 5,
    },
    {
      key: 'company',
      label: 'Empresa',
      description: 'Nombre de empresa registrado',
      verified: companyOk,
      weight: 5,
    },
  ];

  return items;
}

function getDefaultItems(): VerificationItem[] {
  return [
    { key: 'name', label: 'Nombre completo', description: 'Nombre y apellido registrados', verified: false, weight: 20 },
    { key: 'email', label: 'Email verificado', description: 'Correo electrónico confirmado', verified: false, weight: 15 },
    { key: 'rut', label: 'RUT verificado', description: 'RUT chileno válido ingresado', verified: false, weight: 20 },
    { key: 'phone', label: 'Teléfono verificado', description: 'Número de teléfono/WhatsApp ingresado', verified: false, weight: 15 },
    { key: 'about', label: 'Sobre mí', description: 'Descripción personal completada', verified: false, weight: 10 },
    { key: 'avatar', label: 'Foto de perfil', description: 'Imagen de perfil subida', verified: false, weight: 5 },
    { key: 'instagram', label: 'Instagram verificado', description: 'Cuenta de Instagram vinculada y verificada', verified: false, weight: 5 },
    { key: 'website', label: 'Sitio web', description: 'URL del sitio web o portafolio', verified: false, weight: 5 },
    { key: 'company', label: 'Empresa', description: 'Nombre de empresa registrado', verified: false, weight: 5 },
  ];
}

/**
 * Calcula el puntaje de confianza total del perfil
 */
export function calculateTrustScore(profile: ProfileData | null): TrustScoreResult {
  const items = getVerificationStatus(profile);

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const earnedWeight = items.reduce((sum, item) => sum + (item.verified ? item.weight : 0), 0);

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const completedCount = items.filter((item) => item.verified).length;
  const totalCount = items.length;

  let level: TrustScoreResult['level'];
  let levelLabel: string;
  let color: string;

  if (score >= 80) {
    level = 'verificado';
    levelLabel = 'Verificado';
    color = '#16a34a'; // green-600
  } else if (score >= 50) {
    level = 'alto';
    levelLabel = 'Alto';
    color = '#2563eb'; // blue-600
  } else if (score >= 25) {
    level = 'medio';
    levelLabel = 'Medio';
    color = '#d97706'; // amber-600
  } else {
    level = 'bajo';
    levelLabel = 'Bajo';
    color = '#dc2626'; // red-600
  }

  return {
    score,
    level,
    levelLabel,
    color,
    items,
    completedCount,
    totalCount,
  };
}
