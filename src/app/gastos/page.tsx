"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, ReceiptEuro, Pencil, X, AlertTriangle, UploadCloud, FileSearch, Sparkles, Check } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// Dynamically import pdfjs will be handled inside useEffect
let pdfjsLib: any = null;

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        vivienda_id: "",
        categoria_id: "",
        fecha: "",
        importe: 0,
        descripcion: "",
        es_anual: false
    });

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recognitionResult, setRecognitionResult] = useState<any | null>(null);
    const [isRecognitionModalOpen, setIsRecognitionModalOpen] = useState(false);

    const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        fetchData();
        // Load pdfjs dist dynamically to avoid SSR issues
        const loadPdfJS = async () => {
            try {
                const pdfjs = await import("pdfjs-dist");
                pdfjsLib = pdfjs;
                // Use unpkg which is more reliable for versioned mjs workers in v5+
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
            } catch (err) {
                console.error("Failed to load pdfjs-dist", err);
            }
        };
        loadPdfJS();
    }, []);

    async function fetchData() {
        const { data: e } = await supabase.from("gastos").select("*, viviendas(nombre), categorias_gastos(nombre)").order("fecha", { ascending: false });
        const { data: v } = await supabase.from("viviendas").select("*");
        const { data: c } = await supabase.from("categorias_gastos").select("*");
        if (e) setExpenses(e);
        if (v) setViviendas(v);
        if (c) setCategorias(c);
    }

    const analyzeInvoice = async (file: File) => {
        if (!pdfjsLib) return toast.error("Cargando motor de PDF...");
        setIsAnalyzing(true);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                try {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(" ");
                    fullText += pageText + " ";
                } catch (pageErr) {
                    console.warn(`Error reading page ${i}`, pageErr);
                }
            }

            // Detect if it's an image-only PDF
            if (!fullText.trim()) {
                const manualResult = {
                    importe: 0,
                    fecha: format(new Date(), "yyyy-MM-dd"),
                    categoria_id: "",
                    vivienda_id: "",
                    descripcion: `Factura: ${file.name.split('.')[0]}`,
                    es_anual: false
                };
                setRecognitionResult(manualResult);
                setIsRecognitionModalOpen(true);
                return toast.info("El PDF parece ser una imagen (escaneado). Por favor, introduce los datos manualmente en el panel.");
            }

            // HEURISTIC RECOGNITION (Simulation of AI extraction)
            const text = fullText.toUpperCase();

            // 1. Importer recognition (Look for numbers followed by € or after "TOTAL", "IMPORTE")
            let importe = 0;
            // Common regex for prices in Spain: 1.234,56 or 1234,56
            const importeMatch = text.match(/(?:TOTAL|IMPORTE|PAGAR|LIQUIDO|SOMA).*?(\d+(?:[.,]\d{3})*[.,]\d{2})/i) ||
                text.match(/(\d+(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)/i);

            if (importeMatch) {
                // Sanitize: remove thousands dots, replace decimal comma with dot
                let cleanImporte = importeMatch[1].replace(/\.(?=\d{3})/g, '').replace(',', '.');
                importe = parseFloat(cleanImporte);
            }

            // 2. Date recognition (Look for dd/mm/yyyy or yyyy-mm-dd)
            let fecha = format(new Date(), "yyyy-MM-dd");
            const dateMatch = text.match(/(\d{2})[/-](\d{2})[/-](\d{4})/) || text.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
            if (dateMatch) {
                if (dateMatch[3]?.length === 4) { // dd/mm/yyyy or dd-mm-yyyy
                    fecha = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                } else if (dateMatch[1]?.length === 4) { // yyyy/mm/dd
                    fecha = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                }
            }

            // 3. Category recognition (Keyword check)
            let catId = "";
            const categoriesLower = categorias.map(c => ({ id: c.id, name: c.nombre.toUpperCase() }));
            for (const cat of categoriesLower) {
                if (text.includes(cat.name)) {
                    catId = cat.id;
                    break;
                }
            }

            // Intelligence fallback
            if (!catId) {
                if (text.includes("LUZ") || text.includes("ELECTRICA") || text.includes("ENDESA") || text.includes("IBERDROLA") || text.includes("NATURGY")) {
                    catId = categorias.find(c => c.nombre.toUpperCase().includes("LUZ"))?.id || "";
                } else if (text.includes("AGUA") || text.includes("CANAL") || text.includes("EMASESA")) {
                    catId = categorias.find(c => c.nombre.toUpperCase().includes("AGUA"))?.id || "";
                } else if (text.includes("LIMPIEZA") || text.includes("CLEANING") || text.includes("SERVICE")) {
                    catId = categorias.find(c => c.nombre.toUpperCase().includes("LIMPIEZA"))?.id || "";
                } else if (text.includes("IBI") || text.includes("IMPUESTO") || text.includes("SUMA")) {
                    catId = categorias.find(c => c.nombre.toUpperCase().includes("IBI"))?.id || "";
                }
            }

            const recognized = {
                importe,
                fecha,
                categoria_id: catId,
                vivienda_id: "",
                descripcion: `Factura: ${file.name.split('.')[0]}`,
                es_anual: false
            };

            setRecognitionResult(recognized);
            setIsRecognitionModalOpen(true);
            toast.success("Factura analizada con éxito");

        } catch (error) {
            console.error("Error analyzing PDF:", error);
            toast.error("No se pudo leer el PDF. Asegúrate de que no esté protegido.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    async function handleSubmit(data: any = formData) {
        if (!data.categoria_id || !data.fecha || data.importe <= 0) {
            return toast.error("Por favor rellena los campos obligatorios (Categoría, Fecha e Importe)");
        }

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from("gastos")
                .update({
                    vivienda_id: data.vivienda_id || null,
                    categoria_id: data.categoria_id,
                    fecha: data.fecha,
                    importe: data.importe,
                    descripcion: data.descripcion,
                    es_anual: data.es_anual
                })
                .eq("id", editingId);
            error = updateError;
        } else if (data.es_anual) {
            const baseDate = parseISO(data.fecha);
            if (!isValid(baseDate)) return toast.error("Fecha no válida");
            const startYear = baseDate.getFullYear();
            const startMonth = baseDate.getMonth();
            const monthlyImport = Number((data.importe / 12).toFixed(2));

            const entries = Array.from({ length: 12 }, (_, i) => {
                const date = new Date(startYear, startMonth + i, 1);
                return {
                    vivienda_id: data.vivienda_id || null,
                    categoria_id: data.categoria_id,
                    fecha: format(date, "yyyy-MM-dd"),
                    importe: monthlyImport,
                    descripcion: `${data.descripcion} (${i + 1}/12)`,
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
                    ...data,
                    vivienda_id: data.vivienda_id || null
                }]);
            error = insertError;
        }

        if (error) {
            console.error(error);
            toast.error("Error al guardar el gasto");
        } else {
            toast.success(editingId ? "Gasto actualizado" : (data.es_anual ? "Gastos anuales registrados (12 meses)" : "Gasto registrado"));
            resetForm();
            setIsRecognitionModalOpen(false);
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Gestión de Gastos</h1>
                    <p className="text-muted-foreground text-sm sm:text-base italic">Escanea, reconoce y automatiza tus costes operativos.</p>
                </div>

                {/* PDF UPLOAD BUTTON */}
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) analyzeInvoice(file);
                            e.target.value = ''; // Reset for same file selection
                        }}
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isAnalyzing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 rounded-xl shadow-indigo-500/20 shadow-lg px-6 transition-all hover:scale-105 active:scale-95"
                    >
                        {isAnalyzing ? (
                            <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full mr-2" /> Reconociendo...</>
                        ) : (
                            <><UploadCloud className="mr-2 h-5 w-5" /> Subir Factura PDF</>
                        )}
                    </Button>
                </div>
            </div>

            <Card className={`${editingId ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-100 shadow-xl"} transition-all overflow-hidden`}>
                <CardHeader className={editingId ? "bg-blue-50/50" : "bg-slate-50/50"}>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800">
                            {editingId ? <Pencil className="h-5 w-5 text-blue-500" /> : <ReceiptEuro className="h-5 w-5 text-indigo-600" />}
                            {editingId ? "Editar Entrada" : "Digitalizar Gasto"}
                        </div>
                        {editingId && (
                            <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                                <X className="h-4 w-4 mr-1" /> Cancelar
                            </Button>
                        )}
                    </CardTitle>
                    <CardDescription>Completa los datos para el balance fiscal.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-end">
                    <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Vivienda</Label>
                        <Select value={formData.vivienda_id || "general"} onValueChange={(v) => setFormData({ ...formData, vivienda_id: v === "general" ? "" : v })}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="General / Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">General / Todas</SelectItem>
                                {viviendas.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Categoría</Label>
                        <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                            <SelectContent>
                                {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Fecha Factura</Label>
                        <Input type="date" className="h-11" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Importe (€)</Label>
                        <Input type="number" className="h-11 font-bold text-slate-900" value={formData.importe} onChange={e => setFormData({ ...formData, importe: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Descripción</Label>
                        <Input placeholder="Ej: Factura luz Enero" className="h-11" value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} />
                    </div>

                    <div className="lg:col-span-4 flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                id="es_anual_main"
                                className="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={formData.es_anual}
                                onChange={e => setFormData({ ...formData, es_anual: e.target.checked })}
                            />
                            <div>
                                <Label htmlFor="es_anual_main" className="text-sm font-bold text-slate-700 cursor-pointer">
                                    Reparto Anual Automático
                                </Label>
                                <p className="text-[10px] text-muted-foreground">Divide el importe en 12 meses (desde la fecha seleccionada)</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => handleSubmit()}
                            variant={editingId ? "default" : "secondary"}
                            className={`h-11 px-8 rounded-xl font-bold ${!editingId ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`}
                        >
                            {editingId ? "Guardar" : "Añadir Gasto"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-bold">Fecha</TableHead>
                            <TableHead className="font-bold">Vivienda</TableHead>
                            <TableHead className="font-bold">Categoría</TableHead>
                            <TableHead className="font-bold">Descripción</TableHead>
                            <TableHead className="text-right font-bold text-slate-800">Importe</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {expenses.map((e) => (
                            <TableRow key={e.id} className={`${editingId === e.id ? "bg-blue-50/50" : "hover:bg-slate-50/50"} transition-colors`}>
                                <TableCell className="font-semibold text-slate-600">{format(parseISO(e.fecha), "dd MMM yyyy", { locale: es })}</TableCell>
                                <TableCell>
                                    {e.viviendas?.nombre ? (
                                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase">{e.viviendas.nombre}</span>
                                    ) : (
                                        <span className="text-slate-400 italic text-xs">Global</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{e.categorias_gastos?.nombre}</TableCell>
                                <TableCell className="text-sm text-slate-500">{e.descripcion}</TableCell>
                                <TableCell className="text-right text-rose-600 font-black">-{Number(e.importe).toFixed(2)}€</TableCell>
                                <TableCell>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(e)} className="hover:bg-blue-50"><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(e)} className="hover:bg-rose-50"><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {expenses.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground bg-white">
                        <FileSearch className="h-10 w-10 mx-auto opacity-20 mb-4" />
                        <p>No hay gastos registrados en el historial.</p>
                    </div>
                )}
            </div>

            {/* RECOGNITION MODAL */}
            <Dialog open={isRecognitionModalOpen} onOpenChange={setIsRecognitionModalOpen}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                            <Sparkles className="h-6 w-6 text-indigo-600" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-slate-900">Factura Detectada</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            He analizado el PDF y he encontrado la siguiente información. Por favor, confirma si es correcta.
                        </DialogDescription>
                    </DialogHeader>

                    {recognitionResult && (
                        <div className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Importe</Label>
                                    <p className="text-2xl font-black text-slate-900">{recognitionResult.importe.toFixed(2)}€</p>
                                </div>
                                <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <Label className="text-[10px] font-bold uppercase text-slate-400">Fecha</Label>
                                    <p className="text-lg font-bold text-slate-700">{recognitionResult.fecha}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid gap-2">
                                    <Label className="text-xs font-bold text-slate-600">Categoría Propuesta</Label>
                                    <Select
                                        value={recognitionResult.categoria_id}
                                        onValueChange={(v) => setRecognitionResult({ ...recognitionResult, categoria_id: v })}
                                    >
                                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Categoría..." /></SelectTrigger>
                                        <SelectContent>
                                            {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid gap-2">
                                    <Label className="text-xs font-bold text-slate-600">Asignar a Vivienda</Label>
                                    <Select
                                        value={recognitionResult.vivienda_id || "general"}
                                        onValueChange={(v) => setRecognitionResult({ ...recognitionResult, vivienda_id: v === "general" ? "" : v })}
                                    >
                                        <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Propiedad..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">Gasto General</SelectItem>
                                            {viviendas.map(v => <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="es_anual_modal"
                                            className="h-5 w-5 rounded-md border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={recognitionResult.es_anual}
                                            onChange={e => setRecognitionResult({ ...recognitionResult, es_anual: e.target.checked })}
                                        />
                                        <div>
                                            <Label htmlFor="es_anual_modal" className="text-xs font-black text-indigo-900 cursor-pointer flex items-center gap-1">
                                                ¿Repercutir anualmente? <Sparkles className="h-3 w-3 fill-indigo-400 text-indigo-400" />
                                            </Label>
                                            <p className="text-[10px] text-indigo-600 font-medium">Dividirá el gasto en 12 mensualidades automáticamente.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setIsRecognitionModalOpen(false)} className="rounded-xl font-bold">Descartar</Button>
                        <Button
                            onClick={() => handleSubmit(recognitionResult)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 h-12 rounded-xl shadow-lg shadow-indigo-500/20"
                        >
                            <Check className="h-5 w-5 mr-2" /> Confirmar y Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="rounded-2xl">
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
                        <p className="text-sm font-bold text-slate-800">{expenseToDelete?.descripcion}</p>
                        <p className="text-xs text-muted-foreground">Importe mensual: {Number(expenseToDelete?.importe).toFixed(2)}€</p>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="sm:mr-auto rounded-xl">Cancelar</Button>
                        <Button variant="secondary" onClick={() => confirmDelete("single")} className="rounded-xl">Solo este mes</Button>
                        <Button variant="destructive" onClick={() => confirmDelete("all")} className="rounded-xl font-bold">Todo el reparto (12 meses)</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
