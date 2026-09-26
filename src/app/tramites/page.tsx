"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    FileDown, Building, CheckCircle2, Landmark, PieChart, Table as TableIcon,
    Filter, Calendar, Info, Calculator, ShieldCheck, Users, UserCheck, Plus,
    Trash2, Send, Download, FileText, Eye, AlertCircle
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { splitRentals } from "@/lib/rentalSplitter";
import { generateParteViajerosPDF, ViajeroData, InmuebleData } from "@/lib/generateParteViajeros";
import { downloadSESHospedajesJSON } from "@/lib/sesHospedajesFormatter";

export default function TramitesPage() {
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const diasAño = isLeapYear(Number(year)) ? 366 : 365;
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingHacienda, setIsGeneratingHacienda] = useState(false);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [selectedPlatIds, setSelectedPlatIds] = useState<string[]>([]);

    // SES / Viajeros state
    const [activeTab, setActiveTab] = useState("policia");
    const [viajeros, setViajeros] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [alquileres, setAlquileres] = useState<any[]>([]);
    const [isViajeroModalOpen, setIsViajeroModalOpen] = useState(false);
    const [isSubmittingSES, setIsSubmittingSES] = useState(false);
    const [selectedViviendaFilter, setSelectedViviendaFilter] = useState<string>("all");

    const [viajeroForm, setViajeroForm] = useState<ViajeroData>({
        nombre: "",
        primer_apellido: "",
        segundo_apellido: "",
        sexo: "M",
        tipo_documento: "DNI",
        numero_documento: "",
        numero_soporte: "",
        fecha_expedicion_doc: "",
        nacionalidad: "ESP",
        fecha_nacimiento: "",
        lugar_residencia: "",
        telefono: "",
        email: "",
        fecha_entrada: "",
        fecha_salida: "",
        parentesco: "TITULAR",
        vivienda_id: "",
        alquiler_id: ""
    });

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
            deducible: number;
            individual: number;
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
        fetchViajerosData();
    }, []);

    async function fetchPlataformas() {
        const { data } = await supabase.from("plataformas").select("*").order("nombre");
        if (data) {
            setPlataformas(data);
            setSelectedPlatIds(data.map(p => p.id));
        }
    }

    async function fetchViajerosData() {
        const { data: vData } = await supabase.from("viajeros").select("*, viviendas(nombre, direccion, nif_titular, nombre_titular, codigo_establecimiento_ses, licencia_turistica, nrua), alquileres(fecha_entrada, fecha_salida)").order("created_at", { ascending: false });
        const { data: vivData } = await supabase.from("viviendas").select("*").order("nombre");
        const { data: alqData } = await supabase.from("alquileres").select("id, fecha_entrada, fecha_salida, vivienda_id, viviendas(nombre)").order("fecha_entrada", { ascending: false }).limit(50);

        if (vData) setViajeros(vData);
        if (vivData) {
            setViviendas(vivData);
            if (vivData.length > 0 && !viajeroForm.vivienda_id) {
                setViajeroForm(prev => ({ ...prev, vivienda_id: vivData[0].id }));
            }
        }
        if (alqData) setAlquileres(alqData);
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

    // --- SES / VIAJEROS HANDLERS ---
    function resetViajeroForm() {
        setViajeroForm({
            nombre: "",
            primer_apellido: "",
            segundo_apellido: "",
            sexo: "M",
            tipo_documento: "DNI",
            numero_documento: "",
            numero_soporte: "",
            fecha_expedicion_doc: "",
            nacionalidad: "ESP",
            fecha_nacimiento: "",
            lugar_residencia: "",
            telefono: "",
            email: "",
            fecha_entrada: "",
            fecha_salida: "",
            parentesco: "TITULAR",
            vivienda_id: viviendas.length > 0 ? viviendas[0].id : "",
            alquiler_id: ""
        });
    }

    async function handleSaveViajero() {
        if (!viajeroForm.nombre || !viajeroForm.primer_apellido || !viajeroForm.numero_documento || !viajeroForm.fecha_nacimiento) {
            return toast.error("Por favor completa los campos obligatorios (Nombre, Apellido, Documento y Fecha Nacimiento)");
        }

        const dataToSave = {
            ...viajeroForm,
            vivienda_id: viajeroForm.vivienda_id || null,
            alquiler_id: viajeroForm.alquiler_id || null,
            fecha_expedicion_doc: viajeroForm.fecha_expedicion_doc || null,
            fecha_nacimiento: viajeroForm.fecha_nacimiento || null,
            fecha_entrada: viajeroForm.fecha_entrada || null,
            fecha_salida: viajeroForm.fecha_salida || null
        };

        const { error } = await supabase.from("viajeros").insert([dataToSave]);

        if (error) {
            console.error("Error al guardar viajero:", error);
            toast.error("Error al registrar viajero: " + error.message);
        } else {
            toast.success("Viajero registrado correctamente");
            setIsViajeroModalOpen(false);
            resetViajeroForm();
            fetchViajerosData();
        }
    }

    async function handleDeleteViajero(id: string) {
        if (!confirm("¿Seguro que quieres eliminar este registro de viajero?")) return;
        const { error } = await supabase.from("viajeros").delete().eq("id", id);
        if (error) toast.error("Error al eliminar");
        else {
            toast.success("Registro de viajero eliminado");
            fetchViajerosData();
        }
    }

    function handleDownloadPDF(v: any) {
        const inmueble: InmuebleData = {
            nombre: v.viviendas?.nombre || "Vivienda Turística",
            direccion: v.viviendas?.direccion,
            nif_titular: v.viviendas?.nif_titular,
            nombre_titular: v.viviendas?.nombre_titular,
            codigo_establecimiento_ses: v.viviendas?.codigo_establecimiento_ses,
            licencia_turistica: v.viviendas?.licencia_turistica,
            nrua: v.viviendas?.nrua
        };

        generateParteViajerosPDF(v, inmueble);
        toast.success("Parte de Viajeros (PDF) generado correctamente");
    }

    function handleExportJSON(selectedViajeros?: any[]) {
        const listToExport = selectedViajeros || filteredViajeros;
        if (listToExport.length === 0) {
            return toast.info("No hay viajeros para exportar");
        }

        const primerInmueble = listToExport[0]?.viviendas || {};
        const inmueble: InmuebleData = {
            nombre: primerInmueble.nombre || "Vivienda",
            direccion: primerInmueble.direccion,
            nif_titular: primerInmueble.nif_titular,
            nombre_titular: primerInmueble.nombre_titular,
            codigo_establecimiento_ses: primerInmueble.codigo_establecimiento_ses,
            licencia_turistica: primerInmueble.licencia_turistica,
            nrua: primerInmueble.nrua
        };

        downloadSESHospedajesJSON(listToExport, inmueble);
        toast.success(`Fichero JSON oficial generado con ${listToExport.length} parte(s)`);
    }

    async function handleTransmitirSES(v: any) {
        setIsSubmittingSES(true);
        try {
            const inmueble: InmuebleData = {
                nombre: v.viviendas?.nombre || "Vivienda",
                direccion: v.viviendas?.direccion,
                nif_titular: v.viviendas?.nif_titular,
                nombre_titular: v.viviendas?.nombre_titular,
                codigo_establecimiento_ses: v.viviendas?.codigo_establecimiento_ses,
                licencia_turistica: v.viviendas?.licencia_turistica
            };

            const res = await fetch("/api/ses-hospedajes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    viajeros: [v],
                    inmueble
                })
            });

            const data = await res.json();

            if (data.success) {
                // Actualizar estado en la BD
                await supabase
                    .from("viajeros")
                    .update({
                        estado_ses: "REGISTRADO",
                        codigo_comunicacion_ses: data.codigoRegistro
                    })
                    .eq("id", v.id);

                toast.success(`Comunicación oficial completada. Acuse: ${data.codigoRegistro}`);
                fetchViajerosData();
            } else {
                toast.error(`Error de validación: ${data.message}`);
            }
        } catch (err: any) {
            toast.error("Error al conectar con la pasarela SES: " + err.message);
        } finally {
            setIsSubmittingSES(false);
        }
    }

    const filteredViajeros = viajeros.filter(v => {
        if (selectedViviendaFilter === "all") return true;
        return v.vivienda_id === selectedViviendaFilter;
    });

    // --- REGISTRADORES & HACIENDA HANDLERS ---
    async function generateRegistradoresCSV() {
        if (!year || isNaN(Number(year))) {
            return toast.error("Por favor, introduce un año válido.");
        }

        if (selectedPlatIds.length === 0) {
            return toast.error("Selecciona al menos una plataforma.");
        }

        setIsGenerating(true);
        try {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const { data, error } = await supabase
                .from("alquileres")
                .select("fecha_entrada, fecha_salida, plataforma_id, viviendas(nrua)")
                .lte("fecha_entrada", endDate)
                .gte("fecha_salida", startDate)
                .in("plataforma_id", selectedPlatIds);

            if (error) throw error;

            if (!data || data.length === 0) {
                toast.info(`No se encontraron alquileres para los criterios seleccionados.`);
                return;
            }

            const splitData = splitRentals(data).filter((r: any) =>
                r.fecha_entrada >= startDate && r.fecha_entrada <= endDate
            );

            let csvContent = "NRUA;fechaentrada;fechasalida;huespedes;codigofinalidad\n";

            splitData.forEach((rental: any) => {
                const nrua = rental.viviendas?.nrua || "";
                const entrada = format(parseISO(rental.fecha_entrada), "dd.MM.yyyy");
                const salida = format(parseISO(rental.fecha_salida), "dd.MM.yyyy");
                const huespedes = Math.floor(Math.random() * (7 - 3 + 1)) + 3;
                const codigofinalidad = "1";

                csvContent += `${nrua};${entrada};${salida};${huespedes};${codigofinalidad}\n`;
            });

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

            const { data: rawRentals, error: rError } = await supabase
                .from("alquileres")
                .select("vivienda_id, precio_bruto, precio_neto, comision_valor, fecha_entrada, fecha_salida")
                .lte("fecha_entrada", endDate)
                .gte("fecha_salida", startDate)
                .in("plataforma_id", selectedPlatIds);

            if (rError) throw rError;

            const rentals = splitRentals(rawRentals || []).filter((r: any) =>
                r.fecha_entrada >= startDate && r.fecha_entrada <= endDate
            );

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

            const { data: viviendasList, error: vError } = await supabase
                .from("viviendas")
                .select("id, nombre, ref_catastral, valor_catastral_total, valor_catastral_construccion, valor_suelo");

            if (vError) throw vError;
            const viviendasData = viviendasList || [];

            const numViviendas = viviendasData.length || 1;
            const capacidadTotalNoches = numViviendas * diasAño;
            const totalBruto = rentals?.reduce((acc, r) => acc + (Number(r.precio_bruto) || 0), 0) || 0;
            const totalNeto = rentals?.reduce((acc, r) => acc + (Number(r.precio_neto) || 0), 0) || 0;
            const totalComisiones = rentals?.reduce((acc, r) => acc + (Number(r.comision_valor) || 0), 0) || 0;

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

            let totalAmortizacion = 0;
            let totalRentaImputada = 0;
            const viviendasDetalle = viviendasData.map(v => {
                const nochesPropiedad = nochesPorPropiedad[v.id] || 0;
                const nochesVacias = Math.max(0, diasAño - nochesPropiedad);

                const amortAnual = (Number(v.valor_catastral_construccion) || 0) * 0.03;
                const amortDeducible = amortAnual * (nochesPropiedad / diasAño);
                totalAmortizacion += amortDeducible;

                const tasaImputacion = 0.011;
                const rentaAnual = (Number(v.valor_catastral_total) || 0) * tasaImputacion;
                const rentaImputada = rentaAnual * (nochesVacias / diasAño);
                totalRentaImputada += rentaImputada;

                return {
                    id: v.id,
                    nombre: v.nombre,
                    ref_catastral: v.ref_catastral || "No especificada",
                    valor_catastral_total: Number(v.valor_catastral_total) || 0,
                    valor_catastral_construccion: Number(v.valor_catastral_construccion) || 0,
                    nochesAlquiladas: nochesPropiedad,
                    nochesVacias: nochesVacias,
                    amortizacionDeducible: amortDeducible,
                    rentaImputada: rentaImputada
                };
            });

            const gastosPorCat = Object.entries(categorizedExpenses).map(([nombre, total]) => {
                const deducible = is100PercentDeductible(nombre) ? total : total * occupationRatio;
                return {
                    nombre,
                    total,
                    deducible,
                    individual: deducible * 0.5
                };
            });

            if (totalAmortizacion > 0) {
                gastosPorCat.unshift({
                    nombre: "Amortización Inmuebles (3% Const.)",
                    total: totalAmortizacion,
                    deducible: totalAmortizacion,
                    individual: totalAmortizacion * 0.5
                });
            }

            setHaciendaData({
                bruto: totalBruto,
                neto: totalNeto,
                comisiones: totalComisiones,
                totalRentaImputada,
                nochesTotales: totalNoches,
                porcentajeOcupacion: (totalNoches / capacidadTotalNoches) * 100,
                gastosPorCategoria: gastosPorCat,
                viviendasDetalle
            });

            toast.success("Informe de Hacienda generado con éxito.");
        } catch (error: any) {
            console.error("Error generating Hacienda report:", error);
            toast.error("Error al generar el informe de Hacienda: " + error.message);
        } finally {
            setIsGeneratingHacienda(false);
        }
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">Trámites y Obligaciones Oficiales</h1>
                <p className="text-muted-foreground">
                    Cumplimiento normativo oficial: Registro de Viajeros (SES.HOSPEDAJES / Policía), Registradores de la Propiedad y Hacienda (IRPF).
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid grid-cols-3 w-full max-w-2xl bg-muted/60 p-1.5 rounded-2xl">
                    <TabsTrigger value="policia" className="rounded-xl font-bold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-indigo-500" />
                        SES.HOSPEDAJES / Policía
                    </TabsTrigger>
                    <TabsTrigger value="hacienda" className="rounded-xl font-bold flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-emerald-500" />
                        Hacienda (IRPF)
                    </TabsTrigger>
                    <TabsTrigger value="registradores" className="rounded-xl font-bold flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-500" />
                        Registradores
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: SES.HOSPEDAJES / POLICIA NACIONAL / GUARDIA CIVIL */}
                <TabsContent value="policia" className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="border-indigo-100 shadow-md bg-gradient-to-br from-indigo-900 to-slate-900 text-white col-span-full md:col-span-2">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                                        <ShieldCheck className="h-7 w-7 text-indigo-300" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-3 py-1 rounded-full">
                                        Real Decreto 933/2021
                                    </span>
                                </div>
                                <CardTitle className="text-2xl font-black mt-3">Registro y Partes de Viajeros</CardTitle>
                                <CardDescription className="text-indigo-200/80 font-medium text-sm">
                                    Comunicación obligatoria al Ministerio del Interior (Policía Nacional y Guardia Civil). Genera partes oficiales en PDF y ficheros telemáticos.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-3">
                                <Button
                                    onClick={() => {
                                        resetViajeroForm();
                                        setIsViajeroModalOpen(true);
                                    }}
                                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl h-11 px-5 shadow-lg shadow-indigo-500/25"
                                >
                                    <Plus className="mr-2 h-4 w-4" /> Registrar Nuevo Huésped
                                </Button>
                                <Button
                                    onClick={() => handleExportJSON()}
                                    variant="outline"
                                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold rounded-xl h-11 px-5"
                                >
                                    <FileDown className="mr-2 h-4 w-4" /> Descargar Lote JSON (SES)
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 bg-card shadow-sm flex flex-col justify-between">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Estado de Cumplimiento</CardTitle>
                                <div className="text-3xl font-black text-foreground mt-1">
                                    {viajeros.length} <span className="text-xs font-normal text-muted-foreground">partes registrados</span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Listos para exportar:</span>
                                    <span className="font-bold text-emerald-600">{viajeros.filter(v => v.estado_ses === 'REGISTRADO' || v.estado_ses === 'PENDIENTE').length}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Viviendas activas:</span>
                                    <span className="font-bold">{viviendas.length}</span>
                                </div>
                                <div className="p-3 bg-muted/40 rounded-xl text-[11px] text-muted-foreground leading-snug">
                                    💡 Puedes configurar el <strong>Código SES</strong> de cada vivienda en <a href="/configuracion" className="text-primary font-bold underline">Ajustes</a>.
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* LISTADO DE VIAJEROS */}
                    <Card className="shadow-lg border-primary/10 overflow-hidden">
                        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-muted/30 border-b border-primary/5 pb-4">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    Libro-Registro de Viajeros
                                </CardTitle>
                                <CardDescription className="text-xs">Historial de inquilinos y partes de entrada generados.</CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <Select value={selectedViviendaFilter} onValueChange={setSelectedViviendaFilter}>
                                    <SelectTrigger className="w-56 h-9 rounded-xl text-xs font-bold">
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
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/10">
                                        <TableHead className="font-bold text-xs">Viajero</TableHead>
                                        <TableHead className="font-bold text-xs">Documento</TableHead>
                                        <TableHead className="font-bold text-xs">Vivienda</TableHead>
                                        <TableHead className="font-bold text-xs">Estancia</TableHead>
                                        <TableHead className="font-bold text-xs">Estado SES</TableHead>
                                        <TableHead className="font-bold text-xs text-right">Acciones Oficiales</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredViajeros.map((v) => (
                                        <TableRow key={v.id} className="hover:bg-primary/5 transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-foreground">
                                                        {v.nombre} {v.primer_apellido} {v.segundo_apellido || ""}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        {v.nacionalidad || "ESP"} • Nac: {v.fecha_nacimiento ? format(parseISO(v.fecha_nacimiento), "dd/MM/yyyy") : "-"}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{v.tipo_documento || "DNI"}</span>
                                                    {v.numero_documento}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">
                                                {v.viviendas?.nombre || "Sin asignar"}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {v.fecha_entrada ? format(parseISO(v.fecha_entrada), "dd/MM/yy") : "-"}
                                                {v.fecha_salida ? ` al ${format(parseISO(v.fecha_salida), "dd/MM/yy")}` : ""}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${v.estado_ses === 'REGISTRADO'
                                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                    }`}>
                                                    {v.estado_ses || "PENDIENTE"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleDownloadPDF(v)}
                                                        className="h-8 text-xs font-bold rounded-lg border-primary/20 text-primary hover:bg-primary/10"
                                                        title="Descargar Parte Oficial en PDF para firma"
                                                    >
                                                        <FileText className="h-3.5 w-3.5 mr-1" /> Parte PDF
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleTransmitirSES(v)}
                                                        disabled={isSubmittingSES}
                                                        className="h-8 text-xs font-bold rounded-lg text-indigo-600 hover:bg-indigo-50"
                                                        title="Validar y tramitar comunicación oficial"
                                                    >
                                                        <Send className="h-3.5 w-3.5 mr-1" /> Tramitar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeleteViajero(v.id)}
                                                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 rounded-lg"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredViajeros.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground font-medium">
                                                No hay huéspedes registrados en el sistema. Pulsa en <strong>&quot;Registrar Nuevo Huésped&quot;</strong> para dar de alta el primer parte.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* MODAL REGISTRAR VIAJERO */}
                    <Dialog open={isViajeroModalOpen} onOpenChange={setIsViajeroModalOpen}>
                        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-3xl p-6">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-primary">
                                    <UserCheck className="h-6 w-6 text-primary" />
                                    Registro Oficial de Huésped (RD 933/2021)
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid gap-4 py-4 text-xs">
                                <div className="p-3 bg-muted/40 rounded-xl border border-primary/10 flex items-start gap-2.5">
                                    <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        Los datos introducidos se emplean para confeccionar el <strong>Parte de Entrada oficial</strong> y la comunicación obligatoria a la plataforma <strong>SES.HOSPEDAJES</strong>.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Vivienda Asignada</Label>
                                        <Select value={viajeroForm.vivienda_id} onValueChange={(v) => setViajeroForm({ ...viajeroForm, vivienda_id: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona vivienda..." /></SelectTrigger>
                                            <SelectContent>
                                                {viviendas.map(viv => <SelectItem key={viv.id} value={viv.id}>{viv.nombre}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Alquiler / Reserva (Opcional)</Label>
                                        <Select value={viajeroForm.alquiler_id || "none"} onValueChange={(v) => {
                                            const alqId = v === "none" ? "" : v;
                                            const selectedAlq = alquileres.find(a => a.id === alqId);
                                            setViajeroForm(prev => ({
                                                ...prev,
                                                alquiler_id: alqId,
                                                fecha_entrada: selectedAlq ? selectedAlq.fecha_entrada : prev.fecha_entrada,
                                                fecha_salida: selectedAlq ? selectedAlq.fecha_salida : prev.fecha_salida,
                                                vivienda_id: selectedAlq ? selectedAlq.vivienda_id : prev.vivienda_id
                                            }));
                                        }}>
                                            <SelectTrigger><SelectValue placeholder="Vincular a reserva..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Sin reserva vinculada</SelectItem>
                                                {alquileres.map(a => (
                                                    <SelectItem key={a.id} value={a.id}>
                                                        {a.viviendas?.nombre} ({a.fecha_entrada} a {a.fecha_salida})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Nombre *</Label>
                                        <Input placeholder="Ej: Juan" value={viajeroForm.nombre} onChange={e => setViajeroForm({ ...viajeroForm, nombre: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Primer Apellido *</Label>
                                        <Input placeholder="Ej: García" value={viajeroForm.primer_apellido} onChange={e => setViajeroForm({ ...viajeroForm, primer_apellido: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Segundo Apellido</Label>
                                        <Input placeholder="Ej: Pérez" value={viajeroForm.segundo_apellido || ""} onChange={e => setViajeroForm({ ...viajeroForm, segundo_apellido: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Tipo Doc.</Label>
                                        <Select value={viajeroForm.tipo_documento} onValueChange={v => setViajeroForm({ ...viajeroForm, tipo_documento: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DNI">DNI</SelectItem>
                                                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                                <SelectItem value="NIE">NIE</SelectItem>
                                                <SelectItem value="OTRO">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Nº Documento *</Label>
                                        <Input placeholder="Ej: 12345678Z" value={viajeroForm.numero_documento} onChange={e => setViajeroForm({ ...viajeroForm, numero_documento: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Nº Soporte</Label>
                                        <Input placeholder="Ej: AAA123456" value={viajeroForm.numero_soporte || ""} onChange={e => setViajeroForm({ ...viajeroForm, numero_soporte: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Sexo</Label>
                                        <Select value={viajeroForm.sexo} onValueChange={v => setViajeroForm({ ...viajeroForm, sexo: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="M">Masculino</SelectItem>
                                                <SelectItem value="F">Femenino</SelectItem>
                                                <SelectItem value="O">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Nacionalidad</Label>
                                        <Input placeholder="ESP / España" value={viajeroForm.nacionalidad || "ESP"} onChange={e => setViajeroForm({ ...viajeroForm, nacionalidad: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Fecha Nacimiento *</Label>
                                        <Input type="date" value={viajeroForm.fecha_nacimiento || ""} onChange={e => setViajeroForm({ ...viajeroForm, fecha_nacimiento: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Fecha Expedición Doc</Label>
                                        <Input type="date" value={viajeroForm.fecha_expedicion_doc || ""} onChange={e => setViajeroForm({ ...viajeroForm, fecha_expedicion_doc: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Fecha Entrada</Label>
                                        <Input type="datetime-local" value={viajeroForm.fecha_entrada || ""} onChange={e => setViajeroForm({ ...viajeroForm, fecha_entrada: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Fecha Salida Prevista</Label>
                                        <Input type="datetime-local" value={viajeroForm.fecha_salida || ""} onChange={e => setViajeroForm({ ...viajeroForm, fecha_salida: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-1.5 col-span-1">
                                        <Label className="font-bold">Lugar Residencia</Label>
                                        <Input placeholder="Municipio, País" value={viajeroForm.lugar_residencia || ""} onChange={e => setViajeroForm({ ...viajeroForm, lugar_residencia: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Teléfono</Label>
                                        <Input placeholder="+34 600000000" value={viajeroForm.telefono || ""} onChange={e => setViajeroForm({ ...viajeroForm, telefono: e.target.value })} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold">Email</Label>
                                        <Input type="email" placeholder="cliente@email.com" value={viajeroForm.email || ""} onChange={e => setViajeroForm({ ...viajeroForm, email: e.target.value })} />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-primary/10">
                                    <Button variant="ghost" onClick={() => setIsViajeroModalOpen(false)}>Cancelar</Button>
                                    <Button onClick={handleSaveViajero} className="bg-primary font-bold">
                                        Guardar Huésped
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </TabsContent>

                {/* TAB 2: HACIENDA */}
                <TabsContent value="hacienda" className="space-y-6">
                    <Card className="border-emerald-100 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <Landmark className="h-5 w-5 text-emerald-600" />
                                    Módulo Fiscal Hacienda (IRPF)
                                </CardTitle>
                                <CardDescription>Cálculo de ingresos netos, amortización del 3% y gastos deducibles.</CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    value={year}
                                    onChange={e => setYear(e.target.value)}
                                    className="w-24 font-bold"
                                />
                                <Button
                                    onClick={generateHaciendaSummary}
                                    disabled={isGeneratingHacienda}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                >
                                    <TableIcon className="mr-2 h-4 w-4" /> {isGeneratingHacienda ? "Analizando..." : "Calcular Ejercicio"}
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>

                    {haciendaData && (
                        <div className="animate-in fade-in duration-500">
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
                                        </div>
                                        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.2em] mb-1">Resultado Bruto</p>
                                            <p className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                                                {haciendaData.bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <CardContent className="p-0">
                                    <div className="grid md:grid-cols-2">
                                        <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/30">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                                Módulo de Ingresos
                                            </h3>
                                            <Table>
                                                <TableBody>
                                                    <TableRow className="border-transparent h-8">
                                                        <TableCell className="font-bold text-slate-700 py-1 text-xs">Ingresos Brutos</TableCell>
                                                        <TableCell className="text-right font-black text-slate-900 text-base tracking-tight py-1">{haciendaData.bruto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-transparent h-8">
                                                        <TableCell className="font-bold text-slate-500 py-1 text-xs">Comisiones Plataformas</TableCell>
                                                        <TableCell className="text-right font-bold text-rose-500 py-1 text-xs">-{haciendaData.comisiones.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-transparent h-8">
                                                        <TableCell className="font-bold text-slate-600 flex items-center gap-2 py-1 text-xs">
                                                            Renta Inmobiliaria Imputada
                                                            <RentaImputadaInfo />
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-amber-600 py-1 text-xs">+{haciendaData.totalRentaImputada.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="bg-white font-bold border-t-2 border-slate-900 h-10">
                                                        <TableCell className="text-slate-900 text-sm py-1">Neto Cobrado Alquiler</TableCell>
                                                        <TableCell className="text-right text-emerald-600 text-xl font-black tracking-tighter py-1">{haciendaData.neto.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <div className="p-8 bg-white">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
                                                <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
                                                Módulo de Gastos Deductibles
                                            </h3>
                                            <div className="max-h-[350px] overflow-y-auto border rounded-2xl">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50 border-b">
                                                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 h-7 py-0">Concepto</TableHead>
                                                            <TableHead className="text-[10px] font-black uppercase text-slate-500 text-right px-3 h-7 py-0">Total</TableHead>
                                                            <TableHead className="text-[10px] font-black uppercase text-blue-600 text-right px-3 h-7 py-0">Deduc. ({haciendaData.porcentajeOcupacion.toFixed(1)}%)</TableHead>
                                                            <TableHead className="text-[10px] font-black uppercase text-emerald-600 text-right px-3 h-7 py-0">Indiv. (50%)</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {haciendaData.gastosPorCategoria.map((gasto, idx) => (
                                                            <TableRow key={idx} className="hover:bg-slate-50 border-slate-100 h-7">
                                                                <TableCell className="text-xs font-bold text-slate-700 px-4 capitalize">
                                                                    <div className="flex items-center gap-2">
                                                                        {gasto.nombre}
                                                                        {gasto.nombre.includes("Amortización") && <AmortizacionInfo />}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-slate-400 px-3 text-[11px] py-1">{gasto.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                                <TableCell className="text-right font-bold text-slate-900 px-3 text-[11px] bg-blue-50/30 py-1">{gasto.deducible.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                                <TableCell className="text-right font-black text-emerald-600 px-3 text-xs bg-emerald-50/20 py-1">{gasto.individual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>

                {/* TAB 3: REGISTRADORES */}
                <TabsContent value="registradores" className="space-y-6">
                    <Card className="border-blue-100 shadow-md">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Building className="h-5 w-5 text-blue-600" />
                                Exportación Registradores de la Propiedad
                            </CardTitle>
                            <CardDescription>Generación de archivo CSV oficial con los NRUA de cada vivienda.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center gap-4">
                            <Input
                                type="number"
                                value={year}
                                onChange={e => setYear(e.target.value)}
                                className="w-28 font-bold"
                            />
                            <Button
                                onClick={generateRegistradoresCSV}
                                disabled={isGenerating}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            >
                                <FileDown className="mr-2 h-4 w-4" /> {isGenerating ? "Generando..." : `Descargar CSV (${year})`}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
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
                        Cálculo de la Amortización del Inmueble
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-sm font-bold text-blue-900 mb-2">Fórmula Oficial AEAT:</p>
                        <code className="text-xs block bg-white p-3 rounded-lg border border-blue-200 font-mono text-blue-800">
                            (Valor Catastral de Construcción × 3%) × (Días Alquilados / Días del Año)
                        </code>
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
