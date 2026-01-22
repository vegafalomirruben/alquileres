import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import Link from "next/link";
import { Home, Building2, CreditCard, LayoutDashboard, Settings } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gestión Alquileres Pro",
  description: "Gestión experta de alquileres vacacionales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-16 items-center">
                <div className="mr-8 flex items-center space-x-2">
                  <Home className="h-6 w-6 text-primary" />
                  <span className="text-xl font-bold">Alquileres Pro</span>
                </div>
                <nav className="flex items-center space-x-6 text-sm font-medium flex-1">
                  <Link href="/" className="transition-colors hover:text-primary">
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboards
                    </div>
                  </Link>
                  <Link href="/alquileres" className="transition-colors hover:text-primary">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Alquileres
                    </div>
                  </Link>
                  <Link href="/gastos" className="transition-colors hover:text-primary">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Gastos
                    </div>
                  </Link>
                  <Link href="/configuracion" className="transition-colors hover:text-primary">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configuración
                    </div>
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1 container py-8">
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
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
