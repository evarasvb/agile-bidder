import { useState, useEffect, useCallback } from "react";
import {
  User,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  Globe,
  Building2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useProfile, Profile as ProfileType } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateTrustScore,
  formatRut,
  cleanRut,
  validateRut,
  type ProfileData,
  type TrustScoreResult,
} from "@/services/trustScore";

/**
 * Formatea input de RUT en tiempo real con máscara visual chilena (XX.XXX.XXX-X)
 */
function handleRutInput(value: string): string {
  // Limpiar a solo números y K
  let clean = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length === 0) return "";
  // Limitar largo total
  if (clean.length > 9) clean = clean.slice(0, 9);
  return formatRut(clean);
}

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();
  const [activeTab, setActiveTab] = useState("perfil");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Campos del formulario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [website, setWebsite] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");

  // Trust score
  const [trustScore, setTrustScore] = useState<TrustScoreResult | null>(null);

  // Cargar datos del perfil
  useEffect(() => {
    if (profile) {
      // Si hay first_name/last_name, usarlos. Si no, intentar split de full_name
      if (profile.first_name || profile.last_name) {
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
      } else if (profile.full_name) {
        const parts = profile.full_name.trim().split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }

      setEmail(profile.email || user?.email || "");
      setRut(profile.rut ? formatRut(profile.rut) : "");
      setPhone(profile.phone || "");
      setAboutMe(profile.about_me || "");
      setWebsite(profile.website || "");
      setCompanyName(profile.company_name || "");
      setInstagramUsername(profile.instagram_username || "");

      // Calcular trust score
      recalculateTrustScore(profile);
    } else if (user) {
      setEmail(user.email || "");
    }
  }, [profile, user]);

  const recalculateTrustScore = useCallback(
    (profileOverride?: ProfileType | null) => {
      const p = profileOverride || profile;
      const profileData: ProfileData = {
        ...(p || {}),
        first_name: firstName || p?.first_name,
        last_name: lastName || p?.last_name,
        full_name:
          firstName || lastName
            ? `${firstName} ${lastName}`.trim()
            : p?.full_name,
        email: email || p?.email,
        rut: rut ? cleanRut(rut) : p?.rut ? cleanRut(p.rut) : null,
        phone: phone || p?.phone,
        about_me: aboutMe || p?.about_me,
        website: website || p?.website,
        company_name: companyName || p?.company_name,
        instagram_username: instagramUsername || p?.instagram_username,
        instagram_verified: p?.instagram_verified || false,
        avatar_url: p?.avatar_url,
      };
      setTrustScore(calculateTrustScore(profileData));
    },
    [
      profile,
      firstName,
      lastName,
      email,
      rut,
      phone,
      aboutMe,
      website,
      companyName,
      instagramUsername,
    ]
  );

  // Recalcular trust score cuando cambien los campos
  useEffect(() => {
    recalculateTrustScore();
  }, [
    firstName,
    lastName,
    email,
    rut,
    phone,
    aboutMe,
    website,
    companyName,
    instagramUsername,
    recalculateTrustScore,
  ]);

  const markChanged = () => setHasChanges(true);

  const handleSave = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para guardar tu perfil");
      return;
    }

    // Validar RUT si se ingresó
    if (rut && rut.trim().length > 0) {
      const rawRut = cleanRut(rut);
      if (rawRut.length >= 8 && !validateRut(rawRut)) {
        toast.error("El RUT ingresado no es válido. Verifica el dígito verificador.");
        return;
      }
    }

    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const rawRut = rut ? cleanRut(rut) : null;
      // Guardar el RUT con formato para display, sin puntos internamente
      const rutToSave = rawRut && rawRut.length >= 8 
        ? `${rawRut.slice(0, -1)}-${rawRut.slice(-1)}` 
        : rawRut;

      const updates: Partial<ProfileType> = {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: fullName || null,
        rut: rutToSave,
        phone: phone.trim() || null,
        about_me: aboutMe.trim() || null,
        website: website.trim() || null,
        company_name: companyName.trim() || null,
        instagram_username: instagramUsername.trim() || null,
      };

      const { error } = await updateProfile(updates);

      if (error) {
        console.error("Error saving profile:", error);
        toast.error("Error al guardar el perfil. Intenta nuevamente.");
      } else {
        toast.success("Perfil guardado exitosamente");
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Unexpected error saving profile:", err);
      toast.error("Error inesperado al guardar");
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Auth required
  if (!user) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Debes iniciar sesión para ver tu perfil.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completa tu perfil para aumentar tu nivel de confianza
          </p>
        </div>
        <Button
          className="gap-2 bg-primary hover:bg-primary/90"
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Cambios
          {hasChanges && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              •
            </Badge>
          )}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="confianza" className="gap-2">
            <Shield className="h-4 w-4" />
            Confianza
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB: PERFIL ==================== */}
        <TabsContent value="perfil" className="mt-6 max-w-4xl space-y-6">
          {/* Información Personal */}
          <ProfileSection
            icon={User}
            title="Información Personal"
            description="Datos básicos de tu identidad"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="Ej: Evaristo"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    markChanged();
                  }}
                  className="h-10"
                />
              </div>

              {/* Apellido */}
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Apellido <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  placeholder="Ej: Bahamonde"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    markChanged();
                  }}
                  className="h-10"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="h-10 bg-muted/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  El email se gestiona desde tu cuenta de autenticación
                </p>
              </div>

              {/* RUT */}
              <div className="space-y-2">
                <Label htmlFor="rut">
                  RUT <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rut"
                  placeholder="14.171.737-5"
                  value={rut}
                  onChange={(e) => {
                    const formatted = handleRutInput(e.target.value);
                    setRut(formatted);
                    markChanged();
                  }}
                  maxLength={12}
                  className="h-10 font-mono"
                />
                {rut && rut.length >= 10 && (
                  <div className="flex items-center gap-1.5">
                    {validateRut(cleanRut(rut)) ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs text-green-600">
                          RUT válido
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-xs text-red-500">
                          RUT inválido
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ProfileSection>

          {/* Contacto */}
          <ProfileSection
            icon={Phone}
            title="Contacto"
            description="Datos de contacto y comunicación"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {/* Teléfono / WhatsApp */}
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="+56 9 0996 0055"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      markChanged();
                    }}
                    className="h-10 pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Formato WhatsApp: +56 9 XXXX XXXX
                </p>
              </div>

              {/* Sitio Web */}
              <div className="space-y-2">
                <Label htmlFor="website">Sitio Web</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    placeholder="https://www.miempresa.cl"
                    value={website}
                    onChange={(e) => {
                      setWebsite(e.target.value);
                      markChanged();
                    }}
                    className="h-10 pl-10"
                  />
                </div>
              </div>

              {/* Instagram */}
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    @
                  </span>
                  <Input
                    id="instagram"
                    placeholder="mi_usuario"
                    value={instagramUsername}
                    onChange={(e) => {
                      setInstagramUsername(
                        e.target.value.replace(/^@/, "")
                      );
                      markChanged();
                    }}
                    className="h-10 pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nombre de usuario sin el @
                </p>
              </div>

              {/* Empresa */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Empresa</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Mi Empresa SpA"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      markChanged();
                    }}
                    className="h-10 pl-10"
                  />
                </div>
              </div>
            </div>
          </ProfileSection>

          {/* Sobre mí */}
          <ProfileSection
            icon={FileText}
            title="Sobre mí"
            description="Cuéntanos sobre ti y tu experiencia"
          >
            <div className="space-y-2">
              <Textarea
                id="aboutMe"
                placeholder="Escribe una breve descripción sobre ti, tu experiencia, o qué productos ofreces..."
                value={aboutMe}
                onChange={(e) => {
                  setAboutMe(e.target.value);
                  markChanged();
                }}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {aboutMe.length}/500 caracteres
              </p>
            </div>
          </ProfileSection>
        </TabsContent>

        {/* ==================== TAB: CONFIANZA ==================== */}
        <TabsContent value="confianza" className="mt-6 max-w-4xl space-y-6">
          {/* Score Overview */}
          {trustScore && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Nivel de Confianza
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Completa tu perfil para mejorar tu nivel
                  </p>
                </div>
                <div className="text-right">
                  <div
                    className="text-3xl font-bold"
                    style={{ color: trustScore.color }}
                  >
                    {trustScore.score}%
                  </div>
                  <Badge
                    variant="outline"
                    className="mt-1"
                    style={{
                      borderColor: trustScore.color,
                      color: trustScore.color,
                    }}
                  >
                    {trustScore.levelLabel}
                  </Badge>
                </div>
              </div>

              <Progress
                value={trustScore.score}
                className="h-3 mb-3"
              />

              <p className="text-xs text-muted-foreground">
                {trustScore.completedCount} de {trustScore.totalCount}{" "}
                verificaciones completadas
              </p>
            </div>
          )}

          {/* Verification Items */}
          {trustScore && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Verificaciones
              </h3>
              <div className="space-y-3">
                {trustScore.items.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      item.verified
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.verified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            item.verified
                              ? "text-green-800 dark:text-green-200"
                              : "text-foreground"
                          }`}
                        >
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={item.verified ? "default" : "secondary"}
                      className={
                        item.verified
                          ? "bg-green-600 hover:bg-green-600 text-white"
                          : ""
                      }
                    >
                      +{item.weight}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tip */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Un nivel de confianza alto mejora tu visibilidad en las
              licitaciones y genera mayor credibilidad ante instituciones
              públicas. Completa todos los campos de tu perfil para alcanzar
              el nivel &quot;Verificado&quot;.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== Profile Section Component ====================

interface ProfileSectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}

function ProfileSection({
  icon: Icon,
  title,
  description,
  children,
}: ProfileSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Separator className="mb-5" />
      {children}
    </div>
  );
}
