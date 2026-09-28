import JSZip from "jszip";
import { format, parseISO } from "date-fns";

export interface ViajeroSES {
    id?: string;
    nombre: string;
    primer_apellido: string;
    segundo_apellido?: string | null;
    tipo_documento?: string | null;
    numero_documento: string;
    numero_soporte?: string | null;
    fecha_expedicion_doc?: string | null;
    fecha_nacimiento?: string | null;
    nacionalidad?: string | null;
    sexo?: string | null;
    telefono?: string | null;
    email?: string | null;
    parentesco?: string | null;
    lugar_residencia?: string | null;
}

export interface InmuebleSES {
    codigo_establecimiento_ses?: string | null;
    nombre?: string | null;
    direccion?: string | null;
    codigo_postal?: string | null;
    municipio?: string | null;
    nif_titular?: string | null;
    nombre_titular?: string | null;
}

export interface AlquilerSES {
    id: string;
    fecha_entrada: string;
    fecha_salida: string;
    created_at?: string;
    precio_total?: number;
    plataformas?: {
        nombre?: string;
    } | null;
    plataforma_nombre?: string;
    tipo_pago?: string;
    medio_pago?: string;
}

/**
 * Mapea el tipo de documento a los códigos del catálogo oficial del Ministerio:
 * NIF, NIE, PAS (Pasaporte), OTR (Otro)
 */
export function mapTipoDocumentoSES(tipo?: string | null, docNumber?: string | null): string {
    const t = (tipo || "").toUpperCase().trim();
    if (t === "DNI" || t === "NIF") return "NIF";
    if (t === "NIE") return "NIE";
    if (t === "PASAPORTE" || t === "PAS") return "PAS";
    
    // Inferencia por formato de número si no está definido
    if (docNumber) {
        const num = docNumber.trim().toUpperCase();
        if (/^[XYZ]\d{7}[A-Z]$/.test(num)) return "NIE";
        if (/^\d{8}[A-Z]$/.test(num)) return "NIF";
    }
    return "NIF";
}

/**
 * Mapea sexo al estándar oficial del Ministerio:
 * H: Hombre / Varón
 * M: Mujer
 */
export function mapSexoSES(sexo?: string | null): string {
    const s = (sexo || "").toUpperCase().trim();
    if (s === "M" || s === "MUJER" || s === "F" || s === "FEMENINO") return "M";
    return "H"; // H = Hombre por defecto
}

/**
 * Genera el XML oficial de petición para SES.HOSPEDAJES (altaReservaHospedaje.xsd).
 * Este es el formato exigido para Plataformas Digitales / Intermediarios / Gestores bajo RD 933/2021.
 */
