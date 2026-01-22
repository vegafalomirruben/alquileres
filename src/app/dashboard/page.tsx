"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function DashboardsPage() {
    const [rentals, setRentals] = useState<any[]>([]);
    const [years, setYears] = useState<number[]>([]);
    const [selectedCell, setSelectedCell] = useState<{ mes: number, año: number, rentals: any[] } | null>(null);

    useEffect(() => {
        async function fetchData() {
            const { data } = await supabase.from("alquileres").select("*, viviendas(nombre), plataformas(nombre)");
            if (data) {
                setRentals(data);
                const uniqueYears = Array.from(new Set(data.map(r => getYear(parseISO(r.fecha_entrada))))).sort((a, b) => b - a);
                setYears(uniqueYears.length > 0 ? uniqueYears : [new Date().getFullYear()]);
            }
        }
        fetchData();
    }, []);

    const getMatrixData = (metric: "neto" | "bruto" | "adr") => {
        const matrix: any = {};
        years.forEach(year => {
            matrix[year] = Array(12).fill(0);
            const yearRentals = rentals.filter(r => getYear(parseISO(r.fecha_entrada)) === year);

            for (let month = 0; month < 12; month++) {
                const monthRentals = yearRentals.filter(r => getMonth(parseISO(r.fecha_entrada)) === month);
                if (metric === "adr") {
                    const sumAdr = monthRentals.reduce((acc, r) => acc + Number(r.precio_medio_diario), 0);
                    matrix[year][month] = monthRentals.length > 0 ? sumAdr / monthRentals.length : 0;
                } else if (metric === "neto") {
                    matrix[year][month] = monthRentals.reduce((acc, r) => acc + Number(r.precio_neto), 0);
                } else {
                    matrix[year][month] = monthRentals.reduce((acc, r) => acc + Number(r.precio_bruto), 0);
                }
            }
        });
        return matrix;
    };

    const handleCellClick = (mes: number, año: number) => {
        const filtered = rentals.filter(r =>
            getMonth(parseISO(r.fecha_entrada)) === mes &&
            getYear(parseISO(r.fecha_entrada)) === año
        );
        setSelectedCell({ mes, año, rentals: filtered });
    };

    const renderMatrix = (title: string, data: any, isCurrency: boolean = true) => (
        <Card className="overflow-hidden">
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="bg-muted w-32">Mes / Año</TableHead>
                                {years.map(year => <TableHead key={year} className="text-center bg-muted">{year}</TableHead>)}
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
                                                ? (data[year][idx] > 0 ? `${data[year][idx].toFixed(2)}€` : "-")
                                                : (data[year][idx] > 0 ? data[year][idx].toFixed(2) : "-")
                                            }
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboards de Rendimiento</h1>
                <p className="text-muted-foreground">Análisis comparativo por meses y años.</p>
            </div>

            <div className="grid gap-8">
                {renderMatrix("Suma de Precio Neto (€)", getMatrixData("neto"))}
                {renderMatrix("Suma de Precio Bruto (€)", getMatrixData("bruto"))}
                {renderMatrix("Promedio de Precio Medio Diario (ADR)", getMatrixData("adr"), false)}
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
                                        <TableCell>{r.plataformas?.nombre}</TableCell>
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
