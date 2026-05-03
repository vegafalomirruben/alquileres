import { parseISO, differenceInDays, startOfMonth, addMonths, format } from "date-fns";

export function splitRentals(rentals: any[]) {
    const split: any[] = [];
    for (const r of rentals) {
        if (!r.fecha_entrada || !r.fecha_salida) {
            split.push(r);
            continue;
        }
        const start = parseISO(r.fecha_entrada);
        const end = parseISO(r.fecha_salida);
        const totalNights = differenceInDays(end, start);
        if (totalNights <= 0) {
            split.push(r);
            continue;
        }

        // If it falls within the same month, no need to split mathematically, but we can just push it
        if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
            split.push(r);
            continue;
        }

        let current = start;
        while (current < end) {
            const nextMonthStart = startOfMonth(addMonths(current, 1));
            const segmentEnd = end < nextMonthStart ? end : nextMonthStart;
            const segmentNights = differenceInDays(segmentEnd, current);
            const fraction = segmentNights / totalNights;

            split.push({
                ...r,
                fecha_entrada: format(current, 'yyyy-MM-dd'),
                fecha_salida: format(segmentEnd, 'yyyy-MM-dd'),
                precio_neto: Number(r.precio_neto) * fraction,
                precio_bruto: Number(r.precio_bruto) * fraction,
                comision_valor: Number(r.comision_valor) * fraction,
                noches: segmentNights,
                isSplit: true,
                original_id: r.id
            });
            current = segmentEnd;
        }
    }
    return split;
}
