"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ReceiptEuro } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        vivienda_id: "",
        categoria_id: "",
        fecha: "",
        importe: 0,
        descripcion: ""
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const { data: e } = await supabase.from("gastos").select("*, viviendas(nombre), categorias_gastos(nombre)").order("fecha", { ascending: false });
        const { data: v } = await supabase.from("viviendas").select("*");
        const { data: c } = await supabase.from("categorias_gastos").select("*");
        if (e) setExpenses(e);
        if (v) setViviendas(v);
        if (c) setCategorias(c);
    }

    async function handleSubmit() {
        if (!formData.vivienda_id || !formData.categoria_id || !formData.fecha || formData.importe <= 0) {
            return toast.error("Por favor rellena todos los campos obligatorios");
        }

        const { error } = await supabase.from("gastos").insert([formData]);
        if (error) toast.error("Error al registrar el gasto");
        else {
            toast.success("Gasto registrado");
            setFormData({ vivienda_id: "", categoria_id: "", fecha: "", importe: 0, descripcion: "" });
            fetchData();
        }
    }

    async function deleteExpense(id: string) {
        const { error } = await supabase.from("gastos").delete().eq("id", id);
        if (error) toast.error("Error al eliminar");
        else {
            toast.success("Eliminado");
            fetchData();
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Gestión de Gastos</h1>
                <p className="text-muted-foreground">Control de facturas y costes operativos.</p>
            </div>

            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptEuro className="h-5 w-5" /> Nuevo Gasto</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
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
                        <Label>Categoría</Label>
                        <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                            <SelectContent>
                                {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Fecha</Label>
                        <Input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Importe (€)</Label>
                        <Input type="number" value={formData.importe} onChange={e => setFormData({ ...formData, importe: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Descripción</Label>
                        <Input placeholder="Ej: Factura luz Enero" value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} />
                    </div>
                    <Button onClick={handleSubmit} className="lg:col-span-5"><Plus className="h-4 w-4 mr-2" /> Registrar Gasto</Button>
                </CardContent>
            </Card>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Vivienda</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Importe</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expenses.map((e) => (
                            <TableRow key={e.id}>
                                <TableCell>{format(parseISO(e.fecha), "dd MMM yyyy", { locale: es })}</TableCell>
                                <TableCell>{e.viviendas?.nombre}</TableCell>
                                <TableCell>{e.categorias_gastos?.nombre}</TableCell>
                                <TableCell>{e.descripcion}</TableCell>
                                <TableCell className="text-right text-red-500 font-medium">-{Number(e.importe).toFixed(2)}€</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => deleteExpense(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {expenses.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay gastos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
