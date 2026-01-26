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
import { Plus, Trash2, ReceiptEuro, Pencil, X, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        vivienda_id: "",
        categoria_id: "",
        fecha: "",
        importe: 0,
        descripcion: "",
        es_anual: false
    });

    const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
        if (!formData.categoria_id || !formData.fecha || formData.importe <= 0) {
            return toast.error("Por favor rellena los campos obligatorios (Categoría, Fecha e Importe)");
        }

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from("gastos")
                .update({
                    vivienda_id: formData.vivienda_id,
                    categoria_id: formData.categoria_id,
                    fecha: formData.fecha,
                    importe: formData.importe,
                    descripcion: formData.descripcion,
                    es_anual: formData.es_anual
                })
                .eq("id", editingId);
            error = updateError;
        } else if (formData.es_anual) {
            // Reparto anual: crear 12 registros
            const baseDate = parseISO(formData.fecha);
            const year = baseDate.getFullYear();
            const monthlyImport = Number((formData.importe / 12).toFixed(2));

            const entries = Array.from({ length: 12 }, (_, i) => {
                const month = (i + 1).toString().padStart(2, '0');
                return {
                    vivienda_id: formData.vivienda_id || null,
                    categoria_id: formData.categoria_id,
                    fecha: `${year}-${month}-01`,
                    importe: monthlyImport,
                    descripcion: `${formData.descripcion} (Reparto ${i + 1}/12)`,
                    es_anual: true
                };
            });

            const { error: insertError } = await supabase
                .from("gastos")
                .insert(entries);
            error = insertError;
        } else {
            const { error: insertError } = await supabase
                .from("gastos")
                .insert([{
                    ...formData,
                    vivienda_id: formData.vivienda_id || null
                }]);
            error = insertError;
        }

        if (error) toast.error("Error al guardar el gasto");
        else {
            toast.success(editingId ? "Gasto actualizado" : (formData.es_anual ? "Gastos anuales registrados (12 meses)" : "Gasto registrado"));
            resetForm();
            fetchData();
        }
    }

    function resetForm() {
        const defaultVivienda = viviendas.length === 1 ? viviendas[0].id : "";
        setEditingId(null);
        setFormData({ vivienda_id: defaultVivienda, categoria_id: "", fecha: "", importe: 0, descripcion: "", es_anual: false });
    }

    function handleEdit(expense: any) {
        setEditingId(expense.id);
        setFormData({
            vivienda_id: expense.vivienda_id || "",
            categoria_id: expense.categoria_id,
            fecha: expense.fecha,
            importe: expense.importe,
            descripcion: expense.descripcion || "",
            es_anual: expense.es_anual || false
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function deleteExpense(expense: any) {
        if (expense.es_anual) {
            setExpenseToDelete(expense);
            setIsDeleteDialogOpen(true);
        } else {
            if (!confirm("¿Seguro que quieres eliminar este gasto?")) return;
            const { error } = await supabase.from("gastos").delete().eq("id", expense.id);
            if (error) toast.error("Error al eliminar");
            else {
                toast.success("Eliminado");
                fetchData();
            }
        }
    }

    async function confirmDelete(mode: "single" | "all") {
        if (!expenseToDelete) return;

        let query = supabase.from("gastos").delete();

        if (mode === "single") {
            query = query.eq("id", expenseToDelete.id);
        } else {
            query = query
                .eq("es_anual", true)
                .eq("created_at", expenseToDelete.created_at)
                .eq("categoria_id", expenseToDelete.categoria_id);
        }

        const { error } = await query;
        setIsDeleteDialogOpen(false);
        setExpenseToDelete(null);

        if (error) toast.error("Error al eliminar");
        else {
            toast.success(mode === "single" ? "Gasto eliminado" : "Reparto completo eliminado");
            fetchData();
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestión de Gastos</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Control de facturas y costes operativos.</p>
            </div>

            <Card className={editingId ? "border-blue-500 ring-1 ring-blue-500" : ""}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {editingId ? <Pencil className="h-5 w-5 text-blue-500" /> : <ReceiptEuro className="h-5 w-5" />}
                            {editingId ? "Editar Gasto" : "Nuevo Gasto"}
                        </div>
                        {editingId && (
                            <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4 mr-1" /> Cancelar Edición
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
                    <div className="grid gap-2">
                        <Label>Vivienda</Label>
                        <Select value={formData.vivienda_id || "general"} onValueChange={(v) => setFormData({ ...formData, vivienda_id: v === "general" ? "" : v })}>
                            <SelectTrigger><SelectValue placeholder="General / Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">General / Todas</SelectItem>
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
                    {!editingId && (
                        <div className="flex items-center space-x-2 pb-2">
                            <input
                                type="checkbox"
                                id="es_anual"
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                checked={formData.es_anual}
                                onChange={e => setFormData({ ...formData, es_anual: e.target.checked })}
                            />
                            <Label htmlFor="es_anual" className="text-sm font-normal cursor-pointer">
                                Repartir importe anualmente (12 meses)
                            </Label>
                        </div>
                    )}
                    <Button onClick={handleSubmit} variant={editingId ? "default" : "secondary"} className="lg:col-span-1 w-full">
                        {editingId ? "Guardar" : "Registrar"}
                    </Button>
                </CardContent>
            </Card>

            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Vivienda</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Importe</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expenses.map((e) => (
                            <TableRow key={e.id} className={editingId === e.id ? "bg-muted/50" : ""}>
                                <TableCell>{format(parseISO(e.fecha), "dd MMM yyyy", { locale: es })}</TableCell>
                                <TableCell>{e.viviendas?.nombre || <span className="text-muted-foreground italic">General</span>}</TableCell>
                                <TableCell>{e.categorias_gastos?.nombre}</TableCell>
                                <TableCell>{e.descripcion}</TableCell>
                                <TableCell className="text-right text-red-500 font-medium">-{Number(e.importe).toFixed(2)}€</TableCell>
                                <TableCell className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => deleteExpense(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Eliminar Gasto Repartido
                        </DialogTitle>
                        <DialogDescription>
                            Este gasto forma parte de un reparto anual. ¿Qué deseas eliminar?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm font-medium">{expenseToDelete?.descripcion}</p>
                        <p className="text-xs text-muted-foreground">Importe: {Number(expenseToDelete?.importe).toFixed(2)}€</p>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="sm:mr-auto">Cancelar</Button>
                        <Button variant="secondary" onClick={() => confirmDelete("single")}>Solo este registro</Button>
                        <Button variant="destructive" onClick={() => confirmDelete("all")}>Todo el reparto (12 meses)</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
