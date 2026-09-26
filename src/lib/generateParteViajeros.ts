import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export interface ViajeroData {
    id?: string;
    nombre: string;
    primer_apellido: string;
    segundo_apellido?: string;
    sexo?: string; // 'M' | 'F' | 'O'
    tipo_documento?: string; // 'DNI' | 'PASAPORTE' | 'NIE' | 'OTRO'
    numero_documento: string;
    numero_soporte?: string;
    fecha_expedicion_doc?: string;
    nacionalidad?: string;
    fecha_nacimiento?: string;
    lugar_residencia?: string;
    telefono?: string;
    email?: string;
    fecha_entrada?: string;
    fecha_salida?: string;
    parentesco?: string;
    alquiler_id?: string;
    vivienda_id?: string;
    firma?: string;
}

export interface InmuebleData {
    nombre: string;
    direccion?: string;
    nif_titular?: string;
    nombre_titular?: string;
    codigo_establecimiento_ses?: string;
    nrua?: string;
    licencia_turistica?: string;
}

export function generateParteViajerosPDF(viajero: ViajeroData, inmueble?: InmuebleData) {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
    const accentColor: [number, number, number] = [37, 99, 235]; // Blue 600

    // Top Header Bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 14, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PARTE DE ENTRADA DE VIAJEROS / REGISTRO DOCUMENTAL", 105, 9, { align: "center" });

    // Subtitle RD 933/2021
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Obligaciones de registro documental e información según Real Decreto 933/2021 y Orden INT/1922/2003", 105, 19, { align: "center" });

    let currentY = 25;

    // 1. DATOS DEL ESTABLECIMIENTO / INMUEBLE
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("1. DATOS DE LA ACTIVIDAD / VIVIENDA DE USO TURÍSTICO", 16, currentY + 4.5);

    currentY += 8;

    autoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        body: [
            [
                { content: `Nombre Inmueble: ${inmueble?.nombre || "Vivienda Turística"}`, styles: { fontStyle: 'bold' } },
                { content: `Cód. SES.HOSPEDAJES: ${inmueble?.codigo_establecimiento_ses || "No asignado"}` }
            ],
            [
                { content: `Dirección: ${inmueble?.direccion || "No especificada"}` },
                { content: `NIF/CIF Titular: ${inmueble?.nif_titular || "-"}` }
            ],
            [
                { content: `Titular / Arrendador: ${inmueble?.nombre_titular || "Ruben Vega"}` },
                { content: `Nº Registro Turístico: ${inmueble?.licencia_turistica || inmueble?.nrua || "-"}` }
            ]
        ]
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // 2. DATOS DEL VIAJERO
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("2. DATOS DE IDENTIFICACIÓN DEL VIAJERO / HUÉSPED", 16, currentY + 4.5);

    currentY += 8;

    const fechaNac = viajero.fecha_nacimiento
        ? format(parseISO(viajero.fecha_nacimiento), "dd/MM/yyyy")
        : "-";
    const fechaExp = viajero.fecha_expedicion_doc
        ? format(parseISO(viajero.fecha_expedicion_doc), "dd/MM/yyyy")
        : "-";

    autoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: 'grid',
        headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontSize: 7.5, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [15, 23, 42] },
        head: [['Campo', 'Información Registrada', 'Campo', 'Información Registrada']],
        body: [
            ['Nombre:', viajero.nombre?.toUpperCase() || '', 'Primer Apellido:', viajero.primer_apellido?.toUpperCase() || ''],
            ['Segundo Apellido:', viajero.segundo_apellido?.toUpperCase() || '-', 'Sexo:', viajero.sexo === 'M' ? 'Masculino' : viajero.sexo === 'F' ? 'Femenino' : 'Otro'],
            ['Tipo Documento:', viajero.tipo_documento || 'DNI', 'Número Documento:', viajero.numero_documento?.toUpperCase() || ''],
            ['Nº Soporte:', viajero.numero_soporte?.toUpperCase() || '-', 'Fecha Expedición:', fechaExp],
            ['Nacionalidad:', viajero.nacionalidad?.toUpperCase() || 'ESPAÑOLA', 'Fecha Nacimiento:', fechaNac],
            ['Teléfono:', viajero.telefono || '-', 'Correo Electrónico:', viajero.email || '-'],
            ['Lugar Residencia:', { content: viajero.lugar_residencia?.toUpperCase() || '-', colSpan: 3 }],
            ['Relación / Parentesco:', viajero.parentesco || 'TITULAR', 'Estado Registro:', 'SES.HOSPEDAJES Pendiente / Oficial']
        ]
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // 3. DATOS DEL CONTRATO / ESTANCIA
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currentY, 182, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("3. DATOS DE LA ESTANCIA", 16, currentY + 4.5);

    currentY += 8;

    const fechaEntrada = viajero.fecha_entrada
        ? format(parseISO(viajero.fecha_entrada), "dd/MM/yyyy HH:mm", { locale: es })
        : "-";
    const fechaSalida = viajero.fecha_salida
        ? format(parseISO(viajero.fecha_salida), "dd/MM/yyyy HH:mm", { locale: es })
        : "-";

    autoTable(doc, {
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
        body: [
            [
                { content: `Fecha/Hora Entrada: ${fechaEntrada}`, styles: { fontStyle: 'bold' } },
                { content: `Fecha/Hora Salida: ${fechaSalida}`, styles: { fontStyle: 'bold' } }
            ]
        ]
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // 4. CLAÚSULA LEGAL Y FIRMA
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, currentY, 182, 38, "FD");

    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const legalNotice = "De conformidad con la Ley Orgánica 4/2015 de Protección de la Seguridad Ciudadana y el Real Decreto 933/2021, los datos facilitados serán incorporados al Registro de Viajeros y comunicados a las Fuerzas y Cuerpos de Seguridad del Estado (Ministerio del Interior - SES.HOSPEDAJES). El titular podrá ejercer sus derechos de acceso, rectificación y supresión conforme al RGPD ante el responsable del establecimiento.";
    const splitNotice = doc.splitTextToSize(legalNotice, 178);
    doc.text(splitNotice, 16, currentY + 4);

    // Signature boxes
    const sigY = currentY + 16;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);

    doc.text("Firma del Viajero / Huésped:", 20, sigY);
    if (viajero.firma && viajero.firma.startsWith("data:image")) {
        try {
            doc.addImage(viajero.firma, "PNG", 20, sigY + 1, 60, 14);
        } catch (e) {
            console.error("Error adding signature image:", e);
        }
    }
    doc.line(20, sigY + 16, 85, sigY + 16);

    doc.text("Firma del Arrendador / Titular:", 115, sigY);
    doc.line(115, sigY + 16, 180, sigY + 16);

    // Bottom Bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 287, 210, 10, "F");

    const fileName = `parte_viajero_${viajero.primer_apellido || 'huesped'}_${viajero.numero_documento || 'doc'}.pdf`;
    doc.save(fileName);
}
