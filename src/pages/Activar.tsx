import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, PartyPopper, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";

interface Invite {
  nombre: string;
  email: string;
  rol: string;
  empresa: string;
  ya_activada: boolean;
}

export default function Activar() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();

  const [cargando, setCargando] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [activando, setActivando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!token) { setErrorCarga("El enlace no es válido."); setCargando(false); return; }
      const { data, error } = await supabase.functions.invoke("activar-miembro", {
        body: { action: "info", token },
      });
      if (!vivo) return;
      if (error || data?.error || !data?.ok) {
        setErrorCarga(data?.error || "No pudimos encontrar esta invitación.");
      } else {
        setInvite(data as Invite);
      }
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [token]);

  const activar = async () => {
    if (password.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== password2) { toast.error("Las contraseñas no coinciden."); return; }
    setActivando(true);
    const { data, error } = await supabase.functions.invoke("activar-miembro", {
      body: { action: "activar", token, password },
    });
    if (error || data?.error || !data?.ok) {
      setActivando(false);
      toast.error(data?.error || "No se pudo activar la cuenta.");
      return;
    }
    // Iniciar sesión automáticamente.
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: data.email, password });
    setActivando(false);
    if (signErr) {
      toast.success("¡Cuenta activada! Ya puedes iniciar sesión.");
      navigate("/auth", { replace: true });
      return;
    }
    toast.success("¡Bienvenido al equipo! 🎉");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-firmavb-gray px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src={logoFirmavbOriginal} alt="FirmaVB" className="h-12 w-auto object-contain" />
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="py-8">
            {cargando ? (
              <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                Cargando tu invitación…
              </div>
            ) : errorCarga ? (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <h1 className="text-lg font-semibold">No pudimos abrir la invitación</h1>
                <p className="text-sm text-muted-foreground">{errorCarga}</p>
                <Button asChild variant="outline" className="mt-2">
                  <Link to="/auth">Ir a iniciar sesión</Link>
                </Button>
              </div>
            ) : invite?.ya_activada ? (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
                  <ShieldCheck className="h-6 w-6 text-[hsl(var(--success))]" />
                </div>
                <h1 className="text-lg font-semibold">Esta cuenta ya está activada</h1>
                <p className="text-sm text-muted-foreground">Inicia sesión con tu correo {invite.email}.</p>
                <Button asChild className="mt-2">
                  <Link to="/auth">Iniciar sesión</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <PartyPopper className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-xl font-bold">¡Hola, {invite?.nombre?.split(" ")[0] || ""}!</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invite?.empresa ? <>Te sumaron al equipo de <strong>{invite.empresa}</strong> en FirmaVB.</> : <>Te invitaron a FirmaVB.</>}
                    {" "}Crea tu contraseña para activar tu cuenta.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tu correo</Label>
                  <Input value={invite?.email || ""} disabled className="bg-muted/40" />
                </div>
                <div className="space-y-2">
                  <Label>Crea tu contraseña</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                    onKeyDown={(e) => e.key === "Enter" && activar()} />
                </div>
                <div className="space-y-2">
                  <Label>Repite tu contraseña</Label>
                  <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repite la contraseña"
                    onKeyDown={(e) => e.key === "Enter" && activar()} />
                </div>

                <Button className="w-full gap-2" onClick={activar} disabled={activando}>
                  {activando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Activar mi cuenta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
