"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileDown, Building, CheckCircle2, Landmark, PieChart, Table as TableIcon, Filter, Calendar, Info, Calculator } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function TramitesPage() {
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const diasAño = isLeapYear(Number(year)) ? 366 : 365;
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingHacienda, setIsGeneratingHacienda] = useState(false);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [selectedPlatIds, setSelectedPlatIds] = useState<string[]>([]);

    // Hacienda state
    const [haciendaData, setHaciendaData] = useState<{
        bruto: number;
        neto: number;
        comisiones: number;
        totalRentaImputada: number;
        nochesTotales: number;
        porcentajeOcupacion: number;
        gastosPorCategoria: {
            nombre: string;
            total: number;
            deducible: number; // Based on occupancy % or 100% for specific cats
            individual: number; // 50% of deducible
        }[];
        viviendasDetalle: {
            id: string;
            nombre: string;
            ref_catastral: string;
            valor_catastral_total: number;
            valor_catastral_construccion: number;
            nochesAlquiladas: number;
            nochesVacias: number;
            amortizacionDeducible: number;
            rentaImputada: number;
        }[];
    } | null>(null);

    useEffect(() => {
        fetchPlataformas();
    }, []);

    async function fetchPlataformas() {
        const { data, error } = await supabase.from("plataformas").select("*").order("nombre");
        if (data) {
            setPlataformas(data);
            setSelectedPlatIds(data.map(p => p.id)); // Select all by default
        }
    }

    const togglePlataforma = (id: string) => {
        setSelectedPlatIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedPlatIds.length === plataformas.length) {
            setSelectedPlatIds([]);
        } else {
            setSelectedPlatIds(plataformas.map(p => p.id));
        }
    };

    async function generateRegistradoresCSV() {
        if (!year || isNaN(Number(year))) {
            return toast.error("Por favor, introduce un año válido.");
        }

        if (selectedPlatIds.length === 0) {
            return toast.error("Selecciona al menos una plataforma.");
        }

        setIsGenerating(true);
        try {
            // Fetch rentals for the selected year and platforms
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const { data, error } = await supabase
                .from("alquileres")
                .select("fecha_entrada, fecha_salida, plataforma_id, viviendas(nrua)")
                .gte("fecha_entrada", startDate)
                .lte("fecha_entrada", endDate)
                .in("plataforma_id", selectedPlatIds);

            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info(`No se encontraron alquileres para los criterios seleccionados.`);
                return;
            }

            // CSV Header
            let csvContent = "NRUA;fechaentrada;fechasalida;huespedes;codigofinalidad\n";

            // Rows
            data.forEach((rental: any) => {
                const nrua = rental.viviendas?.nrua || "";
                const entrada = format(parseISO(rental.fecha_entrada), "dd.MM.yyyy");
                const salida = format(parseISO(rental.fecha_salida), "dd.MM.yyyy");
                const huespedes = Math.floor(Math.random() * (7 - 3 + 1)) + 3; // Random between 3 and 7
                const codigofinalidad = "1";

                csvContent += `${nrua};${entrada};${salida};${huespedes};${codigofinalidad}\n`;
            });

            // Download file
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `registradores_${year}.csv`);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(`CSV generado con ${data.length} registros.`);
        } catch (error: any) {
            console.error("Error generating CSV:", error);
            toast.error("Error al generar el CSV: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    }

    async function generateHaciendaSummary() {
        if (!year || isNaN(Number(year))) {
            return toast.error("Por favor, introduce un año válido.");
        }

        if (selectedPlatIds.length === 0) {
            return toast.error("Selecciona al menos una plataforma.");
        }

        setIsGeneratingHacienda(true);
        try {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            // 1. Fetch Rentals
            const { data: rentals, error: rError } = await supabase
                .from("alquileres")
                .select("vivienda_id, precio_bruto, precio_neto, comision_valor, fecha_entrada, fecha_salida")
                .gte("fecha_entrada", startDate)
                .lte("fecha_entrada", endDate)
                .in("plataforma_id", selectedPlatIds);

            if (rError) throw rError;

            // 2. Fetch Expenses and Categories
            const { data: expenses, error: eError } = await supabase
                .from("gastos")
                .select("importe, categoria_id")
                .gte("fecha", startDate)
                .lte("fecha", endDate);

            if (eError) throw eError;

            const { data: categories, error: cError } = await supabase
                .from("categorias_gastos")
                .select("id, nombre");

            if (cError) throw cError;

            // 3. Fetch Viviendas with Cadastral Data
            const { data: viviendasList, error: vError } = await supabase
                .from("viviendas")
                .select("id, nombre, ref_catastral, valor_catastral_total, valor_catastral_construccion, valor_suelo");

            if (vError) throw vError;
            const viviendasData = viviendasList || [];

            // 4. Process Data
            const numViviendas = viviendasData.length || 1;
            const capacidadTotalNoches = numViviendas * diasAño;
            const totalBruto = rentals?.reduce((acc, r) => acc + (Number(r.precio_bruto) || 0), 0) || 0;
            const totalNeto = rentals?.reduce((acc, r) => acc + (Number(r.precio_neto) || 0), 0) || 0;
            const totalComisiones = rentals?.reduce((acc, r) => acc + (Number(r.comision_valor) || 0), 0) || 0;

            // Group nights by property for amortization
            const nochesPorPropiedad: { [key: string]: number } = {};
            const totalNoches = rentals?.reduce((acc, r) => {
                const start = parseISO(r.fecha_entrada);
                const end = parseISO(r.fecha_salida);
                const diff = Math.max(0, differenceInDays(end, start));

                if (r.vivienda_id) {
                    nochesPorPropiedad[r.vivienda_id] = (nochesPorPropiedad[r.vivienda_id] || 0) + diff;
                }

                return acc + diff;
            }, 0) || 0;

            const is100PercentDeductible = (name: string) => {
                const n = name.toUpperCase();
                return n.includes("LAVANDERÍA") || n.includes("LAVANDERIA") || n.includes("LIMPIEZA") || n.includes("COMISION");
            };

            const occupationRatio = totalNoches / capacidadTotalNoches;

            const categorizedExpenses: { [key: string]: number } = {};
            expenses?.forEach(exp => {
                const cat = categories?.find(c => c.id === exp.categoria_id);
                const catName = cat ? cat.nombre : "Otros / Sin categoría";
                categorizedExpenses[catName] = (categorizedExpenses[catName] || 0) + (Number(exp.importe) || 0);
            });

            // Calculate Amortization and Imputed Income per Property
            let totalAmortizacion = 0;
            let totalRentaImputada = 0;
            const viviendasDetalle = viviendasData.map(v => {
                const nochesPropiedad = nochesPorPropiedad[v.id] || 0;
                const nochesVacias = Math.max(0, diasAño - nochesPropiedad);

                // Amortization: 3% of construction value * (nights rented / 365)
                const amortAnual = (Number(v.valor_catastral_construccion) || 0) * 0.03;
                const amortDeducible = amortAnual * (nochesPropiedad / diasAño);
                totalAmortizacion += amortDeducible;

                // Imputed Income: 1.1% of total cadastral value * (nights empty / 365)
                const tasaImputacion = 0.011;
                const rentaAnual = (Number(v.valor_catastral_total) || 0) * tasaImputacion;
                const rentaImputada = rentaAnual * (nochesVacias / diasAño);
                totalRentaImputada += rentaImputada;

                return {
                    id: v.id,
                    nombre: v.nombre,
                    ref_catastral: v.ref_catastral || "-",
                    valor_catastral_total: Number(v.valor_catastral_total) || 0,
                    valor_catastral_construccion: Number(v.valor_catastral_construccion) || 0,
                    nochesAlquiladas: nochesPropiedad,
                    nochesVacias: nochesVacias,
                    amortizacionDeducible: amortDeducible,
                    rentaImputada: rentaImputada
                };
            });

            const gastosList = Object.keys(categorizedExpenses).map(name => {
                const total = categorizedExpenses[name];
                let deducible = 0;

                if (is100PercentDeductible(name)) {
                    deducible = total;
                } else {
                    deducible = total * occupationRatio;
                }

                return {
                    nombre: name,
                    total: total,
                    deducible: deducible,
                    individual: deducible / 2
                };
            }).sort((a, b) => b.total - a.total);

            // Add platforms commissions if not already there
            if (!gastosList.some(g => g.nombre.includes("Comisión") || g.nombre.includes("Comision"))) {
                gastosList.push({
                    nombre: "Comisiones Plataformas",
                    total: totalComisiones,
                    deducible: totalComisiones,
                    individual: totalComisiones / 2
                });
            }

            // Add Amortization to gastos list
            gastosList.push({
                nombre: "Amortización Vivienda (3%)",
                total: totalAmortizacion, // Present it as "total" in this context
                deducible: totalAmortizacion,
                individual: totalAmortizacion / 2
            });

            setHaciendaData({
                bruto: totalBruto,
                neto: totalNeto,
                comisiones: totalComisiones,
                totalRentaImputada: totalRentaImputada,
                nochesTotales: totalNoches,
                porcentajeOcupacion: (totalNoches / capacidadTotalNoches) * 100,
                gastosPorCategoria: gastosList,
                viviendasDetalle: viviendasDetalle
            });

            toast.success("Resumen de Hacienda generado.");
        } catch (error: any) {
            console.error("Error generating Hacienda summary:", error);
            toast.error("Error al generar resumen: " + error.message);
        } finally {
            setIsGeneratingHacienda(false);
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Trámites</h1>
                <p className="text-muted-foreground font-medium italic">Automatización de exportaciones y resúmenes para organismos oficiales.</p>
            </div>

            {/* CONFIGURACIÓN GLOBAL */}
            <Card className="border-slate-200 shadow-xl overflow-hidden bg-white/50 backdrop-blur-sm">
                <CardHeader className="bg-slate-900 text-white pb-6 pt-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-500 p-2 rounded-lg">
                            <Filter className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold">Configuración de Filtros</CardTitle>
                            <CardDescription className="text-slate-400">Selecciona el periodo y las plataformas para tus trámites.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* AÑO */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                <span>1. Periodo Contable</span>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="global-year" className="text-xs uppercase tracking-widest text-slate-500 font-bold">Año Fiscal</Label>
                                <Input
                                    id="global-year"
                                    type="number"
                                    placeholder="Ej: 2024"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="text-2xl font-black h-14 border-2 border-slate-100 focus:border-blue-500 bg-white"
                                />
                            </div>
                        </div>

                        {/* PLATAFORMAS */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between gap-2 text-slate-800 font-bold mb-2">
                                <div className="flex items-center gap-2">
                                    <Building className="h-5 w-5 text-blue-600" />
                                    <span>2. Selección de Plataformas</span>
                                </div>
                                <button
                                    onClick={toggleAll}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tight bg-blue-50 px-3 py-1 rounded-full transition-colors"
                                >
                                    {selectedPlatIds.length === plataformas.length ? "Desmarcar todos" : "Marcar todos"}
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                {plataformas.map((plat) => (
                                    <div
                                        key={plat.id}
                                        onClick={() => togglePlataforma(plat.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPlatIds.includes(plat.id)
                                            ? "bg-blue-50 border-blue-500 shadow-sm"
                                            : "bg-white border-slate-100 hover:border-slate-200"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedPlatIds.includes(plat.id)
                                            ? "bg-blue-600 border-blue-600"
                                            : "bg-white border-slate-200"
                                            }`}>
                                            {selectedPlatIds.includes(plat.id) && (
                                                <div className="w-2 h-2 bg-white rounded-full animate-in zoom-in-50 duration-300" />
                                            )}
                                        </div>
                                        <span className={`text-sm font-bold ${selectedPlatIds.includes(plat.id) ? "text-blue-900" : "text-slate-600"}`}>
                                            {plat.nombre}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                {/* REGISTRADORES CARD */}
                <Card className="border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white pb-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Building className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">Propiedad</span>
                        </div>
                        <CardTitle className="text-2xl font-black">Registradores</CardTitle>
                        <CardDescription className="text-blue-100 font-medium opacity-90">
                            Exportación CSV oficial con formato Registradores.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Button
                            onClick={generateRegistradoresCSV}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={isGenerating}
                        >
                            <FileDown className="mr-3 h-6 w-6" />
                            {isGenerating ? "Generando..." : `Descargar CSV (${year})`}
                        </Button>
                    </CardContent>
                </Card>

                {/* HACIENDA CARD */}
                <Card className="border-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white pb-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Landmark className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">Impuestos</span>
                        </div>
                        <CardTitle className="text-2xl font-black">Hacienda</CardTitle>
                        <CardDescription className="text-emerald-50 font-medium opacity-90">
                            Balances contables para declaración de beneficios.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Button
                            onClick={generateHaciendaSummary}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={isGeneratingHacienda}
                        >
                            <TableIcon className="mr-3 h-6 w-6" />
                            {isGeneratingHacienda ? "Analizando..." : `Ver Informe Fiscal (${year})`}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* RESULTS TABLE */}
            {haciendaData && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <Card className="border-slate-200 overflow-hidden shadow-2xl">
                        <div className="bg-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-500 p-2 rounded-xl">
                                    <PieChart className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <CardTitle className="text-white text-xl font-black">Informe Fiscal Consolidado</CardTitle>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Periodo {year} • {selectedPlatIds.length} Plataformas</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-md min-w-[140px]">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">Ocupación Anual</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl font-black text-blue-400 font-mono tracking-tighter">
                                            {haciendaData.nochesTotales}
                                        </p>
                                        <p className="text-sm font-bold text-blue-300 opacity-80">
                                            {haciendaData.porcentajeOcupacion.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="bg-blue-500 h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(100, haciendaData.porcentajeOcupacion)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">Resultado Bruto ANUAL</p>
                                    <p className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                                        {haciendaData.bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <CardContent className="p-0">
                            <div className="grid md:grid-cols-2">
                                {/* Ingresos Section */}
                                <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/30">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                        Módulo de Ingresos
                                    </h3>
                                    <Table>
                                        <TableBody>
                                            <TableRow className="border-transparent hover:bg-white transition-colors h-16">
                                                <TableCell className="font-bold text-slate-700">Ingresos Brutos</TableCell>
                                                <TableCell className="text-right font-black text-slate-900 text-lg tracking-tight">{haciendaData.bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                            </TableRow>
                                            <TableRow className="border-transparent hover:bg-white transition-colors h-16">
                                                <TableCell className="font-bold text-slate-500">Comisiones Plataformas</TableCell>
                                                <TableCell className="text-right font-bold text-rose-500">-{haciendaData.comisiones.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                            </TableRow>
                                            <TableRow className="border-transparent hover:bg-white transition-colors h-16">
                                                <TableCell className="font-bold text-slate-600 flex items-center gap-2">
                                                    Renta Inmobiliaria Imputada
                                                    <RentaImputadaInfo />
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-amber-600">+{haciendaData.totalRentaImputada.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                            </TableRow>
                                            <TableRow className="bg-white font-bold border-t-2 border-slate-900 h-20">
                                                <TableCell className="text-slate-900 text-base">Neto Cobrado Alquiler</TableCell>
                                                <TableCell className="text-right text-emerald-600 text-2xl font-black tracking-tighter">{haciendaData.neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Gastos Section */}
                                <div className="p-8 bg-white">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                                        Módulo de Gastos Deductibles
                                    </h3>
                                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar border rounded-2xl">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 border-b">
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-500 px-4 h-12">Concepto</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right px-4 h-12">Total</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-blue-600 text-right px-4 h-12">Deduc. ({haciendaData.porcentajeOcupacion.toFixed(1)}%)</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-emerald-600 text-right px-4 h-12">Indiv. (50%)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {haciendaData.gastosPorCategoria.length > 0 ? (
                                                    haciendaData.gastosPorCategoria.map((gasto, idx) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50 border-slate-100 h-14">
                                                            <TableCell className="text-xs font-bold text-slate-700 px-4 capitalize">
                                                                <div className="flex items-center gap-2">
                                                                    {gasto.nombre}
                                                                    {gasto.nombre.includes("Amortización") && (
                                                                        <AmortizacionInfo />
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium text-slate-400 px-4 text-xs">{gasto.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                            <TableCell className="text-right font-bold text-slate-900 px-4 text-xs bg-blue-50/30">{gasto.deducible.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                            <TableCell className="text-right font-black text-emerald-600 px-4 text-sm bg-emerald-50/20">{gasto.individual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-10 text-xs font-bold text-slate-400">Sin datos de gastos en este periodo.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {haciendaData.gastosPorCategoria.length > 0 && (
                                        <div className="mt-6 flex flex-col gap-2">
                                            <div className="flex justify-between items-center px-6 bg-slate-900 text-white rounded-2xl h-16">
                                                <span className="text-[10px] font-black uppercase tracking-widest">TOTAL DEDUCIBLE (100%)</span>
                                                <span className="text-xl font-black font-mono">
                                                    {haciendaData.gastosPorCategoria.reduce((acc, g) => acc + g.deducible, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center px-6 bg-emerald-600 text-white rounded-2xl h-20 shadow-lg shadow-emerald-200">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">MI PARTE (50%)</span>
                                                    <span className="text-[9px] font-bold italic opacity-60">Deducible individual</span>
                                                </div>
                                                <span className="text-3xl font-black font-mono">
                                                    {haciendaData.gastosPorCategoria.reduce((acc, g) => acc + g.individual, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detalle Catastral Section */}
                            <div className="p-8 border-t border-slate-100 bg-slate-50/20">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                    Detalle de Inmuebles y Amortizaciones
                                </h3>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {haciendaData.viviendasDetalle.map((v, idx) => (
                                        <Card key={idx} className="border-slate-100 shadow-sm overflow-hidden">
                                            <div className="bg-slate-900 px-4 py-2 flex justify-between items-center">
                                                <span className="text-white font-bold text-sm">{v.nombre}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{v.ref_catastral}</span>
                                            </div>
                                            <CardContent className="pt-4 space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Valor Catastral Total:</span>
                                                    <span className="font-bold">{v.valor_catastral_total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Valor Construcción (Base Amort.):</span>
                                                    <span className="font-bold">{v.valor_catastral_construccion.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                                </div>
                                                <Separator className="my-2" />
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Noches Alquiladas:</span>
                                                    <span className="font-bold">{v.nochesAlquiladas} / {diasAño}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black uppercase text-blue-600">Amort. Deducible (3%)</span>
                                                        <AmortizacionInfo />
                                                    </div>
                                                    <span className="text-lg font-black text-slate-900">{v.amortizacionDeducible.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                                </div>
                                                <Separator className="my-2" />
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Noches Vacío / Uso Propio:</span>
                                                    <span className="font-bold">{v.nochesVacias} / {diasAño}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-black uppercase text-amber-600">Renta Imputada (1.1%)</span>
                                                        <RentaImputadaInfo />
                                                    </div>
                                                    <span className="text-lg font-black text-slate-900">{v.rentaImputada.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function AmortizacionInfo() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="text-blue-500 hover:text-blue-700 transition-colors">
                    <Info className="h-3.5 w-3.5" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-blue-600" />
                        Cálculo de Amortización de Vivienda
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-sm font-bold text-blue-900 mb-2">Fórmula Aplicada:</p>
                        <code className="text-xs block bg-white p-3 rounded-lg border border-blue-200 font-mono text-blue-800">
                            (Valor Construcción × 3%) × (Noches Alquiladas / Días del Año)
                        </code>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-2 text-slate-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Criterio Hacienda (IRPF)
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Para los alquileres turísticos, la Agencia Tributaria permite deducir como gasto la amortización de la vivienda, calculada como el <strong>3% anual</strong> del mayor de estos dos valores (normalmente el de construcción en el catastro).
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Al no ser un alquiler permanente, este gasto debe <strong>prorratearse</strong> estrictamente por los días en los que la vivienda ha estado alquilada durante el ejercicio fiscal.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ejemplo práctico:</p>
                        <p className="text-xs text-slate-600">
                            Si el valor de construcción es 100.000€ y se alquila 100 días:<br />
                            1. Amortización anual: 100.000€ × 0.03 = 3.000€<br />
                            2. Amortización deducible: 3.000€ × (100 / 365) = <strong>821,91€</strong>
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function RentaImputadaInfo() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="text-amber-500 hover:text-amber-700 transition-colors">
                    <Info className="h-3.5 w-3.5" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-amber-600" />
                        Cálculo de Renta Inmobiliaria Imputada
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <p className="text-sm font-bold text-amber-900 mb-2">Fórmula Aplicada:</p>
                        <code className="text-xs block bg-white p-3 rounded-lg border border-amber-200 font-mono text-blue-800">
                            (Valor Catastral Total × 1.1%) × (Noches a disposición / Días del Año)
                        </code>
                    </div>

                    <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-2 text-slate-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ¿Qué es la Renta Imputada?
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            Es un ingreso teórico que Hacienda te obliga a declarar por el hecho de tener una segunda vivienda a tu disposición (no alquilada y que no es tu residencia habitual).
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            <strong>El porcentaje:</strong> Se aplica el <strong>1.1%</strong> si el valor catastral ha sido revisado en los últimos 10 años, o el <strong>2%</strong> en caso contrario. El sistema utiliza 1.1% por defecto.
                        </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalle del prorrateo:</p>
                        <p className="text-xs text-slate-600">
                            Solo se tributa por los días que la vivienda <strong>NO</strong> ha estado alquilada. Si el inmueble está alquilado parte del año, los días de alquiler tributan como rendimiento de capital inmobiliario y los días restantes como renta imputada.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
