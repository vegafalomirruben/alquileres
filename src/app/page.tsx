"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, TrendingUp, Wallet, ArrowDown } from "lucide-react";

export default function HomePage() {
  const [stats, setStats] = useState({
    totalNeto: 0,
    totalBruto: 0,
    totalGastos: 0,
    numAlquileres: 0
  });

  useEffect(() => {
    async function loadStats() {
      const { data: rentals } = await supabase.from('alquileres').select('precio_neto, precio_bruto');
      const { data: expenses } = await supabase.from('gastos').select('importe');

      const net = rentals?.reduce((acc, r) => acc + (Number(r.precio_neto) || 0), 0) || 0;
      const gross = rentals?.reduce((acc, r) => acc + (Number(r.precio_bruto) || 0), 0) || 0;
      const exp = expenses?.reduce((acc, e) => acc + (Number(e.importe) || 0), 0) || 0;

      setStats({
        totalNeto: net,
        totalBruto: gross,
        totalGastos: exp,
        numAlquileres: rentals?.length || 0
      });
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bienvenido a Gestión Alquileres Pro</h1>
        <p className="text-muted-foreground">Resumen general de tu actividad.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Netos</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalNeto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Brutos</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.totalGastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alquileres Registrados</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.numAlquileres}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Empieza a gestionar tu negocio</h2>
        <p className="text-muted-foreground mb-4">Configura tus viviendas y plataformas para empezar a registrar alquileres y gastos.</p>
      </div>
    </div>
  );
}
