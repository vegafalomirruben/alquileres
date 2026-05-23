import { supabase } from "./supabase";
import ICAL from "ical.js";
import { differenceInDays } from "date-fns";

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    vivienda: string;
    source: "airbnb" | "booking" | "manual";
    plataforma_id?: string;
    original_price?: number;
    created?: Date;
}

export async function getUpcomingEvents(): Promise<{ events: CalendarEvent[], logs: string[], viviendas: any[] }> {
    const logs: string[] = [];
    const log = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        logs.push(`[${timestamp}] ${msg}`);
    };

    log("--- Inicia proceso de sincronización (v4 - ICAL.js con Cancelaciones) ---");

    // 1. Fetch all properties to check their links
    const { data: viviendas, error: vError } = await supabase
        .from("viviendas")
        .select("*");

    if (vError) {
        log(`Error fetching viviendas from DB: ${vError.message}`);
    }
    log(`Query returned ${viviendas?.length || 0} total properties from DB`);

    const icalEvents: CalendarEvent[] = [];
    const successfulFeeds: { vivienda_id: string; source: "airbnb" | "booking"; eventUids: Set<string> }[] = [];

    if (viviendas) {
        for (const v of viviendas) {
            log(`Checking property: ${v.nombre} (Airbnb: ${v.ical_airbnb ? 'YES' : 'NO'}, Booking: ${v.ical_booking ? 'YES' : 'NO'})`);
            
            // Airbnb
            if (v.ical_airbnb && v.ical_airbnb.trim() !== "") {
                log(`Fetching Airbnb iCal for ${v.nombre}...`);
                const { events: airbnbEvents, logs: fetchLogs, success } = await fetchAndParseIcal(v.ical_airbnb, "airbnb", v.nombre);
                logs.push(...fetchLogs);
                if (success) {
                    log(`Found ${airbnbEvents.length} upcoming events for Airbnb/${v.nombre}`);
                    icalEvents.push(...airbnbEvents);
                    successfulFeeds.push({
                        vivienda_id: v.id,
                        source: "airbnb",
                        eventUids: new Set(airbnbEvents.map(e => e.id))
                    });
                } else {
                    log(`Skipped sync/cancellation check for Airbnb/${v.nombre} due to fetch/parse failure`);
                }
            }
            
            // Booking
            if (v.ical_booking && v.ical_booking.trim() !== "") {
                log(`Fetching Booking iCal for ${v.nombre}...`);
                const { events: bookingEvents, logs: fetchLogs, success } = await fetchAndParseIcal(v.ical_booking, "booking", v.nombre);
                logs.push(...fetchLogs);
                if (success) {
                    log(`Found ${bookingEvents.length} upcoming events for Booking/${v.nombre}`);
                    icalEvents.push(...bookingEvents);
                    successfulFeeds.push({
                        vivienda_id: v.id,
                        source: "booking",
                        eventUids: new Set(bookingEvents.map(e => e.id))
                    });
                } else {
                    log(`Skipped sync/cancellation check for Booking/${v.nombre} due to fetch/parse failure`);
                }
            }
        }
    }

    // 2. Sync to DB: Inserts new bookings and deletes cancelled future ones
    try {
        await syncIcalToAlquileres(icalEvents, viviendas || [], successfulFeeds, log);
    } catch (e: any) {
        log(`Error in auto-sync: ${e.message}`);
    }

    // 3. Fetch all rentals from DB (now updated with inserts and deletes)
    const { data: rentals, error: rError } = await supabase
        .from("alquileres")
        .select("*, viviendas(nombre), plataformas(nombre)");

    if (rError) {
        log(`Error fetching rentals from DB after sync: ${rError.message}`);
    }

    const manualEvents: CalendarEvent[] = (rentals || [])
        .map((r: any) => {
            const platName = r.plataformas?.nombre?.toLowerCase() || "";
            let source: "airbnb" | "booking" | "manual" = "manual";
            if (platName.includes("airbnb")) source = "airbnb";
            else if (platName.includes("booking")) source = "booking";

            const isLibre = platName.includes("libre");
            return {
                id: r.ical_uid || r.id,
                title: isLibre ? `LIBRE: ${r.viviendas?.nombre}` : `Reserva (${r.viviendas?.nombre})`,
                start: new Date(r.fecha_entrada),
                end: new Date(r.fecha_salida),
                vivienda: r.viviendas?.nombre || "Desconocida",
                source: source,
                plataforma_id: r.plataforma_id,
                original_price: r.precio_neto
            };
        });

    log(`Total database events fetched: ${manualEvents.length}`);

    // Merge in-memory icalEvents as a fallback in case DB write failed
    const dbIds = new Set(manualEvents.map(e => e.id));
    const uniqueIcalEvents = icalEvents.filter(ev => !dbIds.has(ev.id));

    const allEvents = [...manualEvents, ...uniqueIcalEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
    log(`Total events to return: ${allEvents.length} (${manualEvents.length} from DB, ${uniqueIcalEvents.length} fallback in-memory)`);

    return { events: allEvents, logs, viviendas: viviendas || [] };
}

