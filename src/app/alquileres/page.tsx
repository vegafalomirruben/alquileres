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
import { Plus, Trash2, Download, Calculator, Pencil, Eye, EyeOff } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { PlatformLogo } from "@/components/platform-logo";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

export default function RentalsPage() {
    const [rentals, setRentals] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showZeroPrice, setShowZeroPrice] = useState(false);
    const [isComisionManual, setIsComisionManual] = useState(false);

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

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const { data: r } = await supabase.from("alquileres").select("*, viviendas(nombre), plataformas(nombre)").order("fecha_entrada", { ascending: false });
        const { data: v } = await supabase.from("viviendas").select("*");
        const { data: p } = await supabase.from("plataformas").select("*");
        if (r) setRentals(r);
        if (v) setViviendas(v);
        if (p) setPlataformas(p);
    }

    const filteredRentals = useMemo(() => {
        if (showZeroPrice) {
            return rentals.filter(r => Number(r.precio_bruto) === 0);
        }
        return rentals.filter(r => Number(r.precio_bruto) > 0);
    }, [rentals, showZeroPrice]);

    // Cálculos automáticos
    useEffect(() => {
        if (formData.fecha_entrada && formData.fecha_salida && formData.precio_bruto > 0) {
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
        if (!formData.vivienda_id || !formData.plataforma_id || !formData.fecha_entrada || !formData.fecha_salida || formData.precio_bruto <= 0) {
            return toast.error("Por favor rellena todos los campos obligatorios");
        }

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from("alquileres")
                .update(formData)
                .eq("id", editingId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from("alquileres")
                .insert([formData]);
            error = insertError;
        }

        if (error) toast.error("Error al guardar el alquiler");
        else {
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
                            <TableHead>Casa</TableHead>
                            <TableHead>Plataforma</TableHead>
                            <TableHead>Entrada</TableHead>
                            <TableHead>Salida</TableHead>
                            <TableHead>Noches</TableHead>
                            <TableHead className="text-right">Bruto</TableHead>
                            <TableHead className="text-right">Comisión</TableHead>
                            <TableHead className="text-right font-bold">Neto</TableHead>
                            <TableHead>Petición</TableHead>
                            <TableHead>Antel.</TableHead>
                            <TableHead>Comentarios</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRentals.map((r) => (
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
                                <TableCell className="text-right">{Number(r.precio_bruto).toFixed(2)}€</TableCell>
                                <TableCell className="text-right">{Number(r.comision_valor).toFixed(2)}€</TableCell>
                                <TableCell className="text-right font-bold text-emerald-600">{Number(r.precio_neto).toFixed(2)}€</TableCell>
                                <TableCell>{r.fecha_peticion ? format(parseISO(r.fecha_peticion), "dd/MM/yyyy") : "-"}</TableCell>
                                <TableCell>{r.dias_antelacion != null ? `${r.dias_antelacion}d` : "-"}</TableCell>
                                <TableCell className="max-w-[150px] truncate" title={r.comentarios}>{r.comentarios}</TableCell>
                                <TableCell className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => deleteRental(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
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
        </div>
    );
}

