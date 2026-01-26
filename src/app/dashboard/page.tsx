"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { TrendingUp, Wallet, ArrowDown, LayoutDashboard, Filter } from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

    useEffect(() => {
        async function fetchData() {
            const { data: rentalsData } = await supabase.from("alquileres").select("*, viviendas(nombre), plataformas(nombre)");
            const { data: expensesData } = await supabase.from("gastos").select("*, viviendas(nombre)");
            const { data: viviendasData } = await supabase.from("viviendas").select("*");

            if (rentalsData) {
                setRentals(rentalsData);
                if (expensesData) setExpenses(expensesData);
                if (viviendasData) setViviendas(viviendasData);

                const rentalsYears = rentalsData.map(r => getYear(parseISO(r.fecha_entrada)));
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
        : expenses.filter(e => e.vivienda_id === selectedProperty || !e.vivienda_id); // Show general expenses even in property view? User might prefer only property-specific. Let's stick to property-specific + null (general) if property is all.

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

    const getMatrixData = (metric: "neto" | "bruto" | "adr" | "real" | "gastos") => {
        const matrix: any = {};
        const colTotals: any = {}; // Totals per year
        const rowTotals: any = Array(12).fill(0); // Totals per month

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
                } else {
                    val = monthRentals.reduce((acc, r) => acc + Number(r.precio_bruto), 0);
                }

                matrix[year][month] = val;
            }
        });

        // Calculate Totals Correctly
        // Row Totals (Month across years)
        for (let month = 0; month < 12; month++) {
            const monthRentalsAllYears = filteredRentalsData.filter(r => getMonth(parseISO(r.fecha_entrada)) === month && years.includes(getYear(parseISO(r.fecha_entrada))));
            const monthExpensesAllYears = filteredExpensesData.filter(e => getMonth(parseISO(e.fecha)) === month && years.includes(getYear(parseISO(e.fecha))));

            if (metric === "adr") {
                const sum = monthRentalsAllYears.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
                rowTotals[month] = monthRentalsAllYears.length > 0 ? sum / monthRentalsAllYears.length : 0;
            } else if (metric === "gastos") {
                const exp = monthExpensesAllYears.reduce((acc, e) => acc + Number(e.importe), 0);
                rowTotals[month] = exp;
            } else if (metric === "real") {
                const net = monthRentalsAllYears.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                const exp = monthExpensesAllYears.reduce((acc, e) => acc + Number(e.importe), 0);
                rowTotals[month] = net - exp;
            } else {
                const sum = monthRentalsAllYears.reduce((acc, r) => acc + Number(metric === "neto" ? r.precio_neto : r.precio_bruto), 0);
                rowTotals[month] = sum;
            }
        }

        // Column Totals (Year totals)
        years.forEach(year => {
            const yearRentals = filteredRentalsData.filter(r => getYear(parseISO(r.fecha_entrada)) === year);
            const yearExpenses = filteredExpensesData.filter(e => getYear(parseISO(e.fecha)) === year);

            if (metric === "adr") {
                const sum = yearRentals.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
                colTotals[year] = yearRentals.length > 0 ? sum / yearRentals.length : 0;
            } else if (metric === "gastos") {
                const exp = yearExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
                colTotals[year] = exp;
            } else if (metric === "real") {
                const net = yearRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                const exp = yearExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
                colTotals[year] = net - exp;
            } else {
                const sum = yearRentals.reduce((acc, r) => acc + Number(metric === "neto" ? r.precio_neto : r.precio_bruto), 0);
                colTotals[year] = sum;
            }
        });

        // Grand Total (Bottom Right)
        const relevantRentals = filteredRentalsData.filter(r => years.includes(getYear(parseISO(r.fecha_entrada))));
        const relevantExpenses = filteredExpensesData.filter(e => years.includes(getYear(parseISO(e.fecha))));

        if (metric === "adr") {
            const sum = relevantRentals.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
            grandTotal = relevantRentals.length > 0 ? sum / relevantRentals.length : 0;
        } else if (metric === "gastos") {
            const exp = relevantExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
            grandTotal = exp;
        } else if (metric === "real") {
            const net = relevantRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
            const exp = relevantExpenses.reduce((acc, e) => acc + Number(e.importe), 0);
            grandTotal = net - exp;
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

    const renderMatrix = (title: string, dataBundle: any, isCurrency: boolean = true) => {
        const { matrix, colTotals, rowTotals, grandTotal } = dataBundle;
        return (
            <Card className="overflow-hidden">
                <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="bg-muted w-32">Mes / Año</TableHead>
                                    {years.map(year => <TableHead key={year} className="text-center bg-muted">{year}</TableHead>)}
                                    <TableHead className="text-center bg-muted font-bold">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MESES.map((mes, idx) => (
                                    <TableRow key={mes}>
                                        <TableCell className="font-medium bg-muted/50">{mes}</TableCell>
                                        {years.map(year => (
                                            <TableCell
                                                key={`${year}-${idx}`}
                                                className="text-center cursor-pointer hover:bg-primary/10 transition-colors"
                                                onClick={() => handleCellClick(idx, year)}
                                            >
                                                {isCurrency
                                                    ? (matrix[year][idx] > 0 ? `${matrix[year][idx].toFixed(2)}€` : "-")
                                                    : (matrix[year][idx] > 0 ? matrix[year][idx].toFixed(2) : "-")
                                                }
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-center font-bold bg-muted/30">
                                            {isCurrency
                                                ? (rowTotals[idx] > 0 ? `${rowTotals[idx].toFixed(2)}€` : "-")
                                                : (rowTotals[idx] > 0 ? rowTotals[idx].toFixed(2) : "-")
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted font-bold">
                                    <TableCell>Total</TableCell>
                                    {years.map(year => (
                                        <TableCell key={`total-${year}`} className="text-center">
                                            {isCurrency
                                                ? (colTotals[year] > 0 ? `${colTotals[year].toFixed(2)}€` : "-")
                                                : (colTotals[year] > 0 ? colTotals[year].toFixed(2) : "-")
                                            }
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-center text-primary">
                                        {isCurrency
                                            ? (grandTotal > 0 ? `${grandTotal.toFixed(2)}€` : "-")
                                            : (grandTotal > 0 ? grandTotal.toFixed(2) : "-")
                                        }
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboards de Rendimiento</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Análisis comparativo por meses y años.</p>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border w-full sm:w-64">
                    <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
                    <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                        <SelectTrigger className="border-0 bg-transparent focus:ring-0">
                            <SelectValue placeholder="Todas las viviendas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las viviendas</SelectItem>
                            {viviendas.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
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
                        <CardTitle className="text-sm font-medium">Total Noches</CardTitle>
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalNoches}</div>
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
            </div>

            <div className="grid gap-8">
                {renderMatrix("Ingreso Real (Neto - Gastos)", getMatrixData("real"))}
                {renderMatrix("Total Gastos (€)", getMatrixData("gastos"))}
                {renderMatrix("Suma de Precio Neto (€)", getMatrixData("neto"))}
                {renderMatrix("Suma de Precio Bruto (€)", getMatrixData("bruto"))}
                {renderMatrix("Precio diario (Promedio)", getMatrixData("adr"), true)}
            </div>

            <Dialog open={!!selectedCell} onOpenChange={() => setSelectedCell(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detalle Alquileres: {MESES[selectedCell?.mes || 0]} {selectedCell?.año}</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Casa</TableHead>
                                    <TableHead>Plataforma</TableHead>
                                    <TableHead>Entrada</TableHead>
                                    <TableHead className="text-right">Neto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedCell?.rentals.map((r, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{r.viviendas?.nombre}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <PlatformLogo platform={r.plataformas?.nombre} className="h-4 w-4" />
                                                <span>{r.plataformas?.nombre}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(parseISO(r.fecha_entrada), "dd/MM/yyyy")}</TableCell>
                                        <TableCell className="text-right font-bold">{Number(r.precio_neto).toFixed(2)}€</TableCell>
                                    </TableRow>
                                ))}
                                {selectedCell?.rentals.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="text-center py-4">Sin datos para este mes.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
