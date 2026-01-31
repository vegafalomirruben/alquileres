"use client";

import { useState } from "react";
import Link from "next/link";
import { Home, Building2, CreditCard, LayoutDashboard, Settings, Calendar as CalendarIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navLinks = [
        { href: "/dashboard", label: "Dashboards", icon: LayoutDashboard },
        { href: "/alquileres", label: "Alquileres", icon: CreditCard },
        { href: "/proximos", label: "Próximos", icon: CalendarIcon },
        { href: "/gastos", label: "Gastos", icon: Building2 },
        { href: "/configuracion", label: "Configuración", icon: Settings },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 sm:h-16 items-center">
                <Link href="/" className="mr-8 flex items-center space-x-2 hover:opacity-80 transition-opacity">
                    <Home className="h-6 w-6 text-primary" />
                    <span className="text-xl font-bold">Alquileres Pro</span>
                </Link>
                <nav className="hidden md:flex items-center space-x-6 text-sm font-medium flex-1">
                    {navLinks.map((link) => (
                        <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
                            <div className="flex items-center gap-2">
                                <link.icon className="h-4 w-4" />
                                {link.label}
                            </div>
                        </Link>
                    ))}
                </nav>
                <div className="flex-1 flex justify-end md:hidden">
                    <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </Button>
                </div>
            </div>
            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden border-t bg-background p-4 space-y-4 animate-in slide-in-from-top-2">
                    <nav className="flex flex-col space-y-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-3 text-sm font-medium transition-colors hover:text-primary p-2 rounded-md hover:bg-muted"
                            >
                                <link.icon className="h-5 w-5 text-muted-foreground" />
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </header>
    );
}