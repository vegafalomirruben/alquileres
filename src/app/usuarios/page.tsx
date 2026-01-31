"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Shield, User, Key, Calendar, Mail, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ email: "", password: "" });

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        setLoading(true);
        const { data, error } = await supabase
            .from("usuariosconexion")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) setUsers(data);
        if (error) toast.error("Error al cargar usuarios");
        setLoading(false);
    }

    async function handleSubmit() {
        if (!formData.email || !formData.password) {
            return toast.error("Rellena todos los campos");
        }

        const { error } = await supabase.from("usuariosconexion").insert([formData]);

        if (error) {
            toast.error("Error al crear usuario: " + error.message);
        } else {
            toast.success("Usuario creado con éxito");
            setIsModalOpen(false);
            setFormData({ email: "", password: "" });
            fetchUsers();
        }
    }

    async function deleteUser(id: string, email: string) {
        if (email === "rubenvegafalomir@hotmail.com") {
            return toast.error("No se puede borrar el usuario administrador");
        }
        if (!confirm("¿Seguro que quieres borrar este usuario?")) return;

        const { error } = await supabase.from("usuariosconexion").delete().eq("id", id);
        if (error) toast.error("Error al borrar");
        else {
            toast.success("Usuario borrado");
            fetchUsers();
        }
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="w-8 h-8 text-blue-600" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-muted-foreground">Administra quién tiene acceso al panel de gestión.</p>
                </div>
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                            <Plus className="h-4 w-4 mr-2" /> Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                            <DialogDescription>
                                El usuario podrá entrar con este email y contraseña.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        className="pl-10"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="pass">Contraseña</Label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                        id="pass"
                                        type="password"
                                        className="pl-10"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">Guardar Usuario</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="h-40 flex items-center justify-center">
                            <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="py-4 px-6">Usuario</TableHead>
                                        <TableHead>Contraseña</TableHead>
                                        <TableHead>Último Acceso</TableHead>
                                        <TableHead className="w-[100px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((u) => (
                                        <TableRow key={u.id} className="hover:bg-blue-50/30 transition-colors">
                                            <TableCell className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">{u.email}</p>
                                                        <p className="text-xs text-slate-400">ID: {u.id.substring(0, 8)}...</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">••••••••</code>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                                    <Calendar className="w-4 h-4" />
                                                    {u.fecha_ultimo_acceso
                                                        ? format(new Date(u.fecha_ultimo_acceso), "d MMM yyyy, HH:mm", { locale: es })
                                                        : "Nunca"
                                                    }
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                    onClick={() => deleteUser(u.id, u.email)}
                                                    disabled={u.email === "rubenvegafalomir@hotmail.com"}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {users.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                                                No hay usuarios registrados aparte del administrador.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
