"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    FileDown, Building, CheckCircle2, Landmark, PieChart, Table as TableIcon,
    Filter, Calendar, Info, Calculator, ShieldCheck, Users, UserCheck, Plus,
    Trash2, Send, Download, FileText, Eye, AlertCircle, ChevronDown, ChevronRight, Clock, FileCode, Pencil
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
import { normalizeCountryToISO3, COMMON_NATIONALITIES } from "@/lib/countryCodes";
import { validateDocument, getExpectedNieLetter, getExpectedDniLetter } from "@/lib/documentValidation";

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
    const [editingViajeroId, setEditingViajeroId] = useState<string | null>(null);
    const [isSubmittingSES, setIsSubmittingSES] = useState(false);
    const [submittingGroupKey, setSubmittingGroupKey] = useState<string | null>(null);
    const [selectedViviendaFilter, setSelectedViviendaFilter] = useState<string>("all");
    const [expandedReservas, setExpandedReservas] = useState<Record<string, boolean>>({});

    const toggleReservaExpand = (key: string) => {
        setExpandedReservas(prev => ({
            ...prev,
            [key]: prev[key] === undefined ? false : !prev[key]
        }));
    };

    const toggleAllReservas = (expand: boolean) => {
        const next: Record<string, boolean> = {};
        groupedReservas.forEach(g => {
            next[g.key] = expand;
        });
        setExpandedReservas(next);
    };

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
        const { data: vData } = await supabase.from("viajeros").select("*, viviendas(nombre, direccion, nif_titular, nombre_titular, codigo_establecimiento_ses, licencia_turistica, nrua), alquileres(id, fecha_entrada, fecha_salida, created_at, plataformas(nombre))").order("created_at", { ascending: false });
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
        setEditingViajeroId(null);
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

    function handleEditViajero(v: any) {
        setEditingViajeroId(v.id);
        setViajeroForm({
            nombre: v.nombre || "",
            primer_apellido: v.primer_apellido || "",
            segundo_apellido: v.segundo_apellido || "",
            sexo: v.sexo || "H",
            tipo_documento: v.tipo_documento || "DNI",
            numero_documento: v.numero_documento || "",
            numero_soporte: v.numero_soporte || "",
            fecha_expedicion_doc: v.fecha_expedicion_doc || "",
            nacionalidad: v.nacionalidad || "ESP",
            fecha_nacimiento: v.fecha_nacimiento || "",
            lugar_residencia: v.lugar_residencia || "",
            telefono: v.telefono || "",
            email: v.email || "",
            fecha_entrada: v.fecha_entrada ? v.fecha_entrada.slice(0, 10) : "",
            fecha_salida: v.fecha_salida ? v.fecha_salida.slice(0, 10) : "",
            parentesco: v.parentesco || "TITULAR",
            vivienda_id: v.vivienda_id || "",
            alquiler_id: v.alquiler_id || ""
        });
        setIsViajeroModalOpen(true);
    }

    async function handleSaveViajero() {
        if (!viajeroForm.nombre || !viajeroForm.primer_apellido || !viajeroForm.numero_documento || !viajeroForm.fecha_nacimiento) {
            return toast.error("Por favor completa los campos obligatorios (Nombre, Apellido, Documento y Fecha Nacimiento)");
        }

        const dataToSave = {
            ...viajeroForm,
            nacionalidad: normalizeCountryToISO3(viajeroForm.nacionalidad),
            vivienda_id: viajeroForm.vivienda_id || null,
            alquiler_id: viajeroForm.alquiler_id || null,
            fecha_expedicion_doc: viajeroForm.fecha_expedicion_doc || null,
            fecha_nacimiento: viajeroForm.fecha_nacimiento || null,
            fecha_entrada: viajeroForm.fecha_entrada || null,
            fecha_salida: viajeroForm.fecha_salida || null
        };

        let error = null;
        if (editingViajeroId) {
            const res = await supabase.from("viajeros").update(dataToSave).eq("id", editingViajeroId);
            error = res.error;
        } else {
            const res = await supabase.from("viajeros").insert([dataToSave]);
            error = res.error;
        }

        if (error) {
            console.error("Error al guardar viajero:", error);
            toast.error("Error al registrar viajero: " + error.message);
        } else {
            toast.success(editingViajeroId ? "Viajero actualizado correctamente" : "Viajero registrado correctamente");
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

        const primerViajero = listToExport[0];
        const customFileName = selectedViajeros && selectedViajeros.length === 1
            ? `ses_viajero_${primerViajero.primer_apellido || 'huesped'}_${format(new Date(), "yyyyMMdd")}.json`
            : selectedViajeros
            ? `ses_reserva_${primerViajero.primer_apellido || 'huesped'}_${format(new Date(), "yyyyMMdd")}.json`
            : undefined;

        downloadSESHospedajesJSON(listToExport, inmueble, customFileName);
        toast.success(`Fichero JSON oficial generado (${listToExport.length} huésped/es)`);
    }

    async function handleTransmitirGrupoSES(grupoViajeros: any[], viviendaData?: any, groupKey?: string) {
        if (!grupoViajeros || grupoViajeros.length === 0) {
            return toast.error("No hay viajeros seleccionados para tramitar.");
        }
        if (groupKey) setSubmittingGroupKey(groupKey);
        setIsSubmittingSES(true);
        try {
            const vFirst = grupoViajeros[0];
            const viv = viviendaData || vFirst.viviendas || {};
            const inmueble: InmuebleData = {
                nombre: viv.nombre || "Vivienda",
                direccion: viv.direccion,
                nif_titular: viv.nif_titular,
                nombre_titular: viv.nombre_titular,
                codigo_establecimiento_ses: viv.codigo_establecimiento_ses,
                licencia_turistica: viv.licencia_turistica,
                nrua: viv.nrua
            };

            const res = await fetch("/api/ses-hospedajes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    viajeros: grupoViajeros,
                    inmueble,
                    alquiler: vFirst.alquileres || {
                        id: vFirst.alquiler_id || "ALQ",
                        fecha_entrada: vFirst.fecha_entrada,
                        fecha_salida: vFirst.fecha_salida,
                        created_at: vFirst.created_at
                    }
                })
            });

            const data = await res.json();

            if (data.success) {
                const ids = grupoViajeros.map(item => item.id);
                await supabase
                    .from("viajeros")
                    .update({
                        estado_ses: "REGISTRADO",
                        codigo_comunicacion_ses: data.codigoRegistro
                    })
                    .in("id", ids);

                toast.success(`¡Alquiler tramitado con éxito! (${grupoViajeros.length} huésped/es registrados en un solo envío). Acuse: ${data.codigoRegistro}`);
                fetchViajerosData();
            } else {
                toast.error(`Error de validación: ${data.message}`);
                if (data.errores && Array.isArray(data.errores)) {
                    data.errores.forEach((errStr: string) => toast.error(errStr));
                }
            }
        } catch (err: any) {
            toast.error("Error al conectar con la pasarela SES: " + err.message);
        } finally {
            setIsSubmittingSES(false);
            setSubmittingGroupKey(null);
        }
    }

    async function handleDownloadXML(grupoViajeros: any[], viviendaData?: any) {
        if (!grupoViajeros || grupoViajeros.length === 0) return;
        const vFirst = grupoViajeros[0];
        const viv = viviendaData || vFirst.viviendas || {};
        const inmueble: InmuebleData = {
            nombre: viv.nombre || "Vivienda",
            direccion: viv.direccion,
            nif_titular: viv.nif_titular,
            nombre_titular: viv.nombre_titular,
            codigo_establecimiento_ses: viv.codigo_establecimiento_ses,
            licencia_turistica: viv.licencia_turistica,
            nrua: viv.nrua
        };

        try {
            const res = await fetch("/api/ses-hospedajes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    viajeros: grupoViajeros,
                    inmueble,
                    alquiler: vFirst.alquileres || {
                        id: vFirst.alquiler_id || "ALQ",
                        fecha_entrada: vFirst.fecha_entrada,
                        fecha_salida: vFirst.fecha_salida,
                        created_at: vFirst.created_at
                    },
                    action: "get_xml"
                })
            });
            const data = await res.json();
            if (data.success && data.xml) {
                const blob = new Blob([data.xml], { type: "application/xml;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = data.filename || `ses_reserva_${format(new Date(), "yyyyMMdd")}.xml`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                toast.success("Fichero XML oficial descargado correctamente (RD 933/2021)");
            } else {
                toast.error("Error al generar XML: " + (data.message || "desconocido"));
            }
        } catch (e: any) {
            toast.error("Error al descargar XML: " + e.message);
        }
    }

    async function handleTransmitirSES(v: any) {
        const grupoViajeros = v.alquiler_id
            ? viajeros.filter(item => item.alquiler_id === v.alquiler_id)
            : [v];
        await handleTransmitirGrupoSES(grupoViajeros, v.viviendas);
    }

    function handleDownloadAllPDFs(grupoViajeros: any[], viviendaData?: any) {
        if (!grupoViajeros || grupoViajeros.length === 0) return;
        const viv = viviendaData || grupoViajeros[0]?.viviendas || {};
        const inmueble: InmuebleData = {
            nombre: viv.nombre || "Vivienda",
            direccion: viv.direccion,
            nif_titular: viv.nif_titular,
            nombre_titular: viv.nombre_titular,
            codigo_establecimiento_ses: viv.codigo_establecimiento_ses,
            licencia_turistica: viv.licencia_turistica,
            nrua: viv.nrua
        };

        grupoViajeros.forEach((v, index) => {
            setTimeout(() => {
                generateParteViajerosPDF(v, inmueble);
            }, index * 200);
        });
        toast.success(`Generando ${grupoViajeros.length} Partes de Viajeros en PDF...`);
    }

    const filteredViajeros = viajeros.filter(v => {
        if (selectedViviendaFilter === "all") return true;
        return v.vivienda_id === selectedViviendaFilter;
    });

    const groupedReservas = useMemo(() => {
        const groupsMap = new Map<string, {
            key: string;
            alquilerId?: string | null;
            viviendaId?: string | null;
            vivienda: any;
            fechaEntrada?: string | null;
            fechaSalida?: string | null;
            viajeros: any[];
            estadoSES: "REGISTRADO" | "PENDIENTE" | "PARCIAL";
            codigoRegistro?: string | null;
            titularNombre: string;
            alquiler?: any;
        }>();

        filteredViajeros.forEach(v => {
            const key = v.alquiler_id 
                ? `alq_${v.alquiler_id}` 
                : (v.vivienda_id && v.fecha_entrada 
                    ? `estancia_${v.vivienda_id}_${v.fecha_entrada}` 
                    : `ind_${v.id}`);

            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    key,
                    alquilerId: v.alquiler_id || null,
                    viviendaId: v.vivienda_id || null,
                    vivienda: v.viviendas || null,
                    fechaEntrada: v.fecha_entrada || v.alquileres?.fecha_entrada,
                    fechaSalida: v.fecha_salida || v.alquileres?.fecha_salida,
                    viajeros: [],
                    estadoSES: "PENDIENTE",
                    codigoRegistro: null,
                    titularNombre: "",
                    alquiler: v.alquileres
                });
            }

            groupsMap.get(key)!.viajeros.push(v);
        });

        return Array.from(groupsMap.values()).map(group => {
            const titular = group.viajeros.find(v => v.parentesco === "TITULAR") || group.viajeros[0];
            const titularNombre = titular ? `${titular.nombre} ${titular.primer_apellido}` : "Sin titular";

            const allRegistrados = group.viajeros.every(v => v.estado_ses === "REGISTRADO");
            const someRegistrados = group.viajeros.some(v => v.estado_ses === "REGISTRADO");
            const estadoSES: "REGISTRADO" | "PENDIENTE" | "PARCIAL" = allRegistrados 
                ? "REGISTRADO" 
                : (someRegistrados ? "PARCIAL" : "PENDIENTE");

            const codigoRegistro = group.viajeros.find(v => v.codigo_comunicacion_ses)?.codigo_comunicacion_ses || null;

            return {
                ...group,
                titularNombre,
                estadoSES,
                codigoRegistro
            };
        }).sort((a, b) => {
            const dateA = a.fechaEntrada ? new Date(a.fechaEntrada).getTime() : 0;
            const dateB = b.fechaEntrada ? new Date(b.fechaEntrada).getTime() : 0;
            return dateB - dateA;
        });
    }, [filteredViajeros]);

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

                    {/* LISTADO DE VIAJEROS AGRUPADO POR ALQUILER */}
                    <Card className="shadow-lg border-primary/10 overflow-hidden">
                        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-muted/30 border-b border-primary/5 pb-4">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    Libro-Registro por Alquileres y Huéspedes
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Cada línea representa un alquiler completo. Despliega para ver a los viajeros o tramita toda la reserva en un solo envío a SES.HOSPEDAJES (RD 933/2021).
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleAllReservas(true)}
                                    className="h-8 text-xs font-semibold"
                                >
                                    Expandir todos
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleAllReservas(false)}
                                    className="h-8 text-xs font-semibold"
                                >
                                    Contraer todos
                                </Button>
                                <Select value={selectedViviendaFilter} onValueChange={setSelectedViviendaFilter}>
                                    <SelectTrigger className="w-52 h-8 rounded-xl text-xs font-bold">
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
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead className="font-bold text-xs">Alquiler / Estancia</TableHead>
                                        <TableHead className="font-bold text-xs">Titular & Huéspedes</TableHead>
                                        <TableHead className="font-bold text-xs">Vivienda</TableHead>
                                        <TableHead className="font-bold text-xs">Estado SES</TableHead>
                                        <TableHead className="font-bold text-xs text-right">Acciones Oficiales del Alquiler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedReservas.map((group) => {
                                        const isExpanded = expandedReservas[group.key] ?? true;
                                        const isSubmittingThis = submittingGroupKey === group.key;
                                        const count = group.viajeros.length;
                                        const titular = group.viajeros.find(v => v.parentesco === "TITULAR") || group.viajeros[0];

                                        return (
                                            <React.Fragment key={group.key}>
                                                {/* FILA PRINCIPAL: EL ALQUILER */}
                                                <TableRow 
                                                    className={`transition-colors cursor-pointer ${isExpanded ? "bg-muted/30 border-b-0" : "hover:bg-muted/20"}`}
                                                    onClick={() => toggleReservaExpand(group.key)}
                                                >
                                                    <TableCell className="py-3.5 pl-4 pr-1 text-center">
                                                        <button 
                                                            type="button"
                                                            className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-transform"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleReservaExpand(group.key);
                                                            }}
                                                        >
                                                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-0 text-primary" : "-rotate-90 text-muted-foreground"}`} />
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="py-3.5">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-sm text-foreground">
                                                                    {group.fechaEntrada ? format(parseISO(group.fechaEntrada), "dd/MM/yyyy") : "-"}
                                                                    {group.fechaSalida ? ` al ${format(parseISO(group.fechaSalida), "dd/MM/yyyy")}` : ""}
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                <Calendar className="h-3 w-3 text-indigo-500" />
                                                                {group.fechaEntrada && group.fechaSalida ? (
                                                                    `${Math.max(1, differenceInDays(parseISO(group.fechaSalida), parseISO(group.fechaEntrada)))} noche/s`
                                                                ) : "Estancia registrada"}
                                                                {group.alquilerId ? " • Vinculado a alquiler" : " • Registro manual"}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3.5">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xs text-foreground">
                                                                    {group.titularNombre}
                                                                </span>
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                                                    <Users className="h-3 w-3 mr-1" /> {count} {count === 1 ? "huésped" : "huéspedes"}
                                                                </span>
                                                            </div>
                                                            {count > 1 && (
                                                                <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                                                                    + {count - 1} acompañante/s: {group.viajeros.filter(v => v.id !== titular?.id).map(v => v.nombre).join(", ")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3.5 text-xs font-semibold text-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            <Building className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {group.vivienda?.nombre || "Sin asignar"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-3.5">
                                                        {group.estadoSES === "REGISTRADO" ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit">
                                                                    <CheckCircle2 className="h-3 w-3 mr-1" /> REGISTRADO
                                                                </span>
                                                                {group.codigoRegistro && (
                                                                    <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                                                        Acuse: {group.codigoRegistro}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : group.estadoSES === "PARCIAL" ? (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-orange-500/10 text-orange-600 border border-orange-500/20">
                                                                <Clock className="h-3 w-3 mr-1" /> PARCIAL
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                                <Clock className="h-3 w-3 mr-1" /> PENDIENTE ENVÍO
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-3.5 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleTransmitirGrupoSES(group.viajeros, group.vivienda, group.key)}
                                                                disabled={isSubmittingSES}
                                                                className={`h-8 text-xs font-bold rounded-xl shadow-sm ${group.estadoSES === "REGISTRADO" 
                                                                    ? "border border-emerald-500/30 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}
                                                                title="Enviar todos los huéspedes de este alquiler en una sola comunicación oficial a la policía (SES.HOSPEDAJES)"
                                                            >
                                                                <Send className="h-3.5 w-3.5 mr-1" />
                                                                {isSubmittingThis ? "Tramitando..." : group.estadoSES === "REGISTRADO" ? "Reenviar SES" : "Enviar a Policía (SES)"}
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleExportJSON(group.viajeros)}
                                                                className="h-8 text-xs font-bold rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                                                                title="Descargar fichero JSON oficial con todos los huéspedes de este alquiler (RD 933/2021)"
                                                            >
                                                                <FileDown className="h-3.5 w-3.5 mr-1" /> JSON
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDownloadXML(group.viajeros, group.vivienda)}
                                                                className="h-8 text-xs font-bold rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
                                                                title="Descargar fichero XML oficial (altaReservaHospedaje.xsd / RD 933/2021) para inspección o subida web"
                                                            >
                                                                <FileCode className="h-3.5 w-3.5 mr-1" /> XML Oficial
                                                            </Button>

                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => toggleReservaExpand(group.key)}
                                                                className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
                                                                title={isExpanded ? "Ocultar huéspedes" : "Ver huéspedes"}
                                                            >
                                                                {isExpanded ? "Ocultar" : `Ver (${count})`}
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>

                                                {/* DESPLEGABLE: LISTADO DE VIAJEROS DEL ALQUILER */}
                                                {isExpanded && (
                                                    <TableRow className="bg-muted/15 border-b border-primary/10">
                                                        <TableCell colSpan={6} className="p-0">
                                                            <div className="p-4 pl-12 pr-6 space-y-3 bg-gradient-to-b from-muted/20 to-transparent">
                                                                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Users className="h-4 w-4 text-indigo-500" />
                                                                        <span className="text-xs font-bold text-foreground">
                                                                            Huéspedes registrados en este alquiler ({count})
                                                                        </span>
                                                                        <span className="text-[11px] text-muted-foreground font-normal">
                                                                            — Se comunican juntos en el mismo parte oficial
                                                                        </span>
                                                                    </div>
                                                                    {count > 1 && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleDownloadAllPDFs(group.viajeros, group.vivienda)}
                                                                            className="h-7 text-[11px] font-bold text-primary hover:bg-primary/10"
                                                                        >
                                                                            <Download className="h-3 w-3 mr-1" /> Descargar todos los Partes PDF
                                                                        </Button>
                                                                    )}
                                                                </div>

                                                                <div className="grid gap-2">
                                                                    {group.viajeros.map((v, vIdx) => (
                                                                        <div 
                                                                            key={v.id} 
                                                                            className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/60 hover:border-primary/20 shadow-xs transition-colors"
                                                                        >
                                                                            <div className="flex items-start md:items-center gap-3">
                                                                                <div className={`p-2 rounded-xl text-xs font-black ${v.parentesco === 'TITULAR' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>
                                                                                    {vIdx + 1}
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-bold text-xs text-foreground">
                                                                                            {v.nombre} {v.primer_apellido} {v.segundo_apellido || ""}
                                                                                        </span>
                                                                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${v.parentesco === 'TITULAR' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50' : 'bg-muted text-muted-foreground'}`}>
                                                                                            {v.parentesco || (vIdx === 0 ? "TITULAR" : "ACOMPAÑANTE")}
                                                                                        </span>
                                                                                        {v.firma && (
                                                                                            <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 font-bold">
                                                                                                ✓ Firmado
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                                                                                        <span className="font-mono font-bold text-foreground">
                                                                                            {v.tipo_documento || "DNI"}: {v.numero_documento}
                                                                                        </span>
                                                                                        {v.numero_soporte && <span>(Soporte: {v.numero_soporte})</span>}
                                                                                        <span>• {v.nacionalidad || "ESP"}</span>
                                                                                        <span>• Nac: {v.fecha_nacimiento ? format(parseISO(v.fecha_nacimiento), "dd/MM/yyyy") : "-"}</span>
                                                                                        {v.telefono && <span>• Tel: {v.telefono}</span>}
                                                                                        {v.email && <span>• {v.email}</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => handleEditViajero(v)}
                                                                                    className="h-7 text-xs font-bold rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                                                                                    title="Modificar datos o corregir documento del viajero"
                                                                                >
                                                                                    <Pencil className="h-3 w-3 mr-1" /> Editar
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() => handleDownloadPDF(v)}
                                                                                    className="h-7 text-xs font-bold rounded-lg border-primary/20 text-primary hover:bg-primary/10"
                                                                                    title="Descargar Parte Oficial en PDF individual para firma o archivo"
                                                                                >
                                                                                    <FileText className="h-3 w-3 mr-1" /> Parte PDF
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={() => handleDeleteViajero(v.id)}
                                                                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 rounded-lg"
                                                                                    title="Eliminar este viajero"
                                                                                >
                                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    {groupedReservas.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground font-medium">
                                                No hay huéspedes registrados en el sistema. Pulsa en <strong>&quot;Registrar Nuevo Huésped&quot;</strong> para dar de alta el primer parte o envía el enlace de check-in a tus clientes.
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
                                    {editingViajeroId ? "Modificar Datos del Huésped / Viajero" : "Registro Oficial de Huésped (RD 933/2021)"}
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
                                        <Input 
                                            placeholder={viajeroForm.tipo_documento === "NIE" ? "Ej: X1234567A" : "Ej: 12345678Z"} 
                                            value={viajeroForm.numero_documento} 
                                            onChange={e => setViajeroForm({ ...viajeroForm, numero_documento: e.target.value.toUpperCase() })} 
                                        />
                                        {viajeroForm.tipo_documento === 'NIE' && viajeroForm.numero_documento && (() => {
                                            const exp = getExpectedNieLetter(viajeroForm.numero_documento);
                                            const curr = viajeroForm.numero_documento.trim().toUpperCase().slice(-1);
                                            if (exp && curr && exp !== curr) {
                                                return (
                                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-1 rounded border border-amber-500/20 flex items-center justify-between mt-1">
                                                        <span>⚠️ Letra calculada: <strong>{exp}</strong> (indicada: {curr})</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const clean = viajeroForm.numero_documento.trim().toUpperCase();
                                                                setViajeroForm({
                                                                    ...viajeroForm,
                                                                    numero_documento: clean.slice(0, -1) + exp
                                                                });
                                                            }}
                                                            className="underline font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-80 ml-1"
                                                        >
                                                            Cambiar a {exp}
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                        {viajeroForm.tipo_documento === 'DNI' && viajeroForm.numero_documento && (() => {
                                            const exp = getExpectedDniLetter(viajeroForm.numero_documento);
                                            const curr = viajeroForm.numero_documento.trim().toUpperCase().slice(-1);
                                            if (exp && curr && exp !== curr) {
                                                return (
                                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-1 rounded border border-amber-500/20 flex items-center justify-between mt-1">
                                                        <span>⚠️ Letra calculada: <strong>{exp}</strong> (indicada: {curr})</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const clean = viajeroForm.numero_documento.trim().toUpperCase();
                                                                setViajeroForm({
                                                                    ...viajeroForm,
                                                                    numero_documento: clean.slice(0, -1) + exp
                                                                });
                                                            }}
                                                            className="underline font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-80 ml-1"
                                                        >
                                                            Cambiar a {exp}
                                                        </button>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
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
                                        <Input 
                                            placeholder="ESP / España, ROU / Rumanía..." 
                                            value={viajeroForm.nacionalidad || "ESP"} 
                                            list="tramites-nacionalidades-list"
                                            onChange={e => setViajeroForm({ ...viajeroForm, nacionalidad: e.target.value })} 
                                        />
                                        <datalist id="tramites-nacionalidades-list">
                                            {COMMON_NATIONALITIES.map(n => (
                                                <option key={n.code} value={n.code}>{n.label}</option>
                                            ))}
                                        </datalist>
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
                                        {editingViajeroId ? "Guardar Cambios" : "Guardar Huésped"}
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
