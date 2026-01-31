"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Building2, CreditCard, LayoutDashboard, Settings, Calendar as CalendarIcon, Menu, X, Users, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    if (pathname === "/login") return null;

    const navLinks = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/alquileres", label: "Alquileres", icon: CreditCard },
        { href: "/proximos", label: "Calendario", icon: CalendarIcon },
        { href: "/gastos", label: "Gastos", icon: Building2 },
        { href: "/usuarios", label: "Usuarios", icon: Users },
        { href: "/configuracion", label: "Ajustes", icon: Settings },
    ];

    const handleLogout = () => {
        localStorage.removeItem("user_session");
        toast.info("Sesión cerrada");
        router.push("/login");
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
            <div className="container flex h-16 items-center px-4">
                <Link href="/" className="mr-8 flex items-center space-x-2 transition-all hover:scale-105">
                    <div className="bg-blue-600 p-1.5 rounded-lg">
                        <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Alquileres Pro
                    </span>
                </Link>

                <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium flex-1">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 group ${isActive
                                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                                        : "text-slate-600 hover:text-blue-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                            >
                                <link.icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-blue-600"}`} />
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="hidden sm:flex text-slate-500 hover:text-rose-600 hover:bg-rose-50 gap-2 items-center"
                    >
                        <LogOut className="h-4 w-4" />
                        <span>Salir</span>
                    </Button>

                    <div className="lg:hidden">
                        <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden border-t bg-white dark:bg-slate-950 p-4 space-y-4 animate-in slide-in-from-top-2">
                    <nav className="flex flex-col space-y-2">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center gap-3 text-sm font-medium transition-all p-3 rounded-xl ${isActive
                                            ? "bg-blue-50 text-blue-600 border-l-4 border-blue-600"
                                            : "text-slate-600 hover:bg-slate-100"
                                        }`}
                                >
                                    <link.icon className="h-5 w-5" />
                                    {link.label}
                                </Link>
                            );
                        })}
                        <hr className="my-2 border-slate-100" />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 text-sm font-medium text-rose-600 p-3 rounded-xl hover:bg-rose-50 w-full text-left"
                        >
                            <LogOut className="h-5 w-5" />
                            Cerrar Sesión
                        </button>
                    </nav>
                </div>
            )}
        </header>
    );
}