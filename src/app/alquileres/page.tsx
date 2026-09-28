"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Trash2, Download, Calculator, Pencil, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, FileText, ShieldCheck, Share2, Copy, MessageCircle, Send, CheckCircle2 } from "lucide-react";
import { addDays, differenceInDays, format, parseISO, startOfDay } from "date-fns";
import { PlatformLogo } from "@/components/platform-logo";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function RentalsPage() {
    const [rentals, setRentals] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showZeroPrice, setShowZeroPrice] = useState(false);
    const [isComisionManual, setIsComisionManual] = useState(false);
    const [sortColumn, setSortColumn] = useState<string | null>("entrada");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const [formData, setFormData] = useState({
        vivienda_id: "",
        plataforma_id: "",
        fecha_entrada: "",
        fecha_salida: "",
        precio_bruto: 0,
        comision_valor: 0,
        precio_neto: 0,
        noches: 0,
        precio_medio_diario: 0,
        comentarios: "",
        fecha_peticion: "",
        dias_antelacion: 0
    });

    // Receipt Dialog state
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [activeRentalForReceipt, setActiveRentalForReceipt] = useState<any>(null);
    const [clientData, setClientData] = useState({
        nombre: "",
        dni: "",
        direccion: "",
        fecha_recibo: format(new Date(), "yyyy-MM-dd")
    });

    // Check-in Dialog state
    const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
    const [activeRentalForCheckin, setActiveRentalForCheckin] = useState<any>(null);
    const [viajerosByRental, setViajerosByRental] = useState<Record<string, any[]>>({});
    const [transmittingRentalId, setTransmittingRentalId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const { data: r } = await supabase.from("alquileres").select("*, viviendas(*), plataformas(nombre)").order("fecha_entrada", { ascending: false });
        const { data: v } = await supabase.from("viviendas").select("*");
        const { data: p } = await supabase.from("plataformas").select("*");
        const { data: vi } = await supabase.from("viajeros").select("id, alquiler_id, estado_ses, nombre, primer_apellido, tipo_documento, numero_documento, fecha_nacimiento, nacionalidad, parentesco, fecha_entrada, fecha_salida");

        if (r) setRentals(r);
        if (v) setViviendas(v);
        if (p) setPlataformas(p);

        if (vi) {
            const map: Record<string, any[]> = {};
            vi.forEach(item => {
                if (item.alquiler_id) {
                    if (!map[item.alquiler_id]) map[item.alquiler_id] = [];
                    map[item.alquiler_id].push(item);
                }
            });
            setViajerosByRental(map);
        }
    }

    async function handleQuickTransmitSES(rental: any) {
        const guests = viajerosByRental[rental.id] || [];
        if (guests.length === 0) {
            return toast.info("No hay huéspedes registrados en este alquiler todavía. Comparte el check-in online para que los huéspedes se registren.");
        }

        setTransmittingRentalId(rental.id);
        try {
            const viv = rental.viviendas || viviendas.find(v => v.id === rental.vivienda_id) || {};
            const inmueble = {
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
                    viajeros: guests,
                    inmueble,
                    alquiler: rental
                })
            });

            const data = await res.json();

            if (data.success) {
                const ids = guests.map(g => g.id);
                await supabase
                    .from("viajeros")
                    .update({
                        estado_ses: "REGISTRADO",
                        codigo_comunicacion_ses: data.codigoRegistro
                    })
                    .in("id", ids);

                toast.success(`¡Alquiler comunicado con éxito a SES.HOSPEDAJES! (${guests.length} huésped/es). Acuse: ${data.codigoRegistro}`);
                fetchData();
            } else {
                toast.error(`Error de validación: ${data.message}`);
                if (data.errores && Array.isArray(data.errores)) {
                    data.errores.forEach((err: string) => toast.error(err));
                }
            }
        } catch (err: any) {
            toast.error("Error al conectar con la pasarela SES: " + err.message);
        } finally {
            setTransmittingRentalId(null);
        }
    }

    const filteredRentals = useMemo(() => {
        let filtered = showZeroPrice
            ? rentals.filter(r => Number(r.precio_bruto) === 0)
            : rentals.filter(r => Number(r.precio_bruto) > 0);

        // Aplicar ordenamiento
        if (sortColumn) {
            filtered = [...filtered].sort((a, b) => {
                let aVal: any;
                let bVal: any;

                switch (sortColumn) {
                    case "casa":
                        aVal = a.viviendas?.nombre || "";
                        bVal = b.viviendas?.nombre || "";
                        break;
                    case "plataforma":
                        aVal = a.plataformas?.nombre || "";
                        bVal = b.plataformas?.nombre || "";
                        break;
                    case "entrada":
                        aVal = a.fecha_entrada ? new Date(a.fecha_entrada).getTime() : 0;
                        bVal = b.fecha_entrada ? new Date(b.fecha_entrada).getTime() : 0;
                        break;
                    case "salida":
                        aVal = a.fecha_salida ? new Date(a.fecha_salida).getTime() : 0;
                        bVal = b.fecha_salida ? new Date(b.fecha_salida).getTime() : 0;
                        break;
                    case "noches":
                        aVal = Number(a.noches) || 0;
                        bVal = Number(b.noches) || 0;
                        break;
                    case "bruto":
                        aVal = Number(a.precio_bruto) || 0;
                        bVal = Number(b.precio_bruto) || 0;
                        break;
                    case "comision":
                        aVal = Number(a.comision_valor) || 0;
                        bVal = Number(b.comision_valor) || 0;
                        break;
                    case "neto":
                        aVal = Number(a.precio_neto) || 0;
                        bVal = Number(b.precio_neto) || 0;
                        break;
                    case "peticion":
                        aVal = a.fecha_peticion ? new Date(a.fecha_peticion).getTime() : 0;
                        bVal = b.fecha_peticion ? new Date(b.fecha_peticion).getTime() : 0;
                        break;
                    case "antelacion":
                        aVal = Number(a.dias_antelacion) || 0;
                        bVal = Number(b.dias_antelacion) || 0;
                        break;
                    case "comentarios":
                        aVal = (a.comentarios || "").toLowerCase();
                        bVal = (b.comentarios || "").toLowerCase();
                        break;
                    default:
                        return 0;
                }

                // Comparación según el tipo
                if (typeof aVal === "string" && typeof bVal === "string") {
                    return sortDirection === "asc"
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                } else {
                    return sortDirection === "asc"
                        ? aVal - bVal
                        : bVal - aVal;
                }
            });
        }

        return filtered;
    }, [rentals, showZeroPrice, sortColumn, sortDirection]);

    function handleSort(column: string) {
        if (sortColumn === column) {
            // Si es la misma columna, alternar dirección
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            // Nueva columna, empezar con descendente
            setSortColumn(column);
            setSortDirection("desc");
        }
    }

    // Cálculos automáticos
    useEffect(() => {
        if (formData.fecha_entrada && formData.fecha_salida && formData.precio_bruto >= 0) {
            const entrada = parseISO(formData.fecha_entrada);
            const salida = parseISO(formData.fecha_salida);
            const noches = differenceInDays(salida, entrada);

            if (noches > 0) {
                let comision = formData.comision_valor;

                if (formData.plataforma_id && !isComisionManual) {
                    const plat = plataformas.find(p => p.id === formData.plataforma_id);
                    if (plat) {
                        comision = (formData.precio_bruto * Number(plat.comision_porcentaje)) / 100;
                    }
                }

                const neto = formData.precio_bruto - comision;
                const adr = formData.precio_bruto / noches;

                setFormData(prev => ({
                    ...prev,
                    noches,
                    comision_valor: comision,
                    precio_neto: neto,
                    precio_medio_diario: adr
                }));
            }
        }
    }, [formData.fecha_entrada, formData.fecha_salida, formData.precio_bruto, formData.plataforma_id, isComisionManual, plataformas]);

    // Cálculo de antelación
    useEffect(() => {
        if (formData.fecha_entrada && formData.fecha_peticion) {
            const entrada = parseISO(formData.fecha_entrada);
            const peticion = parseISO(formData.fecha_peticion);
            const antelacion = differenceInDays(entrada, peticion);
            setFormData(prev => ({ ...prev, dias_antelacion: antelacion }));
        }
    }, [formData.fecha_entrada, formData.fecha_peticion]);

    async function handleSubmit() {
        if (!formData.vivienda_id || !formData.plataforma_id || !formData.fecha_entrada || !formData.fecha_salida || formData.precio_bruto < 0) {
            return toast.error("Por favor rellena todos los campos obligatorios (el precio debe ser mayor o igual a 0)");
        }

        // Limpiar datos para evitar errores de tipo en la base de datos (p.ej. strings vacíos en fechas)
        const dataToSave = {
            ...formData,
            fecha_peticion: formData.fecha_peticion || null,
            comentarios: formData.comentarios || null,
        };

        let result;
        if (editingId) {
            result = await supabase
                .from("alquileres")
                .update(dataToSave)
                .eq("id", editingId);
        } else {
            result = await supabase
                .from("alquileres")
                .insert([dataToSave]);
        }

        if (result.error) {
            console.error("Error saving rental:", result.error);
            toast.error(`Error al guardar: ${result.error.message}`);
        } else {
            toast.success(editingId ? "Alquiler actualizado" : "Alquiler registrado con éxito");
            setIsModalOpen(false);
            resetForm();
            fetchData();
        }
    }

    function resetForm() {
        const defaultVivienda = viviendas.length === 1 ? viviendas[0].id : "";
        setEditingId(null);
        setIsComisionManual(false);
        setFormData({
            vivienda_id: defaultVivienda, plataforma_id: "", fecha_entrada: "", fecha_salida: "",
            precio_bruto: 0, comision_valor: 0, precio_neto: 0, noches: 0, precio_medio_diario: 0,
            comentarios: "",
            fecha_peticion: "",
            dias_antelacion: 0
        });
    }

    function handleEdit(rental: any) {
        setEditingId(rental.id);
        setFormData({
            vivienda_id: rental.vivienda_id,
            plataforma_id: rental.plataforma_id,
            fecha_entrada: rental.fecha_entrada,
            fecha_salida: rental.fecha_salida,
            precio_bruto: rental.precio_bruto,
            comision_valor: rental.comision_valor,
            precio_neto: rental.precio_neto || 0,
            noches: rental.noches || 0,
            precio_medio_diario: rental.precio_medio_diario || 0,
            comentarios: rental.comentarios || "",
            fecha_peticion: rental.fecha_peticion || "",
            dias_antelacion: rental.dias_antelacion || 0
        });
        setIsComisionManual(Number(rental.comision_valor) > 0); // Solo bloqueamos si ya había una comisión puesta
        setIsModalOpen(true);
    }

    function handleCreate() {
        resetForm();
        setIsModalOpen(true);
    }

    async function deleteRental(id: string) {
        if (!confirm("¿Estás seguro de eliminar este alquiler?")) return;
        const { error } = await supabase.from("alquileres").delete().eq("id", id);
        if (error) toast.error("Error al eliminar");
        else {
            toast.success("Eliminado correctamente");
            fetchData();
        }
    }

    function exportToExcel() {
        const dataToExport = rentals.map(r => ({
            Casa: r.viviendas?.nombre,
            Plataforma: r.plataformas?.nombre,
            Entrada: r.fecha_entrada,
            Salida: r.fecha_salida,
            Noches: r.noches,
            Bruto: r.precio_bruto,
            Comisión: r.comision_valor,
            Neto: r.precio_neto,
            "Precio diario": r.precio_medio_diario,
            Comentarios: r.comentarios,
            "Fecha Petición": r.fecha_peticion,
            "Antelación (días)": r.dias_antelacion
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Alquileres");
        XLSX.writeFile(wb, "alquileres.xlsx");
    }

    function openReceiptModal(rental: any) {
        setActiveRentalForReceipt(rental);
        setClientData(prev => ({
            ...prev,
            nombre: "",
            dni: "",
            direccion: ""
        }));
        setIsReceiptModalOpen(true);
    }

    const getCheckinUrl = (rentalId: string) => {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/checkin/${rentalId}`;
    };

    const copyCheckinLink = (rental: any) => {
        const url = getCheckinUrl(rental.id);
        navigator.clipboard.writeText(url);
        toast.success("Enlace de check-in copiado al portapapeles");
    };

    const sendWhatsAppCheckin = (rental: any) => {
        const url = getCheckinUrl(rental.id);
        const text = `¡Hola! 👋 Para preparar tu llegada a ${rental.viviendas?.nombre || "la vivienda"}, por favor completa el registro obligatorio de viajeros en este enlace seguro:\n${url}\n¡Muchas gracias!`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    const openCheckinModal = (rental: any) => {
        setActiveRentalForCheckin(rental);
        setIsCheckinModalOpen(true);
    };

    function generatePDF() {
        if (!activeRentalForReceipt) return;

        const doc = new jsPDF();
        const redColor: [number, number, number] = [192, 0, 0]; // Dark red like the image

        // Header Red Bar
        doc.setFillColor(redColor[0], redColor[1], redColor[2]);
        doc.rect(0, 0, 210, 8, "F");

        // Issuer Info
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Ruben Vega", 15, 25);
        doc.setFont("helvetica", "normal");
        doc.text("Cami Omblanc 72 x", 15, 30);

        // Number & Date Info (Top Right Align)
        const receiptNumber = Math.floor(10000 + Math.random() * 90000);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Número: ${receiptNumber}`, 185, 20, { align: "right" });

        doc.text("Fecha", 185, 29, { align: "right" });
        doc.line(170, 31, 200, 31);
        doc.setFont("helvetica", "normal");
        const formattedReceiptDate = format(parseISO(clientData.fecha_recibo), "dd/MM/yy");
        doc.text(formattedReceiptDate, 185, 37, { align: "right" });
        doc.line(170, 43, 200, 43);

        // Client Section
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(redColor[0], redColor[1], redColor[2]);
        doc.text("Cliente", 15, 55);
        doc.line(15, 57, 95, 57);
        doc.line(110, 57, 195, 57);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(clientData.nombre.toUpperCase(), 15, 65);
        doc.text(clientData.dni.toUpperCase(), 15, 72);
        doc.text(clientData.direccion.toUpperCase(), 15, 79);

        // Table
        const entrada = format(parseISO(activeRentalForReceipt.fecha_entrada), "d 'de' MMMM yyyy", { locale: es });
        const salida = format(parseISO(activeRentalForReceipt.fecha_salida), "d 'de' MMMM yyyy", { locale: es });

        autoTable(doc, {
            startY: 95,
            head: [['Descripción', 'Unidades', 'Precio Unitario', 'Precio']],
            body: [
                [`Estancia del ${entrada} al ${salida}`, '1', `${activeRentalForReceipt.precio_bruto.toFixed(2)}`, `${activeRentalForReceipt.precio_bruto.toFixed(2)}`],
                ['', '', '', ''],
                ['', '', '', ''],
                ['', '', '', ''],
                ['IVA — operación exenta', '', '', '0.00'],
            ],
            theme: 'grid',
            headStyles: {
                fillColor: redColor,
                textColor: [255, 255, 255],
                fontSize: 10,
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'right' }
            },
            styles: {
                fontSize: 9,
                cellPadding: 4
            }
        });

        // Total
        const finalY = (doc as any).lastAutoTable.finalY + 2;
        doc.setFont("helvetica", "bold");
        doc.text("Total", 160, finalY + 5, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.text(`${activeRentalForReceipt.precio_bruto.toFixed(2)}`, 195, finalY + 5, { align: "right" });
        doc.line(170, finalY + 7, 200, finalY + 7);

        // Nota legal / Exención de IVA
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        const legalNote = "Operación exenta de IVA en virtud de lo dispuesto en el artículo 20.Uno.23.º de la Ley 37/1992, de 28 de diciembre, del Impuesto sobre el Valor Añadido.";
        const splitLegalNote = doc.splitTextToSize(legalNote, 180);
        doc.text(splitLegalNote, 15, finalY + 25);

        // Footer Red Bar
        doc.setFillColor(redColor[0], redColor[1], redColor[2]);
        doc.rect(0, 287, 210, 10, "F");

        doc.save(`recibo_${activeRentalForReceipt.viviendas?.nombre}_${clientData.nombre.replace(/\s+/g, '_')}.pdf`);
        setIsReceiptModalOpen(false);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestión de Alquileres</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Listado completo y registro de reservas.</p>
                </div>
                <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
                    <Button
                        variant={showZeroPrice ? "destructive" : "outline"}
                        onClick={() => setShowZeroPrice(!showZeroPrice)}
                        className="w-full xs:w-auto text-xs sm:text-sm"
                    >
                        {showZeroPrice ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                        {showZeroPrice ? "Ver Activos" : "Gestionar Sin Precio"}
                    </Button>
                    <Button variant="outline" onClick={exportToExcel} className="w-full xs:w-auto text-xs sm:text-sm"><Download className="h-4 w-4 mr-2" /> Exportar</Button>
                    <Dialog open={isModalOpen} onOpenChange={(open) => {
                        setIsModalOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button onClick={handleCreate} className="w-full xs:w-auto text-xs sm:text-sm"><Plus className="h-4 w-4 mr-2" /> Nuevo Alquiler</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader><DialogTitle>{editingId ? "Editar Alquiler" : "Registrar Alquiler"}</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Vivienda</Label>
                                        <Select value={formData.vivienda_id} onValueChange={(v) => setFormData({ ...formData, vivienda_id: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                            <SelectContent>
                                                {viviendas.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Plataforma</Label>
                                        <Select value={formData.plataforma_id} onValueChange={(v) => {
                                            setFormData({ ...formData, plataforma_id: v });
                                            setIsComisionManual(false); // Forzamos recálculo al cambiar plataforma
                                        }}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                            <SelectContent>
                                                {plataformas.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Fecha Entrada</Label>
                                        <Input type="date" value={formData.fecha_entrada} onChange={e => {
                                            const newEntrada = e.target.value;
                                            let newSalida = formData.fecha_salida;
                                            if (!newSalida || newSalida <= newEntrada) {
                                                const d = new Date(newEntrada);
                                                d.setDate(d.getDate() + 1);
                                                newSalida = d.toISOString().split('T')[0];
                                            }
                                            setFormData({ ...formData, fecha_entrada: newEntrada, fecha_salida: newSalida });
                                        }} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Fecha Salida</Label>
                                        <Input type="date" min={formData.fecha_entrada} value={formData.fecha_salida} onChange={e => setFormData({ ...formData, fecha_salida: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Precio Bruto (€)</Label>
                                        <Input type="number" value={formData.precio_bruto} onChange={e => setFormData({ ...formData, precio_bruto: Number(e.target.value) })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Comisión (€) - Editable</Label>
                                        <Input
                                            type="number"
                                            value={formData.comision_valor}
                                            onChange={e => {
                                                setFormData({ ...formData, comision_valor: Number(e.target.value) });
                                                setIsComisionManual(true);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Fecha Petición / Reserva</Label>
                                    <Input type="date" value={formData.fecha_peticion} onChange={e => setFormData({ ...formData, fecha_peticion: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Comentarios</Label>
                                    <Input placeholder="Notas adicionales..." value={formData.comentarios} onChange={e => setFormData({ ...formData, comentarios: e.target.value })} />
                                </div>
                                <Card className="bg-muted/50 border-dashed">
                                    <CardContent className="pt-6 grid grid-cols-3 gap-4 text-center">
                                        <div><Label className="text-xs uppercase">Noches</Label><div className="text-xl font-bold">{formData.noches}</div></div>
                                        <div><Label className="text-xs uppercase">Antelación</Label><div className="text-xl font-bold">{formData.dias_antelacion}d</div></div>
                                        <div><Label className="text-xs uppercase">Neto</Label><div className="text-xl font-bold text-emerald-600">{formData.precio_neto.toFixed(2)}€</div></div>
                                        <div><Label className="text-xs uppercase">Precio diario</Label><div className="text-xl font-bold">{formData.precio_medio_diario.toFixed(2)}€</div></div>
                                    </CardContent>
                                </Card>
                                <Button onClick={handleSubmit} className="w-full">{editingId ? "Actualizar Alquiler" : "Guardar Reserva"}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("casa")}
                            >
                                <div className="flex items-center gap-2">
                                    Casa
                                    {sortColumn === "casa" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("plataforma")}
                            >
                                <div className="flex items-center gap-2">
                                    Plataforma
                                    {sortColumn === "plataforma" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("entrada")}
                            >
                                <div className="flex items-center gap-2">
                                    Entrada
                                    {sortColumn === "entrada" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("salida")}
                            >
                                <div className="flex items-center gap-2">
                                    Salida
                                    {sortColumn === "salida" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("noches")}
                            >
                                <div className="flex items-center gap-2">
                                    Noches
                                    {sortColumn === "noches" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("bruto")}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Bruto
                                    {sortColumn === "bruto" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="text-right cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("comision")}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Comisión
                                    {sortColumn === "comision" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="text-right font-bold cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("neto")}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Neto
                                    {sortColumn === "neto" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("peticion")}
                            >
                                <div className="flex items-center gap-2">
                                    Petición
                                    {sortColumn === "peticion" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("antelacion")}
                            >
                                <div className="flex items-center gap-2">
                                    Antel.
                                    {sortColumn === "antelacion" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 select-none"
                                onClick={() => handleSort("comentarios")}
                            >
                                <div className="flex items-center gap-2">
                                    Comentarios
                                    {sortColumn === "comentarios" ? (
                                        sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                                    )}
                                </div>
                            </TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRentals.map((r) => {
                            const today = startOfDay(new Date());
                            const tomorrow = addDays(today, 1);
                            const entryDate = r.fecha_entrada ? startOfDay(parseISO(r.fecha_entrada)) : null;
                            // Marcar bruto si entrada es pasada, hoy o queda 1 día (mañana)
                            const shouldHighlightBruto = showZeroPrice && entryDate && entryDate.getTime() <= tomorrow.getTime();
                            return (
                                <TableRow key={r.id}>
                                    <TableCell>{r.viviendas?.nombre}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <PlatformLogo platform={r.plataformas?.nombre} className="h-4 w-4" />
                                            <span className="hidden sm:inline">{r.plataformas?.nombre}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{format(parseISO(r.fecha_entrada), "dd MMM yyyy", { locale: es })}</TableCell>
                                    <TableCell>{format(parseISO(r.fecha_salida), "dd MMM yyyy", { locale: es })}</TableCell>
                                    <TableCell>{r.noches}</TableCell>
                                    <TableCell className={`text-right ${shouldHighlightBruto ? "bg-amber-100 dark:bg-amber-900/40" : ""}`}>{Number(r.precio_bruto).toFixed(2)}€</TableCell>
                                    <TableCell className="text-right">{Number(r.comision_valor).toFixed(2)}€</TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600">{Number(r.precio_neto).toFixed(2)}€</TableCell>
                                    <TableCell>{r.fecha_peticion ? format(parseISO(r.fecha_peticion), "dd/MM/yyyy") : "-"}</TableCell>
                                    <TableCell>{r.dias_antelacion != null ? `${r.dias_antelacion}d` : "-"}</TableCell>
                                    <TableCell className="max-w-[150px] truncate" title={r.comentarios}>{r.comentarios}</TableCell>
                                    <TableCell className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                        {/* Botón rápido SES si hay huéspedes registrados */}
                                        {(() => {
                                            const guests = viajerosByRental[r.id] || [];
                                            if (guests.length > 0) {
                                                const allDone = guests.every(g => g.estado_ses === "REGISTRADO");
                                                if (allDone) {
                                                    return (
                                                        <Link href="/tramites" title={`Comunicado a SES (${guests.length} huéspedes). Ver en Trámites`}>
                                                            <Button size="sm" variant="outline" className="h-8 px-2 border-emerald-500/30 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 font-bold text-xs rounded-xl flex items-center gap-1">
                                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> SES ({guests.length})
                                                            </Button>
                                                        </Link>
                                                    );
                                                } else {
                                                    return (
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleQuickTransmitSES(r)} 
                                                            disabled={transmittingRentalId === r.id}
                                                            className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                                                            title={`Enviar los ${guests.length} huéspedes de este alquiler en una sola comunicación a la policía (SES.HOSPEDAJES)`}
                                                        >
                                                            <Send className="h-3.5 w-3.5" /> 
                                                            {transmittingRentalId === r.id ? "Enviando..." : `Enviar SES (${guests.length})`}
                                                        </Button>
                                                    );
                                                }
                                            }
                                            return (
                                                <Link href="/tramites" title="Parte de Viajeros (SES.HOSPEDAJES / Policía)">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600"><ShieldCheck className="h-4 w-4" /></Button>
                                                </Link>
                                            );
                                        })()}

                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCheckinModal(r)} title="Compartir Check-in Online (WhatsApp/Enlace)"><Share2 className="h-4 w-4 text-indigo-500" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openReceiptModal(r)} title="Generar Recibo"><FileText className="h-4 w-4 text-emerald-600" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(r)} title="Editar Alquiler"><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRental(r.id)} title="Eliminar Alquiler"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredRentals.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                    {showZeroPrice ? "No hay alquileres sin precio pendientes." : "No hay alquileres registrados."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Check-in Share Modal */}
            <Dialog open={isCheckinModalOpen} onOpenChange={setIsCheckinModalOpen}>
                <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-indigo-600">
                            <Share2 className="h-5 w-5" />
                            Check-in Online de Huéspedes
                        </DialogTitle>
                    </DialogHeader>

                    {activeRentalForCheckin && (
                        <div className="space-y-4 py-3 text-xs">
                            <div className="p-3.5 bg-muted/40 rounded-2xl border border-primary/10 space-y-1">
                                <p className="font-bold text-sm text-foreground">{activeRentalForCheckin.viviendas?.nombre}</p>
                                <p className="text-muted-foreground">
                                    Estancia del {format(parseISO(activeRentalForCheckin.fecha_entrada), "d 'de' MMMM", { locale: es })} al {format(parseISO(activeRentalForCheckin.fecha_salida), "d 'de' MMMM yyyy", { locale: es })}
                                </p>
                            </div>

                            <p className="text-muted-foreground leading-relaxed">
                                Envía este enlace a tus huéspedes para que completen sus datos y su firma antes de llegar:
                            </p>

                            <div className="flex gap-2 items-center">
                                <Input
                                    readOnly
                                    value={getCheckinUrl(activeRentalForCheckin.id)}
                                    className="font-mono text-[11px] bg-muted/30"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyCheckinLink(activeRentalForCheckin)}
                                    className="font-bold text-xs shrink-0"
                                >
                                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                                </Button>
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                                <Button
                                    onClick={() => sendWhatsAppCheckin(activeRentalForCheckin)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black h-12 rounded-2xl shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="h-5 w-5" /> Enviar por WhatsApp al Huésped
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => window.open(getCheckinUrl(activeRentalForCheckin.id), "_blank")}
                                    className="w-full text-xs text-muted-foreground"
                                >
                                    Abrir formulario en nueva pestaña
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Receipt Modal */}
            <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Generar Recibo de Pago</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="c-name">Nombre del Cliente</Label>
                            <Input
                                id="c-name"
                                placeholder="JUAN PEREZ GARCIA"
                                value={clientData.nombre}
                                onChange={e => setClientData({ ...clientData, nombre: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-dni">DNI / NIF</Label>
                            <Input
                                id="c-dni"
                                placeholder="12345678X"
                                value={clientData.dni}
                                onChange={e => setClientData({ ...clientData, dni: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-dir">Dirección</Label>
                            <Input
                                id="c-dir"
                                placeholder="CALLE MAYOR 1, MADRID"
                                value={clientData.direccion}
                                onChange={e => setClientData({ ...clientData, direccion: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-date">Fecha del Recibo</Label>
                            <Input
                                id="c-date"
                                type="date"
                                value={clientData.fecha_recibo}
                                onChange={e => setClientData({ ...clientData, fecha_recibo: e.target.value })}
                            />
                        </div>
                        <Card className="bg-slate-50 border-none shadow-none text-xs text-slate-500 p-3 italic">
                            Se generará un recibo por el importe bruto de {activeRentalForReceipt?.precio_bruto.toFixed(2)}€
                            para la estancia en {activeRentalForReceipt?.viviendas?.nombre}.
                        </Card>
                    </div>
                    <Button
                        onClick={generatePDF}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        disabled={!clientData.nombre || !clientData.dni}
                    >
                        Descargar PDF
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}

