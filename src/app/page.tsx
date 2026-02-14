"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Calendar, MapPin, ExternalLink, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformLogo } from "@/components/platform-logo";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function HomePage() {
  const [nextRentals, setNextRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNextRentals() {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('alquileres')
        .select(`
          id,
          fecha_entrada,
          fecha_salida,
          precio_neto,
          viviendas(nombre),
          plataformas(nombre)
        `)
        .gte('fecha_salida', today)
        .order('fecha_entrada', { ascending: true })
        .limit(5);

      if (data) {
        setNextRentals(data);
      }
      setLoading(false);
    }
    loadNextRentals();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Gestión Alquileres Pro
        </h1>
        <p className="text-muted-foreground">Tu resumen de un vistazo.</p>
      </div>

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
        <CardHeader className="flex flex-row items-center justify-between pb-6">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Próximos 5 Alquileres
            </CardTitle>
            <p className="text-sm text-muted-foreground">Reservas activas y próximas entradas previstas.</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-xs text-muted-foreground animate-pulse">Cargando reservas...</p>
              </div>
            </div>
          ) : nextRentals.length > 0 ? (
            <div className="rounded-xl border bg-background/50 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/40 transition-colors">
                    <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-bold">Fecha Estancia</TableHead>
                    <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-bold">Vivienda / Propiedad</TableHead>
                    <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-bold">Plataforma</TableHead>
                    <TableHead className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-right">Precio Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nextRentals.map((rental) => (
                    <TableRow key={rental.id} className="group hover:bg-primary/5 transition-all duration-300">
                      <TableCell className="py-4 px-6 font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm">{format(new Date(rental.fecha_entrada), "d 'de' MMMM", { locale: es })}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            hasta el {format(new Date(rental.fecha_salida), "d 'de' MMMM", { locale: es })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-sm">{rental.viviendas?.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <PlatformLogo
                            platform={rental.plataformas?.nombre?.toLowerCase().includes("airbnb") ? "airbnb" :
                              rental.plataformas?.nombre?.toLowerCase().includes("booking") ? "booking" : "manual"}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-medium">{rental.plataformas?.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {Number(rental.precio_neto).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-muted/20">
              <div className="max-w-[200px] mx-auto opacity-40">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">No se han encontrado alquileres próximos en el sistema.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a href="/proximos" className="group">
          <Card className="hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer bg-card/40 backdrop-blur relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Calendar className="h-24 w-24 -mr-8 -mt-8" />
            </div>
            <CardContent className="p-6 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-5">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transform group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <Calendar className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">Calendario de Reservas</h3>
                  <p className="text-xs text-muted-foreground">Gestiona disponibilidad y nuevas entradas.</p>
                </div>
              </div>
              <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </a>
        <a href="/dashboard" className="group">
          <Card className="hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer bg-card/40 backdrop-blur relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Activity className="h-24 w-24 -mr-8 -mt-8" />
            </div>
            <CardContent className="p-6 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-5">
                <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transform group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <Activity className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">Panel de Estadísticas</h3>
                  <p className="text-xs text-muted-foreground">Analiza ingresos, gastos y rentabilidad.</p>
                </div>
              </div>
              <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </a>
      </div>
    </div>
  );
}
