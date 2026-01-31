"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, TrendingUp, BarChart3 } from "lucide-react";

export default function ChartsPage() {
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            const { data, error } = await supabase
                .from("alquileres")
                .select("fecha_entrada, precio_neto");

            if (data) {
                // Agrupar por año
                const grouped = data.reduce((acc: any, curr: any) => {
                    if (!curr.fecha_entrada) return acc;
                    const year = new Date(curr.fecha_entrada).getFullYear().toString();
                    if (!acc[year]) acc[year] = 0;
                    acc[year] += Number(curr.precio_neto) || 0;
                    return acc;
                }, {});

                // Convertir a array para el gráfico y ordenar por año
                const chartData = Object.entries(grouped)
                    .map(([year, total]) => ({ year, total }))
                    .sort((a, b) => a.year.localeCompare(b.year));

                setStats(chartData);
            }
            setLoading(false);
        }

        fetchStats();
    }, []);

    const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BarChart3 className="w-8 h-8 text-blue-600" />
                    Gráficos de Rendimiento
                </h1>
                <p className="text-muted-foreground">Visualización detallada de tus ingresos por año.</p>
            </div>

            <div className="grid gap-6">
                <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl">Ingreso Neto por Año</CardTitle>
                                <CardDescription>Comparativa anual de beneficios reales (después de comisiones)</CardDescription>
                            </div>
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-8 px-2 sm:px-6">
                        {loading ? (
                            <div className="h-[400px] flex items-center justify-center">
                                <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
                            </div>
                        ) : stats.length > 0 ? (
                            <div className="h-[400px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="year"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "#64748b", fontSize: 13, fontWeight: 500 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: "#64748b", fontSize: 12 }}
                                            tickFormatter={(value: number) => `${value.toLocaleString()}€`}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                padding: '12px'
                                            }}
                                            formatter={(value: any) => [`${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`, "Ingreso Neto"]}
                                            labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}
                                        />
                                        <Bar
                                            dataKey="total"
                                            radius={[6, 6, 0, 0]}
                                            barSize={60}
                                        >
                                            {stats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
                                <BarChart3 className="h-12 w-12 mb-2 opacity-20" />
                                <p>No hay datos suficientes para generar el gráfico</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
