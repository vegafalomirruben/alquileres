"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileDown, Building } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function TramitesPage() {
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [isGenerating, setIsGenerating] = useState(false);

    async function generateRegistradoresCSV() {
        if (!year || isNaN(Number(year))) {
            return toast.error("Por favor, introduce un año válido.");
        }

        setIsGenerating(true);
        try {
            // Fetch rentals for the selected year
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const { data, error } = await supabase
                .from("alquileres")
                .select("fecha_entrada, fecha_salida, viviendas(nrua)")
                .gte("fecha_entrada", startDate)
                .lte("fecha_entrada", endDate);

            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info(`No se encontraron alquileres para el año ${year}.`);
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

            toast.success("CSV generado con éxito");
        } catch (error: any) {
            console.error("Error generating CSV:", error);
            toast.error("Error al generar el CSV: " + error.message);
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Trámites</h1>
                <p className="text-muted-foreground">Gestión de trámites administrativos y exportaciones oficiales.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="bg-blue-50/50 pb-4">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                            <Building className="h-5 w-5" />
                            <span className="text-xs font-bold uppercase tracking-wider">Propiedad</span>
                        </div>
                        <CardTitle className="text-xl">Registradores</CardTitle>
                        <CardDescription>
                            Genera el archivo CSV para el registro de la propiedad con el formato requerido.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="year">Selecciona el Año</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    placeholder="Ej: 2024"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="text-lg font-semibold"
                                />
                            </div>
                            <Button
                                onClick={generateRegistradoresCSV}
                                className="w-full bg-blue-600 hover:bg-blue-700 h-11"
                                disabled={isGenerating}
                            >
                                <FileDown className="mr-2 h-5 w-5" />
                                {isGenerating ? "Generando..." : "Descargar CSV"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
