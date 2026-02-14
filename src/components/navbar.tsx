"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Building2, CreditCard, LayoutDashboard, Settings, Calendar as CalendarIcon, Menu, X, Users, LogOut, ShieldCheck, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    if (pathname === "/login") return null;

    const navLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/alquileres", label: "Alquileres", icon: CreditCard },
        { href: "/proximos", label: "Calendario", icon: CalendarIcon },
        { href: "/graficos", label: "Stats", icon: BarChart3 },
        { href: "/gastos", label: "Gastos", icon: Building2 },
        { href: "/usuarios", label: "Usuarios", icon: Users },
        { href: "/configuracion", label: "Ajustes", icon: Settings },
        { href: "/tramites", label: "Trámites", icon: FileText },
    ];

    const handleLogout = () => {
        localStorage.removeItem("user_session");
        toast.info("Sesión cerrada");
        router.push("/login");
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-primary/10">
            <div className="container flex h-16 items-center px-4 justify-between">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-3 transition-all hover:opacity-80">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tight hidden sm:block">
                            Alquileres<span className="text-primary italic">Pro</span>
                        </h1>
                    </Link>

                    <nav className="hidden lg:flex items-center space-x-1 text-sm font-bold">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 group ${isActive
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "text-foreground/70 hover:text-primary hover:bg-primary/5"
                                        }`}
                                >
                                    <link.icon className={`h-4 w-4 transition-transform group-hover:scale-110`} />
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {format(new Date(), "EEEE, d MMM", { locale: es })}
                        </span>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="hidden sm:flex text-foreground/60 hover:text-destructive hover:bg-destructive/5 gap-2 items-center rounded-xl font-bold uppercase tracking-wider text-[10px]"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Salir</span>
                    </Button>

                    <div className="lg:hidden">
                        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="rounded-full bg-primary/5">
                            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden border-t bg-background/95 backdrop-blur-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <nav className="flex flex-col space-y-1">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center gap-4 text-sm font-bold transition-all p-4 rounded-2xl ${isActive
                                        ? "bg-primary text-primary-foreground shadow-md"
                                        : "text-foreground/70 hover:bg-primary/5"
                                        }`}
                                >
                                    <link.icon className="h-5 w-5" />
                                    {link.label}
                                </Link>
                            );
                        })}
                        <div className="pt-4 border-t border-primary/5 mt-2">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-4 text-sm font-bold text-destructive p-4 rounded-2xl hover:bg-destructive/5 w-full text-left"
                            >
                                <LogOut className="h-5 w-5" />
                                CERRAR SESIÓN
                            </button>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}