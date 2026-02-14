"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const session = localStorage.getItem("user_session");
        if (session) {
            router.push("/dashboard");
        }
    }, [router]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("usuariosconexion")
                .select("*")
                .eq("email", email)
                .eq("password", password)
                .single();

            if (error || !data) {
                toast.error("Credenciales incorrectas");
            } else {
                await supabase
                    .from("usuariosconexion")
                    .update({ fecha_ultimo_acceso: new Date().toISOString() })
                    .eq("id", data.id);

                localStorage.setItem("user_session", JSON.stringify({ email: data.email, id: data.id }));
                toast.success("¡Bienvenido!");
                router.push("/dashboard");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error al iniciar sesión");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center pb-12">
            {/* Header */}
            <header className="w-full max-w-md px-6 py-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-sm z-50">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold tracking-tight">Inicio de Sesión</h1>
                <div className="w-10"></div> {/* Spacer for symmetry */}
            </header>

            <main className="w-full max-w-md px-6 pt-2 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Hero Image */}
                <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-primary/5">
                    <img
                        src="https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=1200&auto=format&fit=crop"
                        alt="Minimalist Living Room"
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Welcome Text */}
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-extrabold tracking-tight">Bienvenido de nuevo</h2>
                    <p className="text-muted-foreground font-medium px-4">
                        Gestiona tus propiedades de Airbnb y Booking con facilidad.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-bold text-foreground/80 lowercase">Correo electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="ejemplo@correo.com"
                                className="h-14 rounded-2xl bg-muted/30 border-primary/5 focus:bg-background transition-all text-base px-5"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="password" title="Contraseña" className="text-sm font-bold text-foreground/80 lowercase">Contraseña</Label>
                                <button type="button" className="text-primary text-xs font-bold hover:underline">
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="........."
                                    className="h-14 rounded-2xl bg-muted/30 border-primary/5 focus:bg-background transition-all text-base px-5 pr-14"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-14 bg-[#1b6470] hover:bg-[#16515b] text-white rounded-2xl font-extrabold text-lg shadow-xl shadow-[#1b6470]/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Iniciar Sesión"
                        )}
                    </Button>
                </form>

                {/* Divider */}
                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-primary/5" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="bg-background px-4 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">o continuar con</span>
                    </div>
                </div>

                {/* Social Login */}
                <Button
                    variant="outline"
                    className="w-full h-14 rounded-2xl border-primary/10 font-bold text-base flex items-center justify-center gap-3 hover:bg-muted/50 transition-all"
                >
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        />
                        <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Google
                </Button>
            </main>
        </div>
    );
}
