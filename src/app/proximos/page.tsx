"use client";

import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, startOfWeek, endOfWeek, differenceInDays, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { PlatformLogo } from "@/components/platform-logo";

type Event = {
    id: string;
    title: string;
    start: string; // ISO date string from JSON
    end: string;
    vivienda: string;
    source: "airbnb" | "booking" | "manual";
    plataforma_id?: string;
};

export default function CalendarPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [showLogs, setShowLogs] = useState(false);
    const [viewMode, setViewMode] = useState<"bookings" | "availability">("bookings");
    const [plataformas, setPlataformas] = useState<any[]>([]);

    // Booking Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newBooking, setNewBooking] = useState({
        vivienda_id: "",
        plataforma_id: "",
        fecha_entrada: "",
        fecha_salida: "",
        precio_bruto: 0,
        precio_neto: 0,
        comision_valor: 0
    });

    const fetchData = (manual = false) => {
        setLoading(true);
        fetch(`/api/calendar?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                if (data && typeof data === 'object' && 'events' in data) {
                    setEvents(data.events);
                    setLogs(data.logs || []);
                    setViviendas(data.viviendas || []);
                    if (manual) toast.success("Sincronización completada");
                } else {
                    setEvents(Array.isArray(data) ? data : []);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLogs([`❌ Error de conexión: ${err.message}`]);
                if (manual) toast.error("Error al sincronizar");
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
        supabase.from("plataformas").select("*").then(({ data }) => setPlataformas(data || []));
    }, []);

    async function handleCreateBooking() {
        if (!newBooking.vivienda_id || !newBooking.fecha_entrada || !newBooking.fecha_salida) {
            toast.error("Por favor rellena los campos obligatorios");
            return;
        }

        // Basic calculations to keep DB clean
        const days = differenceInDays(new Date(newBooking.fecha_salida), new Date(newBooking.fecha_entrada));
        const finalBooking = {
            ...newBooking,
            noches: days > 0 ? days : 0,
            precio_medio_diario: (days > 0 && newBooking.precio_bruto > 0) ? (newBooking.precio_bruto / days) : 0
        };

        const { error } = await supabase.from("alquileres").insert([finalBooking]);
        if (error) {
            toast.error("Error al crear reserva: " + error.message);
        } else {
            toast.success("Reserva creada correctamente");
            setIsDialogOpen(false);
            fetchData();
        }
    }

    function openBookingDialog(viviendaId: string, date: Date) {
        setNewBooking({
            vivienda_id: viviendaId,
            plataforma_id: plataformas.find(p => p.nombre.toLowerCase().includes("directo") || p.nombre.toLowerCase().includes("personal"))?.id || plataformas[0]?.id || "",
            fecha_entrada: format(date, "yyyy-MM-dd"),
            fecha_salida: format(addMonths(date, 0), "yyyy-MM-dd"), // Placeholder
            precio_bruto: 0,
            precio_neto: 0,
            comision_valor: 0
        });
        setIsDialogOpen(true);
    }

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    });

    const getEventsForDay = (day: Date) => {
        const targetDay = startOfDay(day);
        return events.filter(e => {
            const start = startOfDay(parseISO(e.start));
            const end = startOfDay(parseISO(e.end));

            // A day is occupied if: Day >= Start AND Day < End
            return targetDay >= start && targetDay < end;
        });
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const getSourceColor = (ev: Event) => {
        switch (ev.source) {
            case "airbnb": return "bg-rose-500/15 text-rose-700 border-rose-200";
            case "booking": return "bg-blue-500/15 text-blue-700 border-blue-200";
            default: return "bg-amber-500/15 text-amber-900 border-amber-200";
        }
    };

    // Group events by property if multiple on same day to avoid clutter? 
    // For now list them all.

    return (
        <div className="space-y-2 sm:space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                <div>
                    <h1 className="text-xl sm:text-3xl font-bold tracking-tight">Calendario</h1>
                    <p className="text-muted-foreground text-xs sm:text-base hidden sm:block"> {viewMode === "bookings" ? "Reservas consolidadas de todas las fuentes." : "Días libres para cada propiedad."}</p>
                </div>
                <div className="flex flex-col xs:flex-row items-start xs:items-center gap-4 w-full sm:w-auto">
                    <div className="flex border rounded-lg p-1 bg-muted/50 w-full xs:w-auto">
                        <Button
                            variant={viewMode === "bookings" ? "default" : "ghost"}
                            size="sm"
                            className="h-7 sm:h-8 flex-1 xs:flex-initial text-[10px] sm:text-xs"
                            onClick={() => setViewMode("bookings")}
                        >
                            Reservas
                        </Button>
                        <Button
                            variant={viewMode === "availability" ? "default" : "ghost"}
                            size="sm"
                            className="h-7 sm:h-8 flex-1 xs:flex-initial text-[10px] sm:text-xs"
                            onClick={() => setViewMode("availability")}
                        >
                            Disponibles
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchData(true)}
                        disabled={loading}
                        className="h-7 sm:h-8 w-full xs:w-auto text-[10px] sm:text-xs"
                    >
                        <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar
                    </Button>
                    <div className="flex items-center justify-between sm:justify-center gap-1 sm:gap-2 w-full xs:w-auto">
                        <Button variant="outline" size="icon" onClick={prevMonth} className="h-7 w-7 sm:h-8 sm:w-8"><ChevronLeft className="h-4 w-4" /></Button>
                        <span className="font-semibold px-1 text-center capitalize text-xs sm:text-base">{format(currentDate, "MMMM yyyy", { locale: es })}</span>
                        <Button variant="outline" size="icon" onClick={nextMonth} className="h-7 w-7 sm:h-8 sm:w-8"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="h-[600px] flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 border-b w-full">
                            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(day => (
                                <div key={day} className="py-1 px-0.5 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground border-r last:border-r-0">
                                    {day}
                                </div>
                            ))}

                            {days.map((day, idx) => {
                                const dayEvents = getEventsForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isToday = isSameDay(day, new Date());

                                // Calculate availability
                                // Case 1: All properties that are NOT booked (previous logic) -> we keep this as a set of IDs for references if needed
                                const bookedViviendasNames = new Set(dayEvents.map(e => e.vivienda));

                                // Case 2: Specific properties marked as 'Libre' (new logic)
                                const explicitLibreViviendas = dayEvents.filter(ev => {
                                    if (ev.source !== "manual" || !ev.plataforma_id) return false;
                                    const plat = plataformas.find(p => p.id === ev.plataforma_id);
                                    return plat?.nombre?.toLowerCase().includes("libre");
                                });

                                const availableViviendas = explicitLibreViviendas.map(ev => ({
                                    id: viviendas.find(v => v.nombre === ev.vivienda)?.id || ev.id,
                                    nombre: ev.vivienda
                                }));

                                return (
                                    <div
                                        key={day.toISOString()}
                                        onClick={(e) => {
                                            // Only trigger if clicking the day itself, not an existing event
                                            if (e.target === e.currentTarget) {
                                                openBookingDialog("", day);
                                            }
                                        }}
                                        className={`
                                            min-h-[45px] py-1 px-0.5 border-r border-b last:border-r-0 relative cursor-pointer hover:bg-slate-50/50 transition-colors
                                            ${!isCurrentMonth ? "bg-muted/10 text-muted-foreground" : ""}
                                            ${isToday ? "bg-blue-50/50" : ""}
                                        `}
                                    >
                                        <div className={`text-right text-xs mb-1 pointer-events-none ${isToday ? "font-bold text-blue-600" : ""}`}>
                                            {format(day, "d")}
                                        </div>

                                        <div className="space-y-0.5">
                                            {viewMode === "bookings" ? (
                                                dayEvents.map(ev => (
                                                    <div
                                                        key={ev.id}
                                                        onClick={(e) => e.stopPropagation()} // Prevent opening dialog when clicking existing event
                                                        className={`
                                                            text-[9px] sm:text-[10px] p-0.5 sm:p-1 rounded-sm border truncate cursor-pointer hover:opacity-80 transition-opacity
                                                            ${getSourceColor(ev)}
                                                        `}
                                                        title={`${ev.title} - ${ev.vivienda}`}
                                                    >
                                                        <div className="flex items-center gap-1 leading-tight">
                                                            <PlatformLogo platform={ev.source} className="h-2.5 w-2.5 shrink-0" />
                                                            <span className="font-semibold truncate">{ev.vivienda}</span>
                                                        </div>
                                                        {isSameDay(parseISO(ev.start), day) && <span className="opacity-75 block text-[7px] sm:text-[8px] leading-none">In</span>}
                                                        {isSameDay(parseISO(ev.end), day) && <span className="opacity-75 block text-[7px] sm:text-[8px] leading-none">Out</span>}
                                                    </div>
                                                ))
                                            ) : (
                                                availableViviendas.map(v => (
                                                    <div
                                                        key={v.id}
                                                        onClick={() => openBookingDialog(v.id, day)}
                                                        className="group text-[9px] p-0.5 rounded-sm border border-emerald-100 bg-emerald-50 text-emerald-700 truncate cursor-pointer hover:bg-emerald-100 hover:border-emerald-200 transition-colors flex items-center justify-between"
                                                        title={`Disponible: ${v.nombre}. Haz clic para reservar.`}
                                                    >
                                                        <span>✅ {v.nombre}</span>
                                                        <Plus className="h-1.5 w-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-wrap justify-between items-center gap-2 text-[10px] sm:text-sm text-muted-foreground pb-4 sm:pb-0">
                <div className="flex gap-3 sm:gap-4">
                    <div className="flex items-center gap-1.5"><PlatformLogo platform="airbnb" className="w-3 h-3 text-rose-500" /> Airbnb</div>
                    <div className="flex items-center gap-1.5"><PlatformLogo platform="booking" className="w-3 h-3 text-blue-500" /> Booking</div>
                    <div className="flex items-center gap-1.5"><PlatformLogo platform="manual" className="w-3 h-3 text-amber-500" /> Manual</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowLogs(!showLogs)} className="text-[10px] h-7 px-2">
                    {showLogs ? "Ocultar Logs" : "Logs"}
                </Button>
            </div>

            {showLogs && (
                <Card className="bg-slate-950 text-slate-300 border-slate-800">
                    <CardHeader className="py-2 border-b border-slate-800">
                        <CardTitle className="text-xs uppercase tracking-wider opacity-50 font-mono">Debug Logs</CardTitle>
                    </CardHeader>
                    <CardContent className="py-4 font-mono text-[10px] space-y-1">
                        {logs.length === 0 && <div className="italic text-slate-500">No hay logs disponibles.</div>}
                        {logs.map((log, i) => (
                            <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
                                <span className="text-slate-600 mr-2">[{i + 1}]</span> {log}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Nueva Reserva Manual</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Vivienda</Label>
                            <Select
                                value={newBooking.vivienda_id}
                                onValueChange={v => setNewBooking({ ...newBooking, vivienda_id: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar vivienda" />
                                </SelectTrigger>
                                <SelectContent>
                                    {viviendas.map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="checkin">Entrada</Label>
                                <Input
                                    id="checkin"
                                    type="date"
                                    value={newBooking.fecha_entrada}
                                    onChange={e => {
                                        const newEntrada = e.target.value;
                                        let newSalida = newBooking.fecha_salida;
                                        if (!newSalida || newSalida <= newEntrada) {
                                            const d = new Date(newEntrada);
                                            d.setDate(d.getDate() + 1);
                                            newSalida = d.toISOString().split('T')[0];
                                        }
                                        setNewBooking({ ...newBooking, fecha_entrada: newEntrada, fecha_salida: newSalida });
                                    }}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="checkout">Salida</Label>
                                <Input
                                    id="checkout"
                                    type="date"
                                    min={newBooking.fecha_entrada}
                                    value={newBooking.fecha_salida}
                                    onChange={e => setNewBooking({ ...newBooking, fecha_salida: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Plataforma</Label>
                            <Select
                                value={newBooking.plataforma_id}
                                onValueChange={v => setNewBooking({ ...newBooking, plataforma_id: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar plataforma" />
                                </SelectTrigger>
                                <SelectContent>
                                    {plataformas.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="bruto">Precio Bruto</Label>
                                <Input
                                    id="bruto"
                                    type="number"
                                    value={newBooking.precio_bruto}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value);
                                        setNewBooking({ ...newBooking, precio_bruto: val, precio_neto: val }); // Default neto to bruto
                                    }}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="neto">Precio Neto</Label>
                                <Input
                                    id="neto"
                                    type="number"
                                    value={newBooking.precio_neto}
                                    onChange={e => setNewBooking({ ...newBooking, precio_neto: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateBooking}>Crear Reserva</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
