import { NextResponse } from "next/server";
import { getUpcomingEvents } from "../../../lib/ical";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { events, logs, viviendas } = await getUpcomingEvents();
        return NextResponse.json({ events, logs, viviendas });
    } catch (error: any) {
        console.error("Critical API Error:", error);
        return NextResponse.json({
            error: "Failed to fetch events",
            message: error.message || String(error),
            stack: error.stack
        }, { status: 500 });
    }
}
