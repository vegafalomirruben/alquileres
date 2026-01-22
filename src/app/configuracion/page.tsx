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
import { Trash2, Plus, Building, CreditCard, Tag } from "lucide-react";

export default function ConfigPage() {
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [plataformas, setPlataformas] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);

    const [newVivienda, setNewVivienda] = useState({ nombre: "", direccion: "" });
    const [newPlataforma, setNewPlataforma] = useState({ nombre: "", comision_porcentaje: 0 });
    const [newCategoria, setNewCategoria] = useState({ nombre: "" });

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

    async function addVivienda() {
        if (!newVivienda.nombre) return toast.error("El nombre es obligatorio");
        const { error } = await supabase.from("viviendas").insert([newVivienda]);
        if (error) toast.error("Error al añadir vivienda");
        else {
            toast.success("Vivienda añadida");
            setNewVivienda({ nombre: "", direccion: "" });
            fetchData();
        }
    }

    async function addPlataforma() {
        if (!newPlataforma.nombre) return toast.error("El nombre es obligatorio");
        const { error } = await supabase.from("plataformas").insert([newPlataforma]);
        if (error) toast.error("Error al añadir plataforma");
        else {
            toast.success("Plataforma añadida");
            setNewPlataforma({ nombre: "", comision_porcentaje: 0 });
            fetchData();
        }
    }

    async function addCategoria() {
        if (!newCategoria.nombre) return toast.error("El nombre es obligatorio");
        const { error } = await supabase.from("categorias_gastos").insert([newCategoria]);
        if (error) toast.error("Error al añadir categoría");
        else {
            toast.success("Categoría añadida");
            setNewCategoria({ nombre: "" });
            fetchData();
        }
    }

    async function deleteItem(table: string, id: string) {
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
                    <Card>
                        <CardHeader><CardTitle>Añadir Nueva Vivienda</CardTitle></CardHeader>
                        <CardContent className="flex gap-4 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="vivienda-nombre">Nombre</Label>
                                <Input id="vivienda-nombre" placeholder="Ej: Villa Sol" value={newVivienda.nombre} onChange={e => setNewVivienda({ ...newVivienda, nombre: e.target.value })} />
                            </div>
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="vivienda-dir">Dirección</Label>
                                <Input id="vivienda-dir" placeholder="Ej: Calle Mayor 123" value={newVivienda.direccion} onChange={e => setNewVivienda({ ...newVivienda, direccion: e.target.value })} />
                            </div>
                            <Button onClick={addVivienda}><Plus className="h-4 w-4 mr-2" /> Añadir</Button>
                        </CardContent>
                    </Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead className="w-[100px]">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {viviendas.map((v) => (
                                <TableRow key={v.id}>
                                    <TableCell className="font-medium">{v.nombre}</TableCell>
                                    <TableCell>{v.direccion}</TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={() => deleteItem("viviendas", v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="plataformas" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Añadir Nueva Plataforma</CardTitle></CardHeader>
                        <CardContent className="flex gap-4 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="plat-nombre">Nombre</Label>
                                <Input id="plat-nombre" placeholder="Ej: Airbnb" value={newPlataforma.nombre} onChange={e => setNewPlataforma({ ...newPlataforma, nombre: e.target.value })} />
                            </div>
                            <div className="grid gap-2 w-32">
                                <Label htmlFor="plat-com">Comisión (%)</Label>
                                <Input id="plat-com" type="number" value={newPlataforma.comision_porcentaje} onChange={e => setNewPlataforma({ ...newPlataforma, comision_porcentaje: Number(e.target.value) })} />
                            </div>
                            <Button onClick={addPlataforma}><Plus className="h-4 w-4 mr-2" /> Añadir</Button>
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
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.nombre}</TableCell>
                                    <TableCell>{p.comision_porcentaje}%</TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={() => deleteItem("plataformas", p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>

                <TabsContent value="categorias" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Añadir Nueva Categoría de Gasto</CardTitle></CardHeader>
                        <CardContent className="flex gap-4 items-end">
                            <div className="grid gap-2 flex-1">
                                <Label htmlFor="cat-nombre">Nombre de Categoría</Label>
                                <Input id="cat-nombre" placeholder="Ej: Limpieza" value={newCategoria.nombre} onChange={e => setNewCategoria({ ...newCategoria, nombre: e.target.value })} />
                            </div>
                            <Button onClick={addCategoria}><Plus className="h-4 w-4 mr-2" /> Añadir</Button>
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
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.nombre}</TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={() => deleteItem("categorias_gastos", c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </div>
    );
}
