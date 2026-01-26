import { supabase } from "./supabase";
import ICAL from "ical.js";
import { differenceInDays } from "date-fns";

export type CalendarEvent = {
    id: string;
    title: string;
    start: Date;
    end: Date;
    vivienda: string;
    source: "airbnb" | "booking" | "manual";
    plataforma_id?: string;
    original_price?: number;
    created?: Date;
};

export async function getUpcomingEvents(): Promise<{ events: CalendarEvent[], logs: string[], viviendas: any[] }> {
    const logs: string[] = [];
    const log = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        logs.push(`[${timestamp}] ${msg}`);
    };

    log("--- Inicia proceso de sincronización (v3 - ICAL.js) ---");

    // 1. Fetch manual rentals
    const { data: rentals } = await supabase
        .from("alquileres")
        .select("*, viviendas(nombre), plataformas(nombre)")
        .gte("fecha_salida", new Date().toISOString());

    const manualEvents: CalendarEvent[] = (rentals || [])
        .filter((r: any) => {
            const platName = r.plataformas?.nombre?.toLowerCase() || "";
            // Excluimos entradas manuales de Airbnb/Booking porque ya vienen por iCal
            return !platName.includes("airbnb") && !platName.includes("booking");
        })
        .map((r: any) => {
            const isLibre = r.plataformas?.nombre?.toLowerCase().includes("libre");
            return {
                id: r.id,
                title: isLibre ? `LIBRE: ${r.viviendas?.nombre}` : `Reserva Manual (${r.viviendas?.nombre})`,
                start: new Date(r.fecha_entrada),
                end: new Date(r.fecha_salida),
                vivienda: r.viviendas?.nombre || "Desconocida",
                source: "manual",
                plataforma_id: r.plataforma_id,
                original_price: r.precio_neto
            };
        });

    log(`Manual event count: ${manualEvents.length}`);

    // 2. Fetch all properties to check their links
    const { data: viviendas, error: vError } = await supabase
        .from("viviendas")
        .select("*");

    if (vError) {
        log(`Error fetching viviendas from DB: ${vError.message}`);
    }

    log(`Query returned ${viviendas?.length || 0} total properties from DB`);

    const icalEvents: CalendarEvent[] = [];

    if (viviendas) {
        for (const v of viviendas) {
            log(`Checking property: ${v.nombre} (Airbnb: ${v.ical_airbnb ? 'YES' : 'NO'}, Booking: ${v.ical_booking ? 'YES' : 'NO'})`);
            // Airbnb
            if (v.ical_airbnb && v.ical_airbnb.trim() !== "") {
                try {
                    log(`Fetching Airbnb iCal for ${v.nombre}...`);
                    const { events: airbnbEvents, logs: fetchLogs } = await fetchAndParseIcal(v.ical_airbnb, "airbnb", v.nombre);
                    logs.push(...fetchLogs);
                    log(`Found ${airbnbEvents.length} upcoming events for Airbnb/${v.nombre}`);
                    icalEvents.push(...airbnbEvents);
                } catch (e: any) {
                    log(`Error fetching Airbnb iCal for ${v.nombre}: ${e.message}`);
                }
            }
            // Booking
            if (v.ical_booking && v.ical_booking.trim() !== "") {
                try {
                    log(`Fetching Booking iCal for ${v.nombre}...`);
                    const { events: bookingEvents, logs: fetchLogs } = await fetchAndParseIcal(v.ical_booking, "booking", v.nombre);
                    logs.push(...fetchLogs);
                    log(`Found ${bookingEvents.length} upcoming events for Booking/${v.nombre}`);
                    icalEvents.push(...bookingEvents);
                } catch (e: any) {
                    log(`Error fetching Booking iCal for ${v.nombre}: ${e.message}`);
                }
            }
        }
    }

    // Merge and sort
    const allEvents = [...manualEvents, ...icalEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
    log(`Total events to return: ${allEvents.length}`);

    // Trigger background sync to Alquileres table
    try {
        await syncIcalToAlquileres(icalEvents, viviendas || [], log);
    } catch (e: any) {
        log(`Error in auto-sync: ${e.message}`);
    }

    return { events: allEvents, logs, viviendas: viviendas || [] };
}