async function syncIcalToAlquileres(
    icalEvents: CalendarEvent[], 
    viviendas: any[], 
    successfulFeeds: { vivienda_id: string; source: "airbnb" | "booking"; eventUids: Set<string> }[],
    log: (msg: string) => void
) {
    // 1. Fetch platforms to map names to IDs
    const { data: plataformas } = await supabase.from("plataformas").select("*");
    const airbnbPlat = plataformas?.find(p => p.nombre.toLowerCase().includes("airbnb"));
    const bookingPlat = plataformas?.find(p => p.nombre.toLowerCase().includes("booking"));

    // --- PART A: Handle cancellations (deletions) ---
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    for (const feed of successfulFeeds) {
        const plat = feed.source === "airbnb" ? airbnbPlat : bookingPlat;
        if (!plat) continue;

        // Query future bookings in the DB for this property and platform that have an ical_uid
        const { data: dbBookings, error: dbErr } = await supabase
            .from("alquileres")
            .select("id, ical_uid, fecha_entrada, fecha_salida")
            .eq("vivienda_id", feed.vivienda_id)
            .eq("plataforma_id", plat.id)
            .not("ical_uid", "is", null)
            .gte("fecha_salida", todayStr); // Only check bookings ending today or in the future

        if (dbErr) {
            log(`Error fetching bookings for cancellation check (${feed.source}): ${dbErr.message}`);
            continue;
        }

        if (!dbBookings || dbBookings.length === 0) continue;

        // Identify bookings in the DB that are NOT in the active feed
        const uidsToDelete: string[] = [];
        const idsToDelete: string[] = [];

        for (const b of dbBookings) {
            if (b.ical_uid && !feed.eventUids.has(b.ical_uid)) {
                uidsToDelete.push(b.ical_uid);
                idsToDelete.push(b.id);
            }
        }

        if (idsToDelete.length > 0) {
            log(`Detected ${idsToDelete.length} cancelled bookings in ${feed.source} feed: ${uidsToDelete.join(", ")}. Deleting from DB...`);
            const { error: delErr } = await supabase
                .from("alquileres")
                .delete()
                .in("id", idsToDelete);

            if (delErr) {
                log(`Error deleting cancelled bookings: ${delErr.message}`);
            } else {
                log(`Successfully deleted ${idsToDelete.length} cancelled bookings.`);
            }
        }
    }

    // --- PART B: Insert new bookings ---
    if (icalEvents.length === 0) return;

    // Get existing ical_uids to avoid duplicates
    const { data: existing } = await supabase.from("alquileres").select("ical_uid").not("ical_uid", "is", null);
    const existingUids = new Set((existing || []).map(r => r.ical_uid));

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

async function fetchAndParseIcal(url: string, source: "airbnb" | "booking", viviendaName: string): Promise<{ events: CalendarEvent[], logs: string[], success: boolean }> {
    const events: CalendarEvent[] = [];
    const logs: string[] = [];
    let success = true;
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
                const limitDate = new Date();
                limitDate.setFullYear(limitDate.getFullYear() - 2); // Show events from last 2 years

                if (end > limitDate) {
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
        success = false;
    }
    return { events, logs, success };
}
