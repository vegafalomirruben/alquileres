import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Endpoint de mantenimiento (Keep-Alive) para UptimeRobot
 * 1. Mantiene despierto el contenedor web (Render / Vercel).
 * 2. Realiza una consulta a la base de datos de Supabase para evitar que entre en pausa por inactividad.
 */
export async function GET() {
    try {
        const startTime = Date.now();

        // Consulta ligera a Supabase para registrar actividad real en la BD
        const { data, error } = await supabase
            .from("viviendas")
            .select("id")
            .limit(1);

        const responseTime = Date.now() - startTime;

        if (error) {
            console.error("Keep-alive database query warning:", error.message);
            return NextResponse.json({
                status: "warning",
                timestamp: new Date().toISOString(),
                responseTimeMs: responseTime,
                database: "error",
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            responseTimeMs: responseTime,
            database: "connected",
            message: "App & Supabase keep-alive successful"
        }, { status: 200 });

    } catch (error: any) {
        console.error("Keep-alive unexpected error:", error);
        return NextResponse.json({
            status: "error",
            timestamp: new Date().toISOString(),
            error: error.message
        }, { status: 500 });
    }
}
