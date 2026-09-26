"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isCheckin = pathname?.startsWith("/checkin");
    const isLogin = pathname === "/login";

    if (isCheckin || isLogin) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 container py-4 sm:py-8">
                {children}
            </main>
            <footer className="border-t py-6 bg-muted/50">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} Gestión Alquileres Pro. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
}
