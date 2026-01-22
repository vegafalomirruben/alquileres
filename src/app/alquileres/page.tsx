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
import { Plus, Trash2, Download, Calculator } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

export default function RentalsPage() {
    const [rentals, setRentals] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    // Cálculos automáticos
    useEffect(() => {
        if (formData.fecha_entrada && formData.fecha_salida && formData.precio_bruto > 0) {
            const entrada = parseISO(formData.fecha_entrada);
            const salida = parseISO(formData.fecha_salida);
            const noches = differenceInDays(salida, entrada);

            if (noches > 0) {
                let comision = formData.comision_valor;

                // Si no se ha editado manualmente la comisión, calculamos según plataforma
                if (formData.plataforma_id && formData.comision_valor === 0) {
                    const plat = plataformas.find(p => p.id === formData.plataforma_id);
                    if (plat) {
                        comision = (formData.precio_bruto * plat.comision_porcentaje) / 100;
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
    }, [formData.fecha_entrada, formData.fecha_salida, formData.precio_bruto, formData.plataforma_id]);

    async function handleSubmit() {
        if (!formData.vivienda_id || !formData.plataforma_id || !formData.fecha_entrada || !formData.fecha_salida || formData.precio_bruto <= 0) {
            return toast.error("Por favor rellena todos los campos obligatorios");
        }

        const { error } = await supabase.from("alquileres").insert([formData]);
        if (error) toast.error("Error al registrar el alquiler");
        else {
            toast.success("Alquiler registrado con éxito");
            setIsModalOpen(false);
            setFormData({
                vivienda_id: "", plataforma_id: "", fecha_entrada: "", fecha_salida: "",
                precio_bruto: 0, comision_valor: 0, precio_neto: 0, noches: 0, precio_medio_diario: 0
            });
            fetchData();
        }
    }

    async function deleteRental(id: string) {
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
            ADR: r.precio_medio_diario
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Alquileres");
        XLSX.writeFile(wb, "alquileres.xlsx");
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Alquileres</h1>
                    <p className="text-muted-foreground">Listado completo y registro de reservas.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={exportToExcel}><Download className="h-4 w-4 mr-2" /> Exportar a Excel</Button>
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="h-4 w-4 mr-2" /> Nuevo Alquiler</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader><DialogTitle>Registrar Alquiler</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Vivienda</Label>
                                        <Select onValueChange={(v) => setFormData({ ...formData, vivienda_id: v })}>
                                            <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                            <SelectContent>
                                                {viviendas.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Plataforma</Label>
                                        <Select onValueChange={(v) => setFormData({ ...formData, plataforma_id: v })}>
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
                                        <Input type="date" value={formData.fecha_entrada} onChange={e => setFormData({ ...formData, fecha_entrada: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Fecha Salida</Label>
                                        <Input type="date" value={formData.fecha_salida} onChange={e => setFormData({ ...formData, fecha_salida: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Precio Bruto (€)</Label>
                                        <Input type="number" value={formData.precio_bruto} onChange={e => setFormData({ ...formData, precio_bruto: Number(e.target.value) })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Comisión (€) - Editable</Label>
                                        <Input type="number" value={formData.comision_valor} onChange={e => setFormData({ ...formData, comision_valor: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <Card className="bg-muted/50 border-dashed">
                                    <CardContent className="pt-6 grid grid-cols-3 gap-4 text-center">
                                        <div><Label className="text-xs uppercase">Noches</Label><div className="text-xl font-bold">{formData.noches}</div></div>
                                        <div><Label className="text-xs uppercase">Neto</Label><div className="text-xl font-bold text-emerald-600">{formData.precio_neto.toFixed(2)}€</div></div>
                                        <div><Label className="text-xs uppercase">ADR</Label><div className="text-xl font-bold">{formData.precio_medio_diario.toFixed(2)}€</div></div>
                                    </CardContent>
                                </Card>
                                <Button onClick={handleSubmit} className="w-full">Guardar Reservas</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="rounded-md border">
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
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rentals.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>{r.viviendas?.nombre}</TableCell>
                                <TableCell>{r.plataformas?.nombre}</TableCell>
                                <TableCell>{format(parseISO(r.fecha_entrada), "dd MMM yyyy", { locale: es })}</TableCell>
                                <TableCell>{format(parseISO(r.fecha_salida), "dd MMM yyyy", { locale: es })}</TableCell>
                                <TableCell>{r.noches}</TableCell>
                                <TableCell className="text-right">{Number(r.precio_bruto).toFixed(2)}€</TableCell>
                                <TableCell className="text-right">{Number(r.comision_valor).toFixed(2)}€</TableCell>
                                <TableCell className="text-right font-bold text-emerald-600">{Number(r.precio_neto).toFixed(2)}€</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => deleteRental(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {rentals.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay alquileres registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
