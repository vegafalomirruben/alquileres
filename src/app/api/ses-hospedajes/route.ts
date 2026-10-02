import { NextResponse } from "next/server";
import { generateReservaHospedajeXML, sendSESHospedajesSOAP, mapTipoDocumentoSES } from "@/lib/sesHospedajesSOAP";
import { normalizeCountryToISO3, VALID_ISO3_CODES } from "@/lib/countryCodes";
import { validateDocument } from "@/lib/documentValidation";

/**
 * Endpoint de comunicación oficial con la pasarela SES.HOSPEDAJES (Ministerio del Interior)
 * Cumple estrictamente con el Real Decreto 933/2021 y la especificación WSDL v3.1.3 (SOAP 1.1 / XML / ZIP).
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { viajeros, inmueble, alquiler, action } = body;

        if (!viajeros || !Array.isArray(viajeros) || viajeros.length === 0) {
            return NextResponse.json(
                { success: false, message: "No se proporcionaron viajeros para comunicar." },
                { status: 400 }
            );
        }

        // 1. Validación de campos obligatorios según RD 933/2021
        const errores: string[] = [];
        viajeros.forEach((v, index) => {
            const num = index + 1;
            if (!v.nombre?.trim()) errores.push(`Viajero #${num}: El nombre es obligatorio.`);
            if (!v.primer_apellido?.trim()) errores.push(`Viajero #${num}: El primer apellido es obligatorio.`);
            if (!v.numero_documento?.trim()) errores.push(`Viajero #${num}: El número de documento es obligatorio.`);

            // Normalización y validación estricta de nacionalidad (ISO 3166-1 Alfa-3)
            const iso3 = normalizeCountryToISO3(v.nacionalidad);
            v.nacionalidad = iso3;
            if (!VALID_ISO3_CODES.has(iso3)) {
                errores.push(`Viajero #${num} (${v.nombre}): El país o nacionalidad "${v.nacionalidad}" no es un código ISO 3166-1 Alfa-3 válido.`);
            }

            // Validación de formato y letra de control para DNI y NIE
            const tipoDoc = mapTipoDocumentoSES(v.tipo_documento, v.numero_documento);
            const numDoc = (v.numero_documento || "").trim().toUpperCase().replace(/[-\s]/g, "");
            if (tipoDoc === "NIE" || tipoDoc === "NIF") {
                const docCheck = validateDocument(tipoDoc, numDoc);
                if (!docCheck.valid) {
                    errores.push(`Viajero #${num} (${v.nombre} ${v.primer_apellido}): ${docCheck.message}`);
                }
            }
        });

        if (errores.length > 0) {
            return NextResponse.json(
                { success: false, message: "Errores de validación oficial", errores },
                { status: 422 }
            );
        }

        const alquilerData = alquiler || {
            id: viajeros[0]?.alquiler_id || `ALQ-${Date.now()}`,
            fecha_entrada: viajeros[0]?.fecha_entrada || new Date().toISOString().slice(0, 10),
            fecha_salida: viajeros[0]?.fecha_salida || new Date().toISOString().slice(0, 10),
            created_at: viajeros[0]?.created_at || new Date().toISOString()
        };

        // 2. Generar el XML oficial según altaReservaHospedaje.xsd
        const xml = generateReservaHospedajeXML(viajeros, inmueble || {}, alquilerData);

        // Si solo se solicita descargar el XML
        if (action === "get_xml") {
            return NextResponse.json({
                success: true,
                xml,
                filename: `ses_reserva_${alquilerData.id.slice(0, 8)}.xml`
            });
        }

        // 3. Enviar a través de la pasarela SOAP oficial del Ministerio del Interior
        const result = await sendSESHospedajesSOAP(xml);

        return NextResponse.json({
            success: true,
            codigoRegistro: result.codigoComunicacion || result.lote,
            lote: result.lote,
            descEstado: result.descEstado,
            modo: "WEBSERVICE_OFICIAL",
            mensaje: "Parte comunicado y tramitado con éxito en el Ministerio del Interior (SES.HOSPEDAJES)"
        });

    } catch (error: any) {
        console.error("Error en pasarela oficial SES.HOSPEDAJES:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "Error al procesar el envío con el Ministerio del Interior."
            },
            { status: 500 }
        );
    }
}
