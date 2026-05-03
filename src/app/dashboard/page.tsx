"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, Wallet, ArrowDown, LayoutDashboard, Filter, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { splitRentals } from "@/lib/rentalSplitter";

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function DashboardsPage() {
    const [rentals, setRentals] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [years, setYears] = useState<number[]>([]);
    const [selectedCell, setSelectedCell] = useState<{ mes: number, año: number, rentals: any[] } | null>(null);
    const [stats, setStats] = useState({
        totalNeto: 0,
        totalBruto: 0,
        totalGastos: 0,
        totalNoches: 0
    });
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string>("all");
    const [expandedDashboards, setExpandedDashboards] = useState<Record<string, boolean>>({});

    useEffect(() => {
        async function fetchData() {
            const { data: rentalsData } = await supabase.from("alquileres").select("*, viviendas(nombre), plataformas(nombre)");
            const { data: expensesData } = await supabase.from("gastos").select("*, viviendas(nombre)");
            const { data: viviendasData } = await supabase.from("viviendas").select("*");

            if (rentalsData) {
                const splitData = splitRentals(rentalsData);
                setRentals(splitData);
                if (expensesData) setExpenses(expensesData);
                if (viviendasData) setViviendas(viviendasData);

                const rentalsYears = splitData.map(r => getYear(parseISO(r.fecha_entrada)));
                const expensesYears = (expensesData || []).map(e => getYear(parseISO(e.fecha)));
                const uniqueYears = Array.from(new Set([...rentalsYears, ...expensesYears])).sort((a, b) => b - a);
                setYears(uniqueYears.length > 0 ? uniqueYears : [new Date().getFullYear()]);
            }
        }
        fetchData();
    }, []);

    // Derived filtered data
    const filteredRentalsData = selectedProperty === "all"
        ? rentals
        : rentals.filter(r => r.vivienda_id === selectedProperty);

    const filteredExpensesData = selectedProperty === "all"
        ? expenses
        : expenses.filter(e => e.vivienda_id === selectedProperty || !e.vivienda_id);

    useEffect(() => {
        const net = filteredRentalsData.reduce((acc, r) => acc + (Number(r.precio_neto) || 0), 0);
        const gross = filteredRentalsData.reduce((acc, r) => acc + (Number(r.precio_bruto) || 0), 0);
        const nights = filteredRentalsData.reduce((acc, r) => acc + (Number(r.noches) || 0), 0);
        const exp = filteredExpensesData.reduce((acc, e) => acc + (Number(e.importe) || 0), 0);

        setStats({
            totalNeto: net,
            totalBruto: gross,
            totalGastos: exp,
            totalNoches: nights
        });
    }, [filteredRentalsData, filteredExpensesData]);

    const getMatrixData = (metric: "neto" | "bruto" | "adr" | "real" | "gastos" | "noches") => {
        const matrix: any = {};
        const colTotals: any = {};
        const rowTotals: any = Array(12).fill(0);

        years.forEach(year => colTotals[year] = 0);
        let grandTotal = 0;

        years.forEach(year => {
            matrix[year] = Array(12).fill(0);
            const yearRentals = filteredRentalsData.filter(r => getYear(parseISO(r.fecha_entrada)) === year);
            const yearExpenses = filteredExpensesData.filter(e => getYear(parseISO(e.fecha)) === year);

            for (let month = 0; month < 12; month++) {
                const monthRentals = yearRentals.filter(r => getMonth(parseISO(r.fecha_entrada)) === month);
                const monthExpenses = yearExpenses.filter(e => getMonth(parseISO(e.fecha)) === month);

                let val = 0;

                if (metric === "adr") {
                    const sumAdr = monthRentals.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
                    val = monthRentals.length > 0 ? sumAdr / monthRentals.length : 0;
                } else if (metric === "neto") {
                    val = monthRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                } else if (metric === "gastos") {
                    val = monthExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
                } else if (metric === "real") {
                    const net = monthRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                    const exp = monthExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
                    val = net - exp;
                } else if (metric === "noches") {
                    val = monthRentals.reduce((acc, r) => acc + Number(r.noches), 0);
                } else {
                    val = monthRentals.reduce((acc, r) => acc + Number(r.precio_bruto), 0);
                }

                matrix[year][month] = val;
            }
        });

        for (let month = 0; month < 12; month++) {
            const monthRentalsAllYears = filteredRentalsData.filter(r => getMonth(parseISO(r.fecha_entrada)) === month && years.includes(getYear(parseISO(r.fecha_entrada))));
            const monthExpensesAllYears = filteredExpensesData.filter(e => getMonth(parseISO(e.fecha)) === month && years.includes(getYear(parseISO(e.fecha))));

            if (metric === "adr") {
                const sum = monthRentalsAllYears.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
                rowTotals[month] = monthRentalsAllYears.length > 0 ? sum / monthRentalsAllYears.length : 0;
            } else if (metric === "gastos") {
                rowTotals[month] = monthExpensesAllYears.reduce((acc, e) => acc + Number(e.importe), 0);
            } else if (metric === "real") {
                const net = monthRentalsAllYears.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                const exp = monthExpensesAllYears.reduce((acc, e) => acc + Number(e.importe), 0);
                rowTotals[month] = net - exp;
            } else if (metric === "noches") {
                rowTotals[month] = monthRentalsAllYears.reduce((acc, r) => acc + Number(r.noches), 0);
            } else {
                rowTotals[month] = monthRentalsAllYears.reduce((acc, r) => acc + Number(metric === "neto" ? r.precio_neto : r.precio_bruto), 0);
            }
        }

        years.forEach(year => {
            const yearRentals = filteredRentalsData.filter(r => getYear(parseISO(r.fecha_entrada)) === year);
            const yearExpenses = filteredExpensesData.filter(e => getYear(parseISO(e.fecha)) === year);

            if (metric === "adr") {
                const sum = yearRentals.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
                colTotals[year] = yearRentals.length > 0 ? sum / yearRentals.length : 0;
            } else if (metric === "gastos") {
                colTotals[year] = yearExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
            } else if (metric === "real") {
                const net = yearRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                const exp = yearExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
                colTotals[year] = net - exp;
            } else if (metric === "noches") {
                colTotals[year] = yearRentals.reduce((acc, r) => acc + Number(r.noches), 0);
            } else {
                colTotals[year] = yearRentals.reduce((acc, r) => acc + Number(metric === "neto" ? r.precio_neto : r.precio_bruto), 0);
            }
        });

        const relevantRentals = filteredRentalsData.filter(r => years.includes(getYear(parseISO(r.fecha_entrada))));
        const relevantExpenses = filteredExpensesData.filter(e => years.includes(getYear(parseISO(e.fecha))));

        if (metric === "adr") {
            const sum = relevantRentals.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
            grandTotal = relevantRentals.length > 0 ? sum / relevantRentals.length : 0;
        } else if (metric === "gastos") {
            grandTotal = relevantExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
        } else if (metric === "real") {
            const net = relevantRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
            const exp = relevantExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
            grandTotal = net - exp;
        } else if (metric === "noches") {
            grandTotal = relevantRentals.reduce((acc, r) => acc + Number(r.noches), 0);
        } else {
            grandTotal = relevantRentals.reduce((acc, r) => acc + Number(metric === "neto" ? r.precio_neto : r.precio_bruto), 0);
        }

        return { matrix, colTotals, rowTotals, grandTotal };
    };

    const handleCellClick = (mes: number, año: number) => {
        const filtered = filteredRentalsData.filter(r =>
            getMonth(parseISO(r.fecha_entrada)) === mes &&
            getYear(parseISO(r.fecha_entrada)) === año
        );
        setSelectedCell({ mes, año, rentals: filtered });
    };

    const renderMatrixTable = (dataBundle: any, isCurrency: boolean = true) => {
        const { matrix, colTotals, rowTotals, grandTotal } = dataBundle;
        return (
            <div className="overflow-x-auto rounded-xl">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b-0 hover:bg-transparent">
                            <TableHead className="w-32 font-bold text-xs uppercase tracking-widest text-muted-foreground bg-primary/5">Mes / Año</TableHead>
                            {years.map(year => <TableHead key={year} className="text-center font-bold text-xs uppercase tracking-widest text-muted-foreground bg-primary/5">{year}</TableHead>)}
                            <TableHead className="text-center font-bold text-xs uppercase tracking-widest text-primary bg-primary/10">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {MESES.map((mes, idx) => (
                            <TableRow key={mes} className="group hover:bg-primary/5 transition-colors">
                                <TableCell className="font-bold text-sm bg-primary/5 group-hover:bg-primary/10 transition-colors uppercase tracking-tight">{mes}</TableCell>
                                {years.map(year => (
                                    <TableCell
                                        key={`${year}-${idx}`}
                                        className="text-center cursor-pointer hover:bg-primary/10 transition-all font-medium text-sm"
                                        onClick={() => handleCellClick(idx, year)}
                                    >
                                        {isCurrency
                                            ? (matrix[year][idx] > 0 ? `${matrix[year][idx].toLocaleString('es-ES', { minimumFractionDigits: 0 })}€` : "-")
                                            : (matrix[year][idx] > 0 ? matrix[year][idx].toFixed(1) : "-")
                                        }
                                    </TableCell>
                                ))}
                                <TableCell className="text-center font-extrabold text-sm bg-primary/10 text-primary">
                                    {isCurrency
                                        ? (rowTotals[idx] > 0 ? `${rowTotals[idx].toLocaleString('es-ES', { minimumFractionDigits: 0 })}€` : "-")
                                        : (rowTotals[idx] > 0 ? rowTotals[idx].toFixed(1) : "-")
                                    }
                                </TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-primary/10 hover:bg-primary/20 transition-colors">
                            <TableCell className="font-extrabold text-sm uppercase tracking-tight text-primary">Total Anual</TableCell>
                            {years.map(year => (
                                <TableCell
                                    key={`total-${year}`}
                                    className="text-center font-extrabold text-sm text-primary"
                                >
                                    {isCurrency
                                        ? (colTotals[year] !== 0 ? `${colTotals[year].toLocaleString('es-ES', { minimumFractionDigits: 0 })}€` : "-")
                                        : (colTotals[year] !== 0 ? colTotals[year].toFixed(1) : "-")
                                    }
                                </TableCell>
                            ))}
                            <TableCell className="text-center font-black text-sm text-primary">
                                {isCurrency
                                    ? (grandTotal !== 0 ? `${grandTotal.toLocaleString('es-ES', { minimumFractionDigits: 0 })}€` : "-")
                                    : (grandTotal !== 0 ? grandTotal.toFixed(1) : "-")
                                }
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        );
    };

    const dashboardItems: { title: string; metric: "neto" | "bruto" | "adr" | "real" | "gastos" | "noches"; isCurrency: boolean; icon: any }[] = [
        { title: "Beneficio Real", metric: "real", isCurrency: true, icon: TrendingUp },
        { title: "Gasto Operativo", metric: "gastos", isCurrency: true, icon: ArrowDown },
        { title: "Ingreso Neto", metric: "neto", isCurrency: true, icon: Wallet },
        { title: "Precio Medio (ADR)", metric: "adr", isCurrency: true, icon: LayoutDashboard },
        { title: "Días Alquilados", metric: "noches", isCurrency: false, icon: Calendar },
    ];

    const toggleDashboard = (title: string) => {
        setExpandedDashboards(prev => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pb-2">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold tracking-tight">Rendimiento</h1>
                    <p className="text-muted-foreground font-medium">Panel de control y análisis de rentabilidad.</p>
                </div>
                <div className="flex items-center gap-3 bg-card p-1.5 rounded-2xl border border-primary/10 shadow-sm w-full sm:w-72">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <Filter className="h-4 w-4" />
                    </div>
                    <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                        <SelectTrigger className="border-0 bg-transparent focus:ring-0 font-bold text-sm">
                            <SelectValue placeholder="Todas las unidades" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            <SelectItem value="all">Todas las unidades</SelectItem>
                            {viviendas.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="rounded-3xl border-none shadow-xl shadow-primary/5 bg-primary text-white overflow-hidden relative group transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform">
                        <TrendingUp className="h-32 w-32" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-white/70">Ingreso Real</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tighter">
                            {(stats.totalNeto - stats.totalGastos).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs mt-1 font-bold text-white/60">NETO - GASTOS</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl shadow-black/5 bg-card overflow-hidden relative group transition-transform hover:scale-[1.02]">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gastos</CardTitle>
                            <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500">
                                <ArrowDown className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tighter text-rose-500">
                            {stats.totalGastos.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs mt-1 font-bold text-green-500">DEDUCIBLE</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl shadow-black/5 bg-card overflow-hidden relative group transition-transform hover:scale-[1.02]">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ocupación</CardTitle>
                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                <LayoutDashboard className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tighter">
                            {stats.totalNoches} <span className="text-sm text-muted-foreground">Noches</span>
                        </div>
                        <p className="text-xs mt-1 font-bold text-muted-foreground">TOTAL ACUMULADO</p>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl shadow-black/5 bg-card overflow-hidden relative group transition-transform hover:scale-[1.02]">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Neto</CardTitle>
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Wallet className="h-4 w-4" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold tracking-tighter">
                            {stats.totalNeto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs mt-1 font-bold text-primary">POST COMISIONES</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2 px-1">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Matrices de Detalle</h3>
                </div>
                {dashboardItems.map(({ title, metric, isCurrency, icon: Icon }) => (
                    <Card key={title} className="rounded-3xl border-primary/5 shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
                        <CardHeader
                            className="cursor-pointer hover:bg-primary/5 flex flex-row items-center justify-between p-6 transition-all"
                            onClick={() => toggleDashboard(title)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-base font-bold tracking-tight uppercase">{title}</CardTitle>
                            </div>
                            {expandedDashboards[title] ? (
                                <ChevronUp className="h-5 w-5 text-primary shrink-0" />
                            ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                        </CardHeader>
                        {expandedDashboards[title] && (
                            <CardContent className="p-0 border-t border-primary/5">
                                {renderMatrixTable(getMatrixData(metric), isCurrency)}
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>

            <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
                <DialogContent className="w-[95vw] max-w-5xl rounded-3xl border-none p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="p-8 bg-primary text-white">
                        <DialogTitle className="text-2xl font-extrabold tracking-tight">
                            Detalle: {MESES[selectedCell?.mes || 0]} {selectedCell?.año}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6 overflow-y-auto max-h-[70vh]">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-primary/10">
                                    <TableHead className="font-bold uppercase text-[10px] tracking-widest">Unidad</TableHead>
                                    <TableHead className="font-bold uppercase text-[10px] tracking-widest">Canal</TableHead>
                                    <TableHead className="font-bold uppercase text-[10px] tracking-widest">Estancia</TableHead>
                                    <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest">Noches</TableHead>
                                    <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest">Neto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedCell?.rentals.map((r, i) => (
                                    <TableRow key={i} className="hover:bg-primary/5 border-primary/5">
                                        <TableCell className="font-bold">{r.viviendas?.nombre}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <PlatformLogo platform={r.plataformas?.nombre} className="h-4 w-4" />
                                                <span className="text-xs font-medium">{r.plataformas?.nombre}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground font-medium">
                                            {format(parseISO(r.fecha_entrada), "dd MMM")} - {r.fecha_salida ? format(parseISO(r.fecha_salida), "dd MMM") : "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {r.noches != null ? Number(r.noches) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-extrabold text-primary">{Number(r.precio_neto).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                    </TableRow>
                                ))}
                                {selectedCell?.rentals.length === 0 && (
                                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No se encontraron registros para este periodo.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
