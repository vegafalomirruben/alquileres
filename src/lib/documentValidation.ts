/**
 * Validación y utilidades oficiales para documentos españoles y extranjeros (NIF, NIE, Pasaporte, OTRO)
 * según el algoritmo de control de la Policía Nacional y la Agencia Tributaria.
 */

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/**
 * Valida un DNI / NIF español (8 dígitos + letra de control)
 */
export function isValidDNI(dni: string): boolean {
    const clean = dni.trim().toUpperCase().replace(/[-\s]/g, "");
    if (!/^\d{8}[A-Z]$/.test(clean)) return false;
    const num = parseInt(clean.slice(0, 8), 10);
    const letter = clean[8];
    return DNI_LETTERS[num % 23] === letter;
}

/**
 * Valida un NIE español (X/Y/Z + 7 dígitos + letra de control)
 */
export function isValidNIE(nie: string): boolean {
    const clean = nie.trim().toUpperCase().replace(/[-\s]/g, "");
    if (!/^[XYZ]\d{7}[A-Z]$/.test(clean)) return false;

    const prefix = clean[0];
    let numStr = "";
    if (prefix === "X") numStr = "0" + clean.slice(1, 8);
    else if (prefix === "Y") numStr = "1" + clean.slice(1, 8);
    else if (prefix === "Z") numStr = "2" + clean.slice(1, 8);

    const num = parseInt(numStr, 10);
    const letter = clean[8];
    return DNI_LETTERS[num % 23] === letter;
}

/**
 * Calcula la letra de control esperada para un número de NIE (X/Y/Z + 7 dígitos)
 */
export function getExpectedNieLetter(nie: string): string | null {
    const clean = nie.trim().toUpperCase().replace(/[-\s]/g, "");
    if (!/^[XYZ]\d{7}/.test(clean)) return null;

    const prefix = clean[0];
    let numStr = "";
    if (prefix === "X") numStr = "0" + clean.slice(1, 8);
    else if (prefix === "Y") numStr = "1" + clean.slice(1, 8);
    else if (prefix === "Z") numStr = "2" + clean.slice(1, 8);

    const num = parseInt(numStr, 10);
    return DNI_LETTERS[num % 23];
}

/**
 * Calcula la letra de control esperada para un número de DNI (8 dígitos)
 */
export function getExpectedDniLetter(dni: string): string | null {
    const clean = dni.trim().toUpperCase().replace(/[-\s]/g, "");
    if (!/^\d{8}/.test(clean)) return null;
    const num = parseInt(clean.slice(0, 8), 10);
    return DNI_LETTERS[num % 23];
}

/**
 * Valida si un documento cumple el formato y la letra de control según el tipo
 */
export function validateDocument(tipo: string, numero: string): { valid: boolean; message?: string; expectedLetter?: string } {
    const t = tipo.trim().toUpperCase();
    const num = numero.trim().toUpperCase().replace(/[-\s]/g, "");

    if (t === "DNI" || t === "NIF") {
        if (!/^\d{8}[A-Z]$/.test(num)) {
            return { valid: false, message: "El DNI/NIF debe tener 8 dígitos y una letra." };
        }
        const exp = getExpectedDniLetter(num);
        if (exp !== num[8]) {
            return { valid: false, message: `La letra de control correcta para ${num.slice(0, 8)} es '${exp}' (se indicó '${num[8]}').`, expectedLetter: exp || undefined };
        }
        return { valid: true };
    }

    if (t === "NIE") {
        if (!/^[XYZ]\d{7}[A-Z]$/.test(num)) {
            return { valid: false, message: "El NIE debe comenzar por X, Y o Z, seguido de 7 dígitos y una letra de control." };
        }
        const exp = getExpectedNieLetter(num);
        if (exp !== num[8]) {
            return { valid: false, message: `La letra de control calculada para el NIE ${num.slice(0, 8)} es '${exp}' (se indicó '${num[8]}').`, expectedLetter: exp || undefined };
        }
        return { valid: true };
    }

    if (t === "PASAPORTE" || t === "PAS" || t === "OTRO") {
        if (num.length < 3 || num.length > 20) {
            return { valid: false, message: "El documento debe tener entre 3 y 20 caracteres." };
        }
        return { valid: true };
    }

    return { valid: true };
}
