"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { Loader2, TrendingUp, BarChart3, Filter, Settings2, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Helper for multi-select pills
const MultiToggle = ({ options, selected, onToggle, onSelectAll, onDeselectAll, label, icon: Icon }: any) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {Icon && <Icon className="w-3 h-3" />} {label}
            </Label>
            {options.length > 1 && (
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onSelectAll}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-tight"
                    >
                        Todo
                    </button>
                    <button
                        type="button"
                        onClick={onDeselectAll}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-tight"
                    >
                        Nada
                    </button>
                </div>
            )}
        </div>
        <div className="flex flex-wrap gap-2">
            {options.map((opt: any) => {
                const isSelected = selected.includes(opt.id);
                return (
                    <button
                        key={opt.id}
                        type="button"
                        onClick={() => onToggle(opt.id)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5",
                            isSelected
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:border-blue-400"
                        )}
                    >
                        {isSelected && <Check className="w-3 h-3" />}
                        {opt.name}
                    </button>
                );
            })}
        </div>
    </div>
);

export default function ChartsPage() {
    const [rentals, setRentals] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // States with Multi-selection
    const [groupBy, setGroupBy] = useState("month");
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["precio_neto"]);
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [selectedViviendaIds, setSelectedViviendaIds] = useState<string[]>([]);
    const [selectedPlataformaIds, setSelectedPlataformaIds] = useState<string[]>([]);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const [
                { data: rData },
                { data: eData },
                { data: vData },
                { data: pData }
            ] = await Promise.all([
                supabase.from("alquileres").select("*, viviendas(nombre), plataformas(nombre)"),
                supabase.from("gastos").select("*"),
                supabase.from("viviendas").select("*"),
                supabase.from("plataformas").select("*")
            ]);

            if (rData) {
                setRentals(rData);
                // Initialize years
                const years = Array.from(new Set(rData.map(r => r.fecha_entrada ? new Date(r.fecha_entrada).getFullYear().toString() : null).filter(Boolean)));
                setSelectedYears(years as string[]);
            }
            if (eData) setExpenses(eData);
            if (vData) {
                setViviendas(vData);
                setSelectedViviendaIds(vData.map(v => v.id));
            }
            if (pData) {
                setPlataformas(pData);
                setSelectedPlataformaIds(pData.map(p => p.id));
            }
            setLoading(false);
        }
        fetchData();
    }, []);

    const availableYears = useMemo(() => {
        const years = rentals
            .map(r => r.fecha_entrada ? new Date(r.fecha_entrada).getFullYear().toString() : null)
            .filter((y): y is string => y !== null);
        return Array.from(new Set(years)).sort().reverse().map(y => ({ id: y, name: y }));
    }, [rentals]);

    const metricsOptions = [
        { id: "precio_neto", name: "Ingreso Neto", color: "#2563eb" },
        { id: "precio_bruto", name: "Ingreso Bruto", color: "#10b981" },
        { id: "comision_valor", name: "Comisión", color: "#f59e0b" },
        { id: "importe_gastos", name: "Gastos", color: "#ef4444" },
        { id: "beneficio_real", name: "Beneficio Real", color: "#065f46" },
        { id: "noches", name: "Noches", color: "#8b5cf6" },
        { id: "precio_medio_diario", name: "Precio Diario", color: "#ec4899" }
    ];

    const chartData = useMemo(() => {
        const grouped: any = {};

        // Process Rentals
        rentals.forEach(curr => {
            const year = curr.fecha_entrada ? new Date(curr.fecha_entrada).getFullYear().toString() : null;
            if (!selectedYears.includes(year!) || !selectedViviendaIds.includes(curr.vivienda_id) || !selectedPlataformaIds.includes(curr.plataforma_id)) return;

            let key = "Desconocido";
            let sortVal = curr.fecha_entrada || "";

            if (groupBy === "year") key = year || "Sin fecha";
            else if (groupBy === "month") {
                if (curr.fecha_entrada) {
                    const date = parseISO(curr.fecha_entrada);
                    key = format(date, "MMM yy", { locale: es });
                    key = key.charAt(0).toUpperCase() + key.slice(1);
                }
            } else if (groupBy === "platform") key = curr.plataformas?.nombre || "Sin plataforma";
            else if (groupBy === "property") key = curr.viviendas?.nombre || "Sin vivienda";

            if (!grouped[key]) {
                grouped[key] = { label: key, sortKey: sortVal };
                metricsOptions.forEach(m => grouped[key][m.id] = 0);
            }
            grouped[key].precio_neto += Number(curr.precio_neto) || 0;
            grouped[key].precio_bruto += Number(curr.precio_bruto) || 0;
            grouped[key].comision_valor += Number(curr.comision_valor) || 0;
            grouped[key].noches += Number(curr.noches) || 0;
            grouped[key].precio_medio_diario += Number(curr.precio_medio_diario) || 0;
        });

        // Process Expenses
        expenses.forEach(curr => {
            const year = curr.fecha ? new Date(curr.fecha).getFullYear().toString() : null;
            if (!selectedYears.includes(year!) || !selectedViviendaIds.includes(curr.vivienda_id)) return;

            let key = "Desconocido";
            let sortVal = curr.fecha || "";

            if (groupBy === "year") key = year || "Sin fecha";
            else if (groupBy === "month") {
                if (curr.fecha) {
                    const date = parseISO(curr.fecha);
                    key = format(date, "MMM yy", { locale: es });
                    key = key.charAt(0).toUpperCase() + key.slice(1);
                }
            } else if (groupBy === "platform") key = "Gastos";
            else if (groupBy === "property") {
                const viv = viviendas.find(v => v.id === curr.vivienda_id);
                key = viv?.nombre || "Sin vivienda";
            }

            if (!grouped[key]) {
                grouped[key] = { label: key, sortKey: sortVal };
                metricsOptions.forEach(m => grouped[key][m.id] = 0);
            }
            grouped[key].importe_gastos += Number(curr.importe) || 0;
        });

        const result = Object.values(grouped).map((item: any) => {
            item.beneficio_real = item.precio_neto - item.importe_gastos;
            return item;
        });

        if (groupBy === "month" || groupBy === "year") {
            result.sort((a: any, b: any) => a.sortKey.localeCompare(b.sortKey));
        } else {
            const firstMetric = selectedMetrics[0] || "precio_neto";
            result.sort((a: any, b: any) => b[firstMetric] - a[firstMetric]);
        }
        return result;
    }, [rentals, expenses, viviendas, plataformas, groupBy, selectedMetrics, selectedYears, selectedViviendaIds, selectedPlataformaIds]);

    const handleToggle = (id: string, state: string[], setState: any) => {
        if (state.includes(id)) {
            if (state.length > 1) setState(state.filter(item => item !== id));
        } else {
            setState([...state, id]);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <BarChart3 className="w-8 h-8 text-blue-600" />
                    Análisis Comparativo
                </h1>
                <p className="text-muted-foreground">Selecciona múltiples variables para comparar rendimientos.</p>
            </div>

            {/* Multifilter Panel */}
            <Card className="border-none shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="bg-slate-50 border-b px-6 py-3">
                    <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Settings2 className="w-4 h-4" /> Configuración del Gráfico
                    </h3>
                </div>
                <CardContent className="p-6 space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <MultiToggle
                                label="Métricas a comparar"
                                icon={TrendingUp}
                                options={metricsOptions}
                                selected={selectedMetrics}
                                onToggle={(id: string) => handleToggle(id, selectedMetrics, setSelectedMetrics)}
                                onSelectAll={() => setSelectedMetrics(metricsOptions.map(m => m.id))}
                                onDeselectAll={() => setSelectedMetrics([metricsOptions[0].id])}
                            />

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    <BarChart3 className="w-3 h-3" /> Eje Temporal / Agrupación
                                </Label>
                                <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                                    {[
                                        { id: "year", name: "Anual" },
                                        { id: "month", name: "Mensual" },
                                        { id: "platform", name: "Plataformas" },
                                        { id: "property", name: "Viviendas" }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setGroupBy(opt.id)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                                                groupBy === opt.id ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            {opt.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 border-t lg:border-t-0 lg:border-l lg:pl-8 pt-6 lg:pt-0">
                            <MultiToggle
                                label="Filtrar por Años"
                                icon={Filter}
                                options={availableYears}
                                selected={selectedYears}
                                onToggle={(id: string) => handleToggle(id, selectedYears, setSelectedYears)}
                                onSelectAll={() => setSelectedYears(availableYears.map(y => y.id))}
                                onDeselectAll={() => setSelectedYears([])}
                            />
                            <MultiToggle
                                label="Viviendas"
                                icon={Filter}
                                options={viviendas.map(v => ({ id: v.id, name: v.nombre }))}
                                selected={selectedViviendaIds}
                                onToggle={(id: string) => handleToggle(id, selectedViviendaIds, setSelectedViviendaIds)}
                                onSelectAll={() => setSelectedViviendaIds(viviendas.map(v => v.id))}
                                onDeselectAll={() => setSelectedViviendaIds([])}
                            />
                            <MultiToggle
                                label="Plataformas"
                                icon={Filter}
                                options={plataformas.map(p => ({ id: p.id, name: p.nombre }))}
                                selected={selectedPlataformaIds}
                                onToggle={(id: string) => handleToggle(id, selectedPlataformaIds, setSelectedPlataformaIds)}
                                onSelectAll={() => setSelectedPlataformaIds(plataformas.map(p => p.id))}
                                onDeselectAll={() => setSelectedPlataformaIds([])}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Chart Container */}
            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md">
                <CardContent className="pt-10 px-2 sm:px-6">
                    {loading ? (
                        <div className="h-[500px] flex items-center justify-center">
                            <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
                        </div>
                    ) : chartData.length > 0 ? (
                        <div className="h-[500px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="label"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#64748b", fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: "#64748b", fontSize: 12 }}
                                        tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k€` : `${val}€`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(val: any) => [
                                            typeof val === 'number'
                                                ? `${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`
                                                : val,
                                            ""
                                        ]}
                                    />
                                    <Legend verticalAlign="top" height={40} />
                                    {selectedMetrics.map((mId, index) => {
                                        const opt = metricsOptions.find(o => o.id === mId);
                                        return (
                                            <Bar
                                                key={mId}
                                                name={opt?.name}
                                                dataKey={mId}
                                                fill={opt?.color}
                                                radius={[4, 4, 0, 0]}
                                                barSize={selectedMetrics.length > 2 ? 15 : 30}
                                            />
                                        );
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[500px] flex flex-col items-center justify-center text-slate-400">
                            <BarChart3 className="h-12 w-12 mb-2 opacity-20" />
                            <p>No hay datos suficientes para tu selección</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
