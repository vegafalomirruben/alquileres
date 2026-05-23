"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Plus, Building, CreditCard, Tag, Pencil, X } from "lucide-react";

export default function ConfigPage() {
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);

    const [newVivienda, setNewVivienda] = useState<{
        nombre: string,
        direccion: string,
        ical_airbnb?: string,
        ical_booking?: string,
        url_airbnb?: string,
        url_booking?: string,
        ref_catastral?: string,
        licencia_turistica?: string,
        nrua?: string,
        cru?: string,
        valor_suelo?: number,
        superficie_construida?: number,
        valor_catastral_construccion?: number,
        valor_catastral_total?: number
    }>({
        nombre: "",
        direccion: "",
        ical_airbnb: "",
        ical_booking: "",
        url_airbnb: "",
        url_booking: "",
        ref_catastral: "",
        licencia_turistica: "",
        nrua: "",
        cru: "",
        valor_suelo: 0,
        superficie_construida: 0,
        valor_catastral_construccion: 0,
        valor_catastral_total: 0
    });
    const [newPlataforma, setNewPlataforma] = useState({ nombre: "", comision_porcentaje: 0 });
    const [newCategoria, setNewCategoria] = useState({ nombre: "" });

    const [editingViviendaId, setEditingViviendaId] = useState<string | null>(null);
    const [editingPlataformaId, setEditingPlataformaId] = useState<string | null>(null);
    const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);


    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const { data: v } = await supabase.from("viviendas").select("*").order("created_at");
        const { data: p } = await supabase.from("plataformas").select("*").order("created_at");
        const { data: c } = await supabase.from("categorias_gastos").select("*").order("created_at");
        if (v) setViviendas(v);
        if (p) setPlataformas(p);
        if (c) setCategorias(c);
    }

    // --- Viviendas ---
    async function addVivienda() {
        if (!newVivienda.nombre) return toast.error("El nombre es obligatorio");

        let error;
        if (editingViviendaId) {
            const { error: updateError } = await supabase.from("viviendas").update(newVivienda).eq("id", editingViviendaId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from("viviendas").insert([newVivienda]);
            error = insertError;
        }

        if (error) {
            console.error("Error saving vivienda:", error);
            toast.error("Error al guardar vivienda: " + error.message);
        } else {
            toast.success(editingViviendaId ? "Vivienda actualizada" : "Vivienda añadida");
            cancelEditVivienda();
            fetchData();
        }
    }

    function editVivienda(v: any) {
        setEditingViviendaId(v.id);
        setNewVivienda({
            nombre: v.nombre,
            direccion: v.direccion || "",
            ical_airbnb: v.ical_airbnb || "",
            ical_booking: v.ical_booking || "",
            url_airbnb: v.url_airbnb || "",
            url_booking: v.url_booking || "",
            ref_catastral: v.ref_catastral || "",
            licencia_turistica: v.licencia_turistica || "",
            nrua: v.nrua || "",
            cru: v.cru || "",
            valor_suelo: v.valor_suelo || 0,
            superficie_construida: v.superficie_construida || 0,
            valor_catastral_construccion: v.valor_catastral_construccion || 0,
            valor_catastral_total: v.valor_catastral_total || 0,
        });
    }

    function cancelEditVivienda() {
        setEditingViviendaId(null);
        setNewVivienda({
            nombre: "",
            direccion: "",
            ical_airbnb: "",
            ical_booking: "",
            url_airbnb: "",
            url_booking: "",
            ref_catastral: "",
            licencia_turistica: "",
            nrua: "",
            cru: "",
            valor_suelo: 0,
            superficie_construida: 0,
            valor_catastral_construccion: 0,
            valor_catastral_total: 0,
        });
    }

    // --- Plataformas ---
    async function addPlataforma() {
        if (!newPlataforma.nombre) return toast.error("El nombre es obligatorio");

        let error;
        if (editingPlataformaId) {
            const { error: updateError } = await supabase.from("plataformas").update(newPlataforma).eq("id", editingPlataformaId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from("plataformas").insert([newPlataforma]);
            error = insertError;
        }

        if (error) toast.error("Error al guardar plataforma");
        else {
            toast.success(editingPlataformaId ? "Plataforma actualizada" : "Plataforma añadida");
            cancelEditPlataforma();
            fetchData();
        }
    }

    function editPlataforma(p: any) {
        setEditingPlataformaId(p.id);
        setNewPlataforma({ nombre: p.nombre, comision_porcentaje: p.comision_porcentaje });
    }

    function cancelEditPlataforma() {
        setEditingPlataformaId(null);
        setNewPlataforma({ nombre: "", comision_porcentaje: 0 });
    }

    // --- Categorias ---
    async function addCategoria() {
        if (!newCategoria.nombre) return toast.error("El nombre es obligatorio");

        let error;
        if (editingCategoriaId) {
            const { error: updateError } = await supabase.from("categorias_gastos").update(newCategoria).eq("id", editingCategoriaId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from("categorias_gastos").insert([newCategoria]);
            error = insertError;
        }

        if (error) toast.error("Error al guardar categoría");
        else {
            toast.success(editingCategoriaId ? "Categoría actualizada" : "Categoría añadida");
            cancelEditCategoria();
            fetchData();
        }
    }

    function editCategoria(c: any) {
        setEditingCategoriaId(c.id);
        setNewCategoria({ nombre: c.nombre });
    }

    function cancelEditCategoria() {
        setEditingCategoriaId(null);
        setNewCategoria({ nombre: "" });
    }


    async function deleteItem(table: string, id: string) {
        if (!confirm("¿Seguro que quieres eliminar este elemento?")) return;
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) toast.error("Error al eliminar item");
        else {
            toast.success("Item eliminado");
            fetchData();
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground">Gestiona tus viviendas, plataformas y categorías de gastos.</p>
            </div>

            <Tabs defaultValue="viviendas" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="viviendas" className="flex gap-2"><Building className="h-4 w-4" /> Viviendas</TabsTrigger>
                    <TabsTrigger value="plataformas" className="flex gap-2"><CreditCard className="h-4 w-4" /> Plataformas</TabsTrigger>
                    <TabsTrigger value="categorias" className="flex gap-2"><Tag className="h-4 w-4" /> Categorías de Gastos</TabsTrigger>
                </TabsList>

                <TabsContent value="viviendas" className="space-y-4">
                    <Card className={editingViviendaId ? "border-blue-500 ring-1 ring-blue-500" : ""}>
                        <CardHeader><CardTitle>{editingViviendaId ? "Editar Vivienda" : "Añadir Nueva Vivienda"}</CardTitle></CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="flex gap-4 items-end">
                                <div className="grid gap-2 flex-1">
                                    <Label htmlFor="vivienda-nombre">Nombre</Label>
                                    <Input id="vivienda-nombre" placeholder="Ej: Villa Sol" value={newVivienda.nombre} onChange={e => setNewVivienda({ ...newVivienda, nombre: e.target.value })} />
                                </div>
                                <div className="grid gap-2 flex-1">
                                    <Label htmlFor="vivienda-dir">Dirección</Label>
                                    <Input id="vivienda-dir" placeholder="Ej: Calle Mayor 123" value={newVivienda.direccion} onChange={e => setNewVivienda({ ...newVivienda, direccion: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-catastral">Ref. Catastral</Label>
                                    <Input id="vivienda-catastral" placeholder="Referencia Catastral" value={newVivienda.ref_catastral} onChange={e => setNewVivienda({ ...newVivienda, ref_catastral: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-licencia">Licencia Turística</Label>
                                    <Input id="vivienda-licencia" placeholder="Licencia Turística" value={newVivienda.licencia_turistica} onChange={e => setNewVivienda({ ...newVivienda, licencia_turistica: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-nrua">NRUA</Label>
                                    <Input id="vivienda-nrua" placeholder="NRUA" value={newVivienda.nrua} onChange={e => setNewVivienda({ ...newVivienda, nrua: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-cru">CRU</Label>
                                    <Input id="vivienda-cru" placeholder="CRU (Cód. Registro)" value={newVivienda.cru} onChange={e => setNewVivienda({ ...newVivienda, cru: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-superficie">Sup. Construida</Label>
                                    <Input id="vivienda-superficie" type="number" placeholder="m²" value={newVivienda.superficie_construida} onChange={e => setNewVivienda({ ...newVivienda, superficie_construida: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-suelo">Valor Suelo</Label>
                                    <Input id="vivienda-suelo" type="number" step="0.01" placeholder="Valor suelo" value={newVivienda.valor_suelo} onChange={e => setNewVivienda({ ...newVivienda, valor_suelo: Number(e.target.value) })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-construccion">V. Catastral Const.</Label>
                                    <Input id="vivienda-construccion" type="number" step="0.01" placeholder="V. catastral construcción" value={newVivienda.valor_catastral_construccion} onChange={e => setNewVivienda({ ...newVivienda, valor_catastral_construccion: Number(e.target.value) })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="vivienda-catastral-total">Valor Catastral</Label>
                                    <Input id="vivienda-catastral-total" type="number" step="0.01" placeholder="Valor catastral total" value={newVivienda.valor_catastral_total} onChange={e => setNewVivienda({ ...newVivienda, valor_catastral_total: Number(e.target.value) })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="ical-airbnb" className="text-xs text-muted-foreground">Airbnb Calendar Link (iCal)</Label>
                                    <Input id="ical-airbnb" placeholder="https://www.airbnb.com/calendar/ical/..." value={newVivienda.ical_airbnb || ""} onChange={e => setNewVivienda({ ...newVivienda, ical_airbnb: e.target.value })} className="font-mono text-xs" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="ical-booking" className="text-xs text-muted-foreground">Booking.com Calendar Link (iCal)</Label>
                                    <Input id="ical-booking" placeholder="https://admin.booking.com/hotel/hoteladmin/ical..." value={newVivienda.ical_booking || ""} onChange={e => setNewVivienda({ ...newVivienda, ical_booking: e.target.value })} className="font-mono text-xs" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="url-airbnb" className="text-xs text-muted-foreground">URL Anuncio Airbnb (Pública)</Label>
                                    <Input id="url-airbnb" placeholder="https://www.airbnb.es/rooms/..." value={newVivienda.url_airbnb || ""} onChange={e => setNewVivienda({ ...newVivienda, url_airbnb: e.target.value })} className="font-mono text-xs" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="url-booking" className="text-xs text-muted-foreground">URL Anuncio Booking (Pública)</Label>
                                    <Input id="url-booking" placeholder="https://www.booking.com/hotel/..." value={newVivienda.url_booking || ""} onChange={e => setNewVivienda({ ...newVivienda, url_booking: e.target.value })} className="font-mono text-xs" />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button onClick={addVivienda}>{editingViviendaId ? "Guardar Cambios" : <><Plus className="h-4 w-4 mr-2" /> Añadir Vivienda</>}</Button>
                                {editingViviendaId && <Button variant="ghost" size="icon" onClick={cancelEditVivienda}><X className="h-4 w-4" /></Button>}
                            </div>
                        </CardContent>
                    </Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Ref. Catastral</TableHead>
                                <TableHead>V. Suelo</TableHead>
                                <TableHead>Sup. Const.</TableHead>
                                <TableHead>V. Const.</TableHead>
                                <TableHead>V. Catastral</TableHead>
                                <TableHead className="w-[100px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {viviendas.map((v) => (
                                <TableRow key={v.id} className={editingViviendaId === v.id ? "bg-muted/50" : ""}>
                                    <TableCell className="font-medium">
                                        <div>{v.nombre}</div>
                                        <div className="text-xs text-muted-foreground">{v.direccion}</div>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{v.ref_catastral}</TableCell>
                                    <TableCell className="text-xs">{v.valor_suelo}€</TableCell>
                                    <TableCell className="text-xs">{v.superficie_construida}m²</TableCell>
                                    <TableCell className="text-xs">{v.valor_catastral_construccion}€</TableCell>
                                    <TableCell className="text-xs font-bold">{v.valor_catastral_total}€</TableCell>
                                    <TableCell className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => editVivienda(v)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteItem("viviendas", v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="plataformas" className="space-y-4">
                    <Card className={editingPlataformaId ? "border-blue-500 ring-1 ring-blue-500" : ""}>
                        <CardHeader><CardTitle>{editingPlataformaId ? "Editar Plataforma" : "Añadir Nueva Plataforma"}</CardTitle></CardHeader>
                        <CardContent className="flex gap-4 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="plat-nombre">Nombre</Label>
                                <Input id="plat-nombre" placeholder="Ej: Airbnb" value={newPlataforma.nombre} onChange={e => setNewPlataforma({ ...newPlataforma, nombre: e.target.value })} />
                            </div>
                            <div className="grid gap-2 w-32">
                                <Label htmlFor="plat-com">Comisión (%)</Label>
                                <Input id="plat-com" type="number" value={newPlataforma.comision_porcentaje} onChange={e => setNewPlataforma({ ...newPlataforma, comision_porcentaje: Number(e.target.value) })} />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={addPlataforma}>{editingPlataformaId ? "Guardar" : <><Plus className="h-4 w-4 mr-2" /> Añadir</>}</Button>
                                {editingPlataformaId && <Button variant="ghost" size="icon" onClick={cancelEditPlataforma}><X className="h-4 w-4" /></Button>}
                            </div>
                        </CardContent>
                    </Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Comisión (%)</TableHead>
                                <TableHead className="w-[100px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plataformas.map((p) => (
                                <TableRow key={p.id} className={editingPlataformaId === p.id ? "bg-muted/50" : ""}>
                                    <TableCell className="font-medium">{p.nombre}</TableCell>
                                    <TableCell>{p.comision_porcentaje}%</TableCell>
                                    <TableCell className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => editPlataforma(p)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteItem("plataformas", p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="categorias" className="space-y-4">
                    <Card className={editingCategoriaId ? "border-blue-500 ring-1 ring-blue-500" : ""}>
                        <CardHeader><CardTitle>{editingCategoriaId ? "Editar Categoría" : "Añadir Nueva Categoría de Gasto"}</CardTitle></CardHeader>
                        <CardContent className="flex gap-4 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="cat-nombre">Nombre de Categoría</Label>
                                <Input id="cat-nombre" placeholder="Ej: Limpieza" value={newCategoria.nombre} onChange={e => setNewCategoria({ ...newCategoria, nombre: e.target.value })} />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={addCategoria}>{editingCategoriaId ? "Guardar" : <><Plus className="h-4 w-4 mr-2" /> Añadir</>}</Button>
                                {editingCategoriaId && <Button variant="ghost" size="icon" onClick={cancelEditCategoria}><X className="h-4 w-4" /></Button>}
                            </div>
                        </CardContent>
                    </Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead className="w-[100px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categorias.map((c) => (
                                <TableRow key={c.id} className={editingCategoriaId === c.id ? "bg-muted/50" : ""}>
                                    <TableCell className="font-medium">{c.nombre}</TableCell>
                                    <TableCell className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => editCategoria(c)}><Pencil className="h-4 w-4 text-blue-500" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => deleteItem("categorias_gastos", c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </div>
    );
}

