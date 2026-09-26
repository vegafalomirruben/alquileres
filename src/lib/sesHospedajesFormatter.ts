import { ViajeroData, InmuebleData } from "./generateParteViajeros";
import { format, parseISO } from "date-fns";

/**
 * Genera el formato de comunicación oficial JSON para SES.HOSPEDAJES (Ministerio del Interior)
 * Cumpliendo la especificación técnica del Real Decreto 933/2021.
 */
export function formatSESHospedajesJSON(viajeros: ViajeroData[], inmueble: InmuebleData, contratoReferencia?: string) {
    const formattedData = {
        version: "1.0",
        arrendador: {
            nif: inmueble.nif_titular || "",
            nombre: inmueble.nombre_titular || "",
            codigoEstablecimiento: inmueble.codigo_establecimiento_ses || "",
            denominacion: inmueble.nombre || "",
            direccion: inmueble.direccion || "",
            licencia: inmueble.licencia_turistica || inmueble.nrua || ""
        },
        comunicacion: {
            tipo: "PARTE_ENTRADA",
            fechaEnvio: new Date().toISOString(),
            referenciaContrato: contratoReferencia || `RES-${Date.now()}`,
            numeroViajeros: viajeros.length,
            viajeros: viajeros.map((v, index) => ({
                orden: index + 1,
                nombre: v.nombre?.trim(),
                primerApellido: v.primer_apellido?.trim(),
                segundoApellido: v.segundo_apellido?.trim() || null,
                sexo: v.sexo || "M",
                tipoDocumento: v.tipo_documento || "DNI",
                numeroDocumento: v.numero_documento?.trim().toUpperCase(),
                numeroSoporte: v.numero_soporte?.trim() || null,
                fechaExpedicion: v.fecha_expedicion_doc ? format(parseISO(v.fecha_expedicion_doc), "yyyy-MM-dd") : null,
                nacionalidad: v.nacionalidad || "ESP",
                fechaNacimiento: v.fecha_nacimiento ? format(parseISO(v.fecha_nacimiento), "yyyy-MM-dd") : null,
                lugarResidencia: v.lugar_residencia || null,
                telefono: v.telefono || null,
                correoElectronico: v.email || null,
                parentesco: v.parentesco || (index === 0 ? "TITULAR" : "ACOMPAÑANTE"),
                fechaHoraEntrada: v.fecha_entrada ? new Date(v.fecha_entrada).toISOString() : new Date().toISOString(),
                fechaHoraSalidaPrevista: v.fecha_salida ? new Date(v.fecha_salida).toISOString() : null
            }))
        }
    };

    return formattedData;
}

/**
 * Descarga el archivo JSON listo para importar en la plataforma web de SES.HOSPEDAJES
 */
export function downloadSESHospedajesJSON(viajeros: ViajeroData[], inmueble: InmuebleData, nombreArchivo?: string) {
    const data = formatSESHospedajesJSON(viajeros, inmueble);
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", nombreArchivo || `ses_hospedajes_${format(new Date(), "yyyyMMdd_HHmm")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}