async function syncIcalToAlquileres(icalEvents: CalendarEvent[], viviendas: any[], log: (msg: string) => void) {
    if (icalEvents.length === 0) return;

    // 1. Get existing ical_uids to avoid duplicates
    const { data: existing } = await supabase.from("alquileres").select("ical_uid").not("ical_uid", "is", null);
    const existingUids = new Set((existing || []).map(r => r.ical_uid));

    // 2. Fetch platforms to map names to IDs
    const { data: plataformas } = await supabase.from("plataformas").select("*");
    const airbnbPlat = plataformas?.find(p => p.nombre.toLowerCase().includes("airbnb"));
    const bookingPlat = plataformas?.find(p => p.nombre.toLowerCase().includes("booking"));

    const newBookings = [];

    for (const ev of icalEvents) {
        if (existingUids.has(ev.id)) continue;

        const vivienda = viviendas.find(v => v.nombre === ev.vivienda);
        const plataforma = ev.source === "airbnb" ? airbnbPlat : bookingPlat;

        if (!vivienda || !plataforma) continue;

        const noches = differenceInDays(ev.end, ev.start);

        newBookings.push({
            ical_uid: ev.id,
            vivienda_id: vivienda.id,
            plataforma_id: plataforma.id,
            fecha_entrada: ev.start.toISOString().split("T")[0],
            fecha_salida: ev.end.toISOString().split("T")[0],
            precio_bruto: 0,
            precio_neto: 0,
            comision_valor: 0,
            noches: noches > 0 ? noches : 0,
            precio_medio_diario: 0,
            fecha_peticion: ev.created ? ev.created.toISOString().split("T")[0] : null,
            dias_antelacion: ev.created ? differenceInDays(ev.start, ev.created) : null
        });
    }

    if (newBookings.length > 0) {
        log(`Syncing ${newBookings.length} new bookings to Alquileres table...`);
        const { error } = await supabase.from("alquileres").insert(newBookings);
        if (error) throw error;
        log(`Successfully synced ${newBookings.length} new bookings.`);
    }
}

async function fetchAndParseIcal(url: string, source: "airbnb" | "booking", viviendaName: string): Promise<{ events: CalendarEvent[], logs: string[] }> {
    const events: CalendarEvent[] = [];
    const logs: string[] = [];
    const log = (msg: string) => {
        console.log(msg);
        logs.push(msg);
    };

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const icsData = await response.text();

        const jcalData = ICAL.parse(icsData);
        const vcalendar = new ICAL.Component(jcalData);
        const vevents = vcalendar.getAllSubcomponents('vevent');

        let count = 0;
        for (const vevent of vevents) {
            const event = new ICAL.Event(vevent);
            const start = event.startDate.toJSDate();
            const end = event.endDate.toJSDate();

            if (start && end) {
                count++;
                const now = new Date();
                now.setDate(now.getDate() - 30);

                if (end > now) {
                    const createdVal = vevent.getFirstPropertyValue('created') || vevent.getFirstPropertyValue('dtstamp');
                    const createdDate = createdVal ? (createdVal as ICAL.Time).toJSDate() : undefined;

                    events.push({
                        id: event.uid || Math.random().toString(),
                        title: `Reserva ${source === "airbnb" ? "Airbnb" : "Booking"}`,
                        start: start,
                        end: end,
                        vivienda: viviendaName,
                        source: source,
                        created: createdDate
                    });
                }
            }
        }
        log(`Parsed ${count} total events from ${source} feed, ${events.length} passed filter.`);
    } catch (err: any) {
        log(`Failed to parse ${source} iCal from ${url}: ${err.message}`);
    }
    return { events, logs };
}




