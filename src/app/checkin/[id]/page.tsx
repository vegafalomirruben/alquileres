"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePad } from "@/components/signature-pad";
import { toast } from "sonner";
import {
    ShieldCheck, UserPlus, Trash2, CheckCircle2, Calendar, MapPin,
    AlertCircle, Sparkles, Building2, User
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface GuestForm {
    nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    sexo: string;
    tipo_documento: string;
    numero_documento: string;
    numero_soporte: string;
    fecha_expedicion_doc: string;
    nacionalidad: string;
    fecha_nacimiento: string;
    lugar_residencia: string;
    telefono: string;
    email: string;
    parentesco: string;
}

const emptyGuest: GuestForm = {
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
    parentesco: "TITULAR"
};

export default function CheckinPage() {
    const params = useParams();
    const id = params?.id as string;

    const [rental, setRental] = useState<any>(null);
    const [vivienda, setVivienda] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [guests, setGuests] = useState<GuestForm[]>([{ ...emptyGuest }]);
    const [signature, setSignature] = useState("");
    const [acceptTerms, setAcceptTerms] = useState(false);

    useEffect(() => {
        if (!id) return;
        loadData();
    }, [id]);

    async function loadData() {
        setLoading(true);
        // 1. Try finding by rental ID
        const { data: rData } = await supabase
            .from("alquileres")
            .select("*, viviendas(*)")
            .eq("id", id)
            .maybeSingle();

        if (rData) {
            setRental(rData);
            setVivienda(rData.viviendas);
        } else {
            // 2. Try finding by vivienda ID
            const { data: vData } = await supabase
                .from("viviendas")
                .select("*")
                .eq("id", id)
                .maybeSingle();

            if (vData) {
                setVivienda(vData);
            }
        }
        setLoading(false);
    }

    const updateGuest = (index: number, field: keyof GuestForm, value: string) => {
        setGuests(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: value };
            return copy;
        });
    };

    const addGuest = () => {
        setGuests(prev => [
            ...prev,
            { ...emptyGuest, parentesco: "ACOMPAÑANTE" }
        ]);
    };

    const removeGuest = (index: number) => {
        if (guests.length === 1) {
            return toast.info("Debe haber al menos un huésped registrado.");
        }
        setGuests(prev => prev.filter((_, i) => i !== index));
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validations
        for (let i = 0; i < guests.length; i++) {
            const g = guests[i];
            const num = i + 1;
            if (!g.nombre.trim()) return toast.error(`Huésped #${num}: El nombre es obligatorio.`);
            if (!g.primer_apellido.trim()) return toast.error(`Huésped #${num}: El primer apellido es obligatorio.`);
            if (!g.numero_documento.trim()) return toast.error(`Huésped #${num}: El número de documento es obligatorio.`);
            if (!g.fecha_nacimiento) return toast.error(`Huésped #${num}: La fecha de nacimiento es obligatoria.`);
        }

        if (!signature) {
            return toast.error("Por favor, estampa tu firma en el recuadro antes de enviar.");
        }

        if (!acceptTerms) {
            return toast.error("Debes aceptar la cláusula de tratamiento legal de datos oficiales.");
        }

        setSubmitting(true);
        try {
            const fechaEntrada = rental?.fecha_entrada ? new Date(rental.fecha_entrada).toISOString() : new Date().toISOString();
            const fechaSalida = rental?.fecha_salida ? new Date(rental.fecha_salida).toISOString() : null;

            const recordsToInsert = guests.map((g, index) => ({
                alquiler_id: rental?.id || null,
                vivienda_id: vivienda?.id || rental?.vivienda_id || null,
                nombre: g.nombre.trim(),
                primer_apellido: g.primer_apellido.trim(),
                segundo_apellido: g.segundo_apellido.trim() || null,
                sexo: g.sexo,
                tipo_documento: g.tipo_documento,
                numero_documento: g.numero_documento.trim().toUpperCase(),
                numero_soporte: g.numero_soporte.trim() || null,
                fecha_expedicion_doc: g.fecha_expedicion_doc || null,
                nacionalidad: g.nacionalidad.trim() || "ESP",
                fecha_nacimiento: g.fecha_nacimiento || null,
                lugar_residencia: g.lugar_residencia.trim() || null,
                telefono: g.telefono.trim() || null,
                email: g.email.trim() || null,
                parentesco: g.parentesco || (index === 0 ? "TITULAR" : "ACOMPAÑANTE"),
                fecha_entrada: fechaEntrada,
                fecha_salida: fechaSalida,
                estado_ses: "PENDIENTE",
                firma: signature
            }));

            const { error } = await supabase.from("viajeros").insert(recordsToInsert);

            if (error) throw error;

            setSubmitted(true);
            toast.success("¡Check-in registrado con éxito!");
        } catch (err: any) {
            console.error("Error saving checkin:", err);
            toast.error("Hubo un error al guardar el check-in: " + err.message);
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
                    <p className="text-sm text-slate-400">Cargando información del alojamiento...</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-slate-900 border-slate-800 shadow-2xl rounded-3xl overflow-hidden text-center p-8">
                    <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-2xl font-black text-white mb-2">¡Check-in Completado!</CardTitle>
                    <p className="text-sm text-slate-400 leading-relaxed mb-6">
                        Tu registro oficial de viajeros para <strong>{vivienda?.nombre || "el alojamiento"}</strong> ha sido procesado y comunicado con éxito.
                    </p>
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-xs text-slate-300 space-y-1 mb-6 text-left">
                        <p><strong>Alojamiento:</strong> {vivienda?.nombre}</p>
                        {rental && (
                            <p><strong>Estancia:</strong> {format(parseISO(rental.fecha_entrada), "d 'de' MMMM", { locale: es })} al {format(parseISO(rental.fecha_salida), "d 'de' MMMM yyyy", { locale: es })}</p>
                        )}
                        <p><strong>Huéspedes registrados:</strong> {guests.length}</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs font-bold">
                        <Sparkles className="h-4 w-4" /> ¡Te deseamos una feliz y cómoda estancia!
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* HEADER / WELCOME CARD */}
                <div className="bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-900/50 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                                <ShieldCheck className="h-3.5 w-3.5" /> Check-in Oficial Online
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                {vivienda?.nombre || "Bienvenido a tu estancia"}
                            </h1>
                            {vivienda?.direccion && (
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                    {vivienda.direccion}
                                </p>
                            )}
                        </div>
                    </div>

                    {rental && (
                        <div className="mt-4 pt-4 border-t border-indigo-900/40 flex flex-wrap gap-4 text-xs text-slate-300">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-indigo-400" />
                                <span>
                                    <strong>Entrada:</strong> {format(parseISO(rental.fecha_entrada), "d MMM yyyy", { locale: es })}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-indigo-400" />
                                <span>
                                    <strong>Salida:</strong> {format(parseISO(rental.fecha_salida), "d MMM yyyy", { locale: es })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-start gap-3 text-xs text-slate-400">
                    <AlertCircle className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                        De conformidad con la normativa española (<strong>Real Decreto 933/2021</strong>), todos los huéspedes mayores de 14 años deben identificarse formalmente antes del acceso a la vivienda.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {guests.map((g, index) => (
                        <Card key={index} className="bg-slate-900 border-slate-800 shadow-xl rounded-3xl overflow-hidden">
                            <CardHeader className="bg-slate-800/40 border-b border-slate-800/60 pb-4 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 font-black text-xs flex items-center justify-center">
                                        #{index + 1}
                                    </div>
                                    <CardTitle className="text-base font-bold text-white">
                                        {index === 0 ? "Huésped Principal (Titular)" : `Acompañante #${index + 1}`}
                                    </CardTitle>
                                </div>
                                {index > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeGuest(index)}
                                        className="h-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1 text-xs"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                                    </Button>
                                )}
                            </CardHeader>

                            <CardContent className="p-5 space-y-4 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Nombre *</Label>
                                        <Input
                                            placeholder="Ej: Laura"
                                            value={g.nombre}
                                            onChange={e => updateGuest(index, "nombre", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Primer Apellido *</Label>
                                        <Input
                                            placeholder="Ej: Gómez"
                                            value={g.primer_apellido}
                                            onChange={e => updateGuest(index, "primer_apellido", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Segundo Apellido</Label>
                                        <Input
                                            placeholder="Ej: Navarro"
                                            value={g.segundo_apellido}
                                            onChange={e => updateGuest(index, "segundo_apellido", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Tipo Documento *</Label>
                                        <Select
                                            value={g.tipo_documento}
                                            onValueChange={v => updateGuest(index, "tipo_documento", v)}
                                        >
                                            <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                                <SelectItem value="DNI">DNI</SelectItem>
                                                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                                                <SelectItem value="NIE">NIE</SelectItem>
                                                <SelectItem value="OTRO">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Nº Documento *</Label>
                                        <Input
                                            placeholder="12345678Z"
                                            value={g.numero_documento}
                                            onChange={e => updateGuest(index, "numero_documento", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white font-mono uppercase"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Nº Soporte</Label>
                                        <Input
                                            placeholder="Ej: AAA123456"
                                            value={g.numero_soporte}
                                            onChange={e => updateGuest(index, "numero_soporte", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white font-mono uppercase"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Sexo *</Label>
                                        <Select
                                            value={g.sexo}
                                            onValueChange={v => updateGuest(index, "sexo", v)}
                                        >
                                            <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                                <SelectItem value="M">Masculino</SelectItem>
                                                <SelectItem value="F">Femenino</SelectItem>
                                                <SelectItem value="O">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Nacionalidad *</Label>
                                        <Input
                                            placeholder="ESP / España"
                                            value={g.nacionalidad}
                                            onChange={e => updateGuest(index, "nacionalidad", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white uppercase"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Fecha Nacimiento *</Label>
                                        <Input
                                            type="date"
                                            value={g.fecha_nacimiento}
                                            onChange={e => updateGuest(index, "fecha_nacimiento", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Lugar Residencia</Label>
                                        <Input
                                            placeholder="Ciudad, País"
                                            value={g.lugar_residencia}
                                            onChange={e => updateGuest(index, "lugar_residencia", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Teléfono Móvil</Label>
                                        <Input
                                            type="tel"
                                            placeholder="+34 600000000"
                                            value={g.telefono}
                                            onChange={e => updateGuest(index, "telefono", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-300">Email</Label>
                                        <Input
                                            type="email"
                                            placeholder="email@ejemplo.com"
                                            value={g.email}
                                            onChange={e => updateGuest(index, "email", e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-white"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={addGuest}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-indigo-400 border-slate-800 border-dashed h-12 rounded-2xl font-bold flex items-center justify-center gap-2"
                    >
                        <UserPlus className="h-4 w-4" /> Añadir otro huésped / acompañante
                    </Button>

                    {/* SIGNATURE SECTION */}
                    <Card className="bg-slate-900 border-slate-800 shadow-xl rounded-3xl overflow-hidden p-6 space-y-4">
                        <div>
                            <CardTitle className="text-base font-bold text-white mb-1">
                                Firma Digital del Huésped Titular
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-400">
                                Firma con el dedo o puntero para validar la conformidad del Parte de Entrada.
                            </CardDescription>
                        </div>

                        <SignaturePad onSave={setSignature} />

                        <div className="pt-3 border-t border-slate-800 flex items-start gap-2.5">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={acceptTerms}
                                onChange={e => setAcceptTerms(e.target.checked)}
                                className="mt-1 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                            />
                            <Label htmlFor="terms" className="text-[11px] text-slate-400 leading-relaxed cursor-pointer">
                                Declaro que los datos facilitados son verídicos y autorizo su tratamiento a efectos de cumplimiento de las obligaciones de registro documental y comunicación a las Fuerzas y Cuerpos de Seguridad (Real Decreto 933/2021).
                            </Label>
                        </div>
                    </Card>

                    <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-indigo-600/30 text-base transition-transform active:scale-[0.99]"
                    >
                        {submitting ? "Guardando Check-in..." : "Completar y Enviar Check-in"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