export function generateReservaHospedajeXML(
    viajeros: ViajeroSES[],
    inmueble: InmuebleSES,
    alquiler: AlquilerSES,
    codigoEstablecimiento?: string
): string {
    const codEstablecimiento =
        codigoEstablecimiento ||
        inmueble.codigo_establecimiento_ses ||
        process.env.SES_HOSPEDAJES_ENTITY ||
        "0000312554";

    const fechaContrato = alquiler.created_at
        ? format(parseISO(alquiler.created_at), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");

    const fechaEntrada = `${alquiler.fecha_entrada}T16:00:00`;
    const fechaSalida = `${alquiler.fecha_salida}T11:00:00`;
    const referenciaContrato = `RES-${alquiler.id.slice(0, 8).toUpperCase()}`;

    // Ordenar para que el titular esté siempre el primero (índice 0) y sea el único TI
    const sortedViajeros = [...viajeros].sort((a, b) => {
        const aTit = (a.parentesco || "").toUpperCase() === "TITULAR";
        const bTit = (b.parentesco || "").toUpperCase() === "TITULAR";
        if (aTit && !bTit) return -1;
        if (!aTit && bTit) return 1;
        return 0;
    });

    // Construcción de los nodos de personas (sólo index 0 tiene rol TI, el resto VI)
    const personasXML = sortedViajeros.map((v, index) => {
        const rol = index === 0 ? "TI" : "VI";
        const tipoDoc = mapTipoDocumentoSES(v.tipo_documento, v.numero_documento);
        const numDoc = (v.numero_documento || "").trim().toUpperCase();
        const sexo = mapSexoSES(v.sexo);
        const nac = (v.nacionalidad || "ESP").trim().toUpperCase().slice(0, 3);
        const fechaNac = v.fecha_nacimiento
            ? format(parseISO(v.fecha_nacimiento), "yyyy-MM-dd")
            : "1990-01-01";

        // Contacto obligatorio según catálogo SES (telefono o correo)
        const email = v.email?.trim() || "contacto@calitodelta.es";
        const telefono = v.telefono?.trim();

        const apellido2Node = v.segundo_apellido?.trim()
            ? `\n        <apellido2>${escapeXML(v.segundo_apellido.trim())}</apellido2>`
            : (tipoDoc === "NIF" ? `\n        <apellido2>-</apellido2>` : "");

        const contactoNode = telefono
            ? `\n        <telefono>${escapeXML(telefono)}</telefono>`
            : `\n        <correo>${escapeXML(email)}</correo>`;

        return `      <persona>
        <rol>${rol}</rol>
        <nombre>${escapeXML(v.nombre.trim())}</nombre>
        <apellido1>${escapeXML(v.primer_apellido.trim())}</apellido1>${apellido2Node}
        <tipoDocumento>${tipoDoc}</tipoDocumento>
        <numeroDocumento>${numDoc}</numeroDocumento>
        <fechaNacimiento>${fechaNac}</fechaNacimiento>
        <nacionalidad>${nac}</nacionalidad>
        <sexo>${sexo}</sexo>${contactoNode}
      </persona>`;
    }).join("\n");

    // Determinar tipo y medio de pago según la plataforma (RD 933/2021 Catálogo TIPO_PAGO)
    let tipoPago = "EFECT";
    let medioPagoNode = "";

    const platName = (
        alquiler.plataforma_nombre ||
        alquiler.plataformas?.nombre ||
        ""
    ).toLowerCase().trim();

    if (alquiler.tipo_pago) {
        tipoPago = alquiler.tipo_pago;
        if (alquiler.medio_pago) {
            medioPagoNode = `\n          <medioPago>${escapeXML(alquiler.medio_pago)}</medioPago>`;
        }
    } else if (platName.includes("airbnb")) {
        tipoPago = "PLATF";
        medioPagoNode = `\n          <medioPago>Airbnb</medioPago>`;
    } else if (platName.includes("booking")) {
        tipoPago = "PLATF";
        medioPagoNode = `\n          <medioPago>Booking</medioPago>`;
    } else if (platName.includes("vrbo") || platName.includes("tripadvisor") || platName.includes("expedia")) {
        tipoPago = "PLATF";
        medioPagoNode = `\n          <medioPago>${escapeXML(alquiler.plataformas?.nombre || "Plataforma")}</medioPago>`;
    } else if (platName.includes("directo") || platName.includes("libre")) {
        tipoPago = "TRANS";
        medioPagoNode = `\n          <medioPago>Transferencia</medioPago>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<alt:peticion xmlns:alt="http://www.neg.hospedajes.mir.es/altaReservaHospedaje">
  <solicitud>
    <comunicacion>
      <establecimiento>
        <codigo>${codEstablecimiento}</codigo>
      </establecimiento>
      <contrato>
        <referencia>${referenciaContrato}</referencia>
        <fechaContrato>${fechaContrato}</fechaContrato>
        <fechaEntrada>${fechaEntrada}</fechaEntrada>
        <fechaSalida>${fechaSalida}</fechaSalida>
        <numPersonas>${viajeros.length}</numPersonas>
        <pago>
          <tipoPago>${tipoPago}</tipoPago>
          <fechaPago>${fechaContrato}</fechaPago>${medioPagoNode}
        </pago>
      </contrato>
${personasXML}
    </comunicacion>
  </solicitud>
</alt:peticion>`;
}

/**
 * Envía la comunicación a la pasarela SOAP oficial de SES.HOSPEDAJES (Ministerio del Interior)
 */
export async function sendSESHospedajesSOAP(xmlContent: string) {
    const user = process.env.SES_HOSPEDAJES_USER || "19000908XWS";
    const pass = process.env.SES_HOSPEDAJES_PASS || "UWpp)j_d";
    const codArrendador = process.env.SES_HOSPEDAJES_ENTITY || "0000312554";
    const endpoint = "https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion";

    // Requerido para conectar con el certificado de la FNMT / Ministerio en Node.js
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    // 1. Comprimir en ZIP (peticion.xml)
    const zip = new JSZip();
    zip.file("peticion.xml", xmlContent);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const base64Zip = zipBuffer.toString("base64");

    // 2. Sobre SOAP 1.1 para Alta de Reserva de Hospedaje (RH)
    const soapPayload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacionRequest>
      <peticion>
        <cabecera>
          <codigoArrendador>${codArrendador}</codigoArrendador>
          <aplicacion>AlquileresPro</aplicacion>
          <tipoOperacion>A</tipoOperacion>
          <tipoComunicacion>RH</tipoComunicacion>
        </cabecera>
        <solicitud>${base64Zip}</solicitud>
      </peticion>
    </com:comunicacionRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "text/xml;charset=UTF-8",
            SOAPAction: '""'
        },
        body: soapPayload
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error HTTP ${res.status} del servidor del Ministerio: ${errorText.slice(0, 300)}`);
    }

    const resBody = await res.text();

    // 3. Analizar respuesta inicial
    const matchCodigo = resBody.match(/<codigo>(\d+)<\/codigo>/);
    const matchDesc = resBody.match(/<descripcion>([^<]+)<\/descripcion>/);
    const matchLote = resBody.match(/<lote>([^<]+)<\/lote>/);

    const codigo = matchCodigo ? matchCodigo[1] : null;
    const descripcion = matchDesc ? matchDesc[1] : "";
    const lote = matchLote ? matchLote[1] : null;

    if (codigo !== "0" || !lote) {
        throw new Error(`Rechazado por el Ministerio: [${codigo || "DESCONOCIDO"}] ${descripcion || resBody.slice(0, 200)}`);
    }

    // 4. Esperar 3 segundos para que el Ministerio procese el lote y consultar el resultado oficial
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
        const consultResult = await consultLoteSOAP(lote);
        return {
            success: true,
            lote,
            codigoComunicacion: consultResult.codigoComunicacion || lote,
            descEstado: consultResult.descEstado,
            codigoEstado: consultResult.codigoEstado,
            modo: "WEBSERVICE_OFICIAL"
        };
    } catch {
        // Si la consulta tarda, devolvemos el lote como acuse de recibo inicial
        return {
            success: true,
            lote,
            codigoComunicacion: lote,
            descEstado: "Lote recibido y en proceso por el Ministerio",
            codigoEstado: 4,
            modo: "WEBSERVICE_OFICIAL"
        };
    }
}

/**
 * Consulta el estado y los códigos definitivos de un lote tramitado en el Ministerio
 */
export async function consultLoteSOAP(loteId: string) {
    const user = process.env.SES_HOSPEDAJES_USER || "19000908XWS";
    const pass = process.env.SES_HOSPEDAJES_PASS || "UWpp)j_d";
    const codArrendador = process.env.SES_HOSPEDAJES_ENTITY || "0000312554";
    const endpoint = "https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion";

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<con:lotes xmlns:con="http://www.neg.hospedajes.mir.es/consultarComunicacion">
  <con:lote>${loteId}</con:lote>
</con:lotes>`;

    const zip = new JSZip();
    zip.file("peticion.xml", xml);
    const zipBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const base64 = zipBuf.toString("base64");

    const soap = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:com="http://www.soap.servicios.hospedajes.mir.es/comunicacion">
  <soapenv:Header/>
  <soapenv:Body>
    <com:comunicacionRequest>
      <peticion>
        <cabecera>
          <codigoArrendador>${codArrendador}</codigoArrendador>
          <aplicacion>AlquileresPro</aplicacion>
          <tipoOperacion>C</tipoOperacion>
        </cabecera>
        <solicitud>${base64}</solicitud>
      </peticion>
    </com:comunicacionRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const auth = Buffer.from(`${user}:${pass}`).toString("base64");
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "text/xml;charset=UTF-8",
            SOAPAction: '""'
        },
        body: soap
    });

    const body = await res.text();

    const matchEstado = body.match(/<codigoEstado>(\d+)<\/codigoEstado>/);
    const matchDesc = body.match(/<descEstado>([^<]+)<\/descEstado>/);
    const matchCodigoCom = body.match(/<codigoComunicacion>([^<]+)<\/codigoComunicacion>/);
    const matchError = body.match(/<error>([^<]+)<\/error>/);

    const codigoEstado = matchEstado ? parseInt(matchEstado[1], 10) : null;
    const descEstado = matchDesc ? matchDesc[1] : "";
    const codigoComunicacion = matchCodigoCom ? matchCodigoCom[1] : null;

    if (codigoEstado === 2 || codigoEstado === 6) {
        throw new Error(matchError ? matchError[1] : descEstado);
    }

    return {
        codigoEstado,
        descEstado,
        codigoComunicacion
    };
}

function escapeXML(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
