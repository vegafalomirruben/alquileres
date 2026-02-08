"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileDown, Building, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Separator } from "@/components/ui/separator";

export default function TramitesPage() {
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [isGenerating, setIsGenerating] = useState(false);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [selectedPlatIds, setSelectedPlatIds] = useState<string[]>([]);

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Trámites</h1>
                <p className="text-muted-foreground italic">Automatización de exportaciones para organismos oficiales.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-br from-blue-50 to-indigo-50/30 border-b border-blue-100/50 pb-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-600">
                                <Building className="h-5 w-5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Propiedad</span>
                            </div>
                            <CheckCircle2 className="h-5 w-5 text-blue-500/50" />
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-800">Registradores</CardTitle>
                        <CardDescription className="text-slate-600 font-medium">
                            Genera el archivo CSV oficial para el registro de la propiedad.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="year" className="text-sm font-bold text-slate-700">1. Año Fiscal</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    placeholder="Ej: 2024"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                    className="text-xl font-bold bg-white border-blue-200 focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <Separator className="bg-blue-100/50" />

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-bold text-slate-700">2. Plataformas</Label>
                                    <button
                                        onClick={toggleAll}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tight"
                                    >
                                        {selectedPlatIds.length === plataformas.length ? "Desmarcar todos" : "Marcar todos"}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {plataformas.map((plat) => (
                                        <div
                                            key={plat.id}
                                            onClick={() => togglePlataforma(plat.id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPlatIds.includes(plat.id)
                                                    ? "bg-blue-50 border-blue-500 shadow-sm"
                                                    : "bg-slate-50 border-transparent hover:border-slate-200"
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedPlatIds.includes(plat.id)
                                                    ? "bg-blue-600 border-blue-600"
                                                    : "bg-white border-slate-300"
                                                }`}>
                                                {selectedPlatIds.includes(plat.id) && (
                                                    <div className="w-2 h-2 bg-white rounded-full animate-in zoom-in-50 duration-300" />
                                                )}
                                            </div>
                                            <span className={`text-sm font-semibold ${selectedPlatIds.includes(plat.id) ? "text-blue-900" : "text-slate-600"}`}>
                                                {plat.nombre}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={generateRegistradoresCSV}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-14 rounded-2xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={isGenerating}
                        >
                            <FileDown className="mr-3 h-6 w-6" />
                            {isGenerating ? "Generando Archivo..." : "Generar y Descargar CSV"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
