/**
 * Utilidades para normalización y validación de países según la norma oficial ISO 3166-1 Alfa-3,
 * exigida por el Ministerio del Interior para SES.HOSPEDAJES (Real Decreto 933/2021).
 */

// Conjunto de códigos ISO 3166-1 Alfa-3 oficiales válidos
export const VALID_ISO3_CODES = new Set([
    "ABW", "AFG", "AGO", "AIA", "ALA", "ALB", "AND", "ARE", "ARG", "ARM", "ASM", "ATA", "ATF", "ATG", "AUS",
    "AUT", "AZE", "BDI", "BEL", "BEN", "BES", "BFA", "BGD", "BGR", "BHR", "BHS", "BIH", "BLM", "BLR", "BLZ",
    "BMU", "BOL", "BRA", "BRB", "BRN", "BTN", "BVT", "BWA", "CAF", "CAN", "CCK", "CHE", "CHL", "CHN", "CIV",
    "CMR", "COD", "COG", "COK", "COL", "COM", "CPV", "CRI", "CUB", "CUW", "CXR", "CYM", "CYP", "CZE", "DEU",
    "DJI", "DMA", "DNK", "DOM", "DZA", "ECU", "EGY", "ERI", "ESH", "ESP", "EST", "ETH", "FIN", "FJI", "FLK",
    "FRA", "FRO", "FSM", "GAB", "GBR", "GEO", "GGY", "GHA", "GIB", "GIN", "GLP", "GMB", "GNB", "GNQ", "GRC",
    "GRD", "GRL", "GTM", "GUF", "GUM", "GUY", "HKG", "HMD", "HND", "HRV", "HTI", "HUN", "IDN", "IMN", "IND",
    "IOT", "IRL", "IRN", "IRQ", "ISL", "ISR", "ITA", "JAM", "JEY", "JOR", "JPN", "KAZ", "KEN", "KGZ", "KHM",
    "KIR", "KNA", "KOR", "KWT", "LAO", "LBN", "LBR", "LBY", "LCA", "LIE", "LKA", "LSO", "LTU", "LUX", "LVA",
    "MAC", "MAF", "MAR", "MCO", "MDA", "MDG", "MDV", "MEX", "MHL", "MKD", "MLI", "MLT", "MMR", "MNE", "MNG",
    "MNP", "MOZ", "MRT", "MSR", "MTQ", "MUS", "MWI", "MYS", "MYT", "NAM", "NCL", "NER", "NFK", "NGA", "NIC",
    "NIU", "NLD", "NOR", "NPL", "NRU", "NZL", "OMN", "PAK", "PAN", "PCN", "PER", "PHL", "PLW", "PNG", "POL",
    "PRI", "PRK", "PRT", "PRY", "PSE", "PYF", "QAT", "REU", "ROU", "RUS", "RWA", "SAU", "SDN", "SEN", "SGP",
    "SGS", "SHN", "SJM", "SLB", "SLE", "SLV", "SMR", "SOM", "SPM", "SRB", "SSD", "STP", "SUR", "SVK", "SVN",
    "SWE", "SWZ", "SXM", "SYC", "SYR", "TCA", "TCD", "TGO", "THA", "TJK", "TKL", "TKM", "TLS", "TON", "TTO",
    "TUN", "TUR", "TUV", "TWN", "TZA", "UGA", "UKR", "UMI", "URY", "USA", "UZB", "VAT", "VCT", "VEN", "VGB",
    "VIR", "VNM", "VUT", "WLF", "WSM", "YEM", "ZAF", "ZMB", "ZWE"
]);

// Mapeos habituales: nombres en español/inglés, gentilicios, códigos ISO-2 y erratas frecuentes
const COUNTRY_MAP: Record<string, string> = {
    // Rumanía (ROU) - El caso de error reportado (RUM / ROM -> ROU)
    "RUM": "ROU",
    "ROM": "ROU",
    "RO": "ROU",
    "ROU": "ROU",
    "RUMANIA": "ROU",
    "RUMANIA ": "ROU",
    "RUMANÍA": "ROU",
    "ROMANIA": "ROU",
    "RUMANO": "ROU",
    "RUMANA": "ROU",
    "ROMANIAN": "ROU",

    // España
    "ES": "ESP",
    "ESP": "ESP",
    "ESPAÑA": "ESP",
    "ESPANA": "ESP",
    "SPAIN": "ESP",
    "ESPAÑOL": "ESP",
    "ESPAÑOLA": "ESP",
    "SPANISH": "ESP",

    // Alemania (DEU)
    "DE": "DEU",
    "DEU": "DEU",
    "GER": "DEU",
    "ALE": "DEU",
    "ALEMANIA": "DEU",
    "GERMANY": "DEU",
    "DEUTSCHLAND": "DEU",
    "ALEMAN": "DEU",
    "ALEMÁN": "DEU",
    "ALEMANA": "DEU",

    // Francia (FRA)
    "FR": "FRA",
    "FRA": "FRA",
    "FRANCIA": "FRA",
    "FRANCE": "FRA",
    "FRANCES": "FRA",
    "FRANCÉS": "FRA",
    "FRANCESA": "FRA",
    "FRENCH": "FRA",

    // Italia (ITA)
    "IT": "ITA",
    "ITA": "ITA",
    "ITALIA": "ITA",
    "ITALY": "ITA",
    "ITALIANO": "ITA",
    "ITALIANA": "ITA",

    // Portugal (PRT)
    "PT": "PRT",
    "POR": "PRT",
    "PRT": "PRT",
    "PORTUGAL": "PRT",
    "PORTUGUES": "PRT",
    "PORTUGUÉS": "PRT",
    "PORTUGUESA": "PRT",
    "PORTUGUESE": "PRT",

    // Reino Unido (GBR)
    "GB": "GBR",
    "UK": "GBR",
    "GBR": "GBR",
    "REI": "GBR",
    "ING": "GBR",
    "ENG": "GBR",
    "REINO UNIDO": "GBR",
    "UNITED KINGDOM": "GBR",
    "GREAT BRITAIN": "GBR",
    "GRAN BRETAÑA": "GBR",
    "GRAN BRETANA": "GBR",
    "INGLATERRA": "GBR",
    "ENGLAND": "GBR",
    "BRITANICO": "GBR",
    "BRITÁNICO": "GBR",
    "BRITISH": "GBR",

    // Países Bajos / Holanda (NLD)
    "NL": "NLD",
    "NLD": "NLD",
    "HOL": "NLD",
    "PAISES BAJOS": "NLD",
    "PAÍSES BAJOS": "NLD",
    "HOLANDA": "NLD",
    "NETHERLANDS": "NLD",
    "HOLLAND": "NLD",
    "HOLANDES": "NLD",
    "HOLANDÉS": "NLD",
    "DUTCH": "NLD",

    // Bélgica (BEL)
    "BE": "BEL",
    "BEL": "BEL",
    "BÉL": "BEL",
    "BELGICA": "BEL",
    "BÉLGICA": "BEL",
    "BELGIUM": "BEL",
    "BELGA": "BEL",

    // Suiza (CHE)
    "CH": "CHE",
    "CHE": "CHE",
    "SUI": "CHE",
    "SUIZA": "CHE",
    "SWITZERLAND": "CHE",
    "SUISSE": "CHE",
    "SCHWEIZ": "CHE",
    "SUIZO": "CHE",
    "SUIZA ": "CHE",
    "SWISS": "CHE",

    // Austria (AUT)
    "AT": "AUT",
    "AUT": "AUT",
    "AUSTRIA": "AUT",
    "AUSTRIACO": "AUT",
    "AUSTRIACA": "AUT",
    "AUSTRIAN": "AUT",

    // Polonia (POL)
    "PL": "POL",
    "POL": "POL",
    "POLONIA": "POL",
    "POLAND": "POL",
    "POLACO": "POL",
    "POLACA": "POL",
    "POLISH": "POL",

    // Ucrania (UKR)
    "UA": "UKR",
    "UKR": "UKR",
    "UCR": "UKR",
    "UCRANIA": "UKR",
    "UKRAINE": "UKR",
    "UCRANIANO": "UKR",
    "UKRAINIAN": "UKR",

    // Suecia (SWE)
    "SE": "SWE",
    "SWE": "SWE",
    "SUE": "SWE",
    "SUECIA": "SWE",
    "SWEDEN": "SWE",
    "SUECO": "SWE",
    "SWEDISH": "SWE",

    // Noruega (NOR)
    "NO": "NOR",
    "NOR": "NOR",
    "NORUEGA": "NOR",
    "NORWAY": "NOR",
    "NORUEGO": "NOR",
    "NORWEGIAN": "NOR",

    // Dinamarca (DNK)
    "DK": "DNK",
    "DNK": "DNK",
    "DIN": "DNK",
    "DINAMARCA": "DNK",
    "DENMARK": "DNK",
    "DANES": "DNK",
    "DANÉS": "DNK",
    "DANISH": "DNK",

    // Finlandia (FIN)
    "FI": "FIN",
    "FIN": "FIN",
    "FINLANDIA": "FIN",
    "FINLAND": "FIN",
    "FINLANDES": "FIN",
    "FINLANDÉS": "FIN",

    // Irlanda (IRL)
    "IE": "IRL",
    "IRL": "IRL",
    "IRLANDA": "IRL",
    "IRELAND": "IRL",
    "IRLANDES": "IRL",
    "IRLANDÉS": "IRL",
    "IRISH": "IRL",

    // República Checa (CZE)
    "CZ": "CZE",
    "CZE": "CZE",
    "REPUBLICA CHECA": "CZE",
    "REPÚBLICA CHECA": "CZE",
    "CHEQUIA": "CZE",
    "CZECH REPUBLIC": "CZE",
    "CZECHIA": "CZE",

    // Hungría (HUN)
    "HU": "HUN",
    "HUN": "HUN",
    "HUNGRIA": "HUN",
    "HUNGRÍA": "HUN",
    "HUNGARY": "HUN",

    // Grecia (GRC)
    "GR": "GRC",
    "GRC": "GRC",
    "GRE": "GRC",
    "GRECIA": "GRC",
    "GREECE": "GRC",
    "GRIEGO": "GRC",

    // Croacia (HRV)
    "HR": "HRV",
    "HRV": "HRV",
    "CRO": "HRV",
    "CROACIA": "HRV",
    "CROATIA": "HRV",

    // Bulgaria (BGR)
    "BG": "BGR",
    "BGR": "BGR",
    "BUL": "BGR",
    "BULGARIA": "BGR",

    // Eslovaquia (SVK)
    "SK": "SVK",
    "SVK": "SVK",
    "ESLOVAQUIA": "SVK",
    "SLOVAKIA": "SVK",

    // Eslovenia (SVN)
    "SI": "SVN",
    "SVN": "SVN",
    "ESLOVENIA": "SVN",
    "SLOVENIA": "SVN",

    // Lituania (LTU)
    "LT": "LTU",
    "LTU": "LTU",
    "LITUANIA": "LTU",
    "LITHUANIA": "LTU",

    // Letonia (LVA)
    "LV": "LVA",
    "LVA": "LVA",
    "LETONIA": "LVA",
    "LATVIA": "LVA",

    // Estonia (EST)
    "EE": "EST",
    "EST": "EST",
    "ESTONIA": "EST",

    // Rusia (RUS)
    "RU": "RUS",
    "RUS": "RUS",
    "RUSIA": "RUS",
    "RUSSIA": "RUS",

    // Estados Unidos (USA)
    "US": "USA",
    "USA": "USA",
    "ESTADOS UNIDOS": "USA",
    "UNITED STATES": "USA",
    "EEUU": "USA",
    "EE.UU.": "USA",
    "EE.UU": "USA",
    "AMERICANO": "USA",
    "ESTADOUNIDENSE": "USA",

    // Canadá (CAN)
    "CA": "CAN",
    "CAN": "CAN",
    "CANADA": "CAN",
    "CANADÁ": "CAN",

    // México (MEX)
    "MX": "MEX",
    "MEX": "MEX",
    "MEXICO": "MEX",
    "MÉXICO": "MEX",

    // Colombia (COL)
    "CO": "COL",
    "COL": "COL",
    "COLOMBIA": "COL",
    "COLOMBIANO": "COL",

    // Argentina (ARG)
    "AR": "ARG",
    "ARG": "ARG",
    "ARGENTINA": "ARG",
    "ARGENTINO": "ARG",

    // Venezuela (VEN)
    "VE": "VEN",
    "VEN": "VEN",
    "VENEZ": "VEN",
    "VENEZUELA": "VEN",
    "VENEZOLANO": "VEN",

    // Chile (CHL)
    "CL": "CHL",
    "CHL": "CHL",
    "CHI": "CHL",
    "CHILE": "CHL",
    "CHILENO": "CHL",

    // Perú (PER)
    "PE": "PER",
    "PER": "PER",
    "PERU": "PER",
    "PERÚ": "PER",
    "PERUANO": "PER",

    // Ecuador (ECU)
    "EC": "ECU",
    "ECU": "ECU",
    "ECUADOR": "ECU",

    // Brasil (BRA)
    "BR": "BRA",
    "BRA": "BRA",
    "BRASIL": "BRA",
    "BRAZIL": "BRA",

    // Uruguay (URY)
    "UY": "URY",
    "URY": "URY",
    "URUGUAY": "URY",

    // Marruecos (MAR)
    "MA": "MAR",
    "MAR": "MAR",
    "MARRUECOS": "MAR",
    "MOROCCO": "MAR",
    "MARROQUI": "MAR",
    "MARROQUÍ": "MAR",

    // Andorra (AND)
    "AD": "AND",
    "AND": "AND",
    "ANDORRA": "AND",

    // China (CHN)
    "CN": "CHN",
    "CHN": "CHN",
    "CHINA": "CHN",

    // Japón (JPN)
    "JP": "JPN",
    "JPN": "JPN",
    "JAPON": "JPN",
    "JAPÓN": "JPN",
    "JAPAN": "JPN",

    // Australia (AUS)
    "AU": "AUS",
    "AUS": "AUS",
    "AUSTRALIA": "AUS"
};

/**
 * Normaliza cualquier texto de país o nacionalidad al código ISO 3166-1 Alfa-3 oficial.
 * Si no se encuentra correspondencia exacta, intenta verificar si ya es un código de 3 letras válido.
 * Por defecto devuelve "ESP" si es vacío.
 */
export function normalizeCountryToISO3(rawInput?: string | null): string {
    if (!rawInput || !rawInput.trim()) {
        return "ESP";
    }

    const clean = rawInput
        .trim()
        .toUpperCase()
        // Eliminar tildes para facilitar la búsqueda
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    // 1. Búsqueda directa en el diccionario de equivalencias
    if (COUNTRY_MAP[clean]) {
        return COUNTRY_MAP[clean];
    }

    // 2. Si es una cadena de 3 letras que está directamente en el catálogo ISO oficial
    if (clean.length === 3 && VALID_ISO3_CODES.has(clean)) {
        return clean;
    }

    // 3. Casos especiales comunes de truncado previo de 3 letras
    if (clean === "RUM" || clean === "ROM") return "ROU";
    if (clean === "ALE") return "DEU";
    if (clean === "POR") return "PRT";
    if (clean === "REI" || clean === "ING") return "GBR";
    if (clean === "HOL") return "NLD";
    if (clean === "SUI") return "CHE";
    if (clean === "UCR") return "UKR";
    if (clean === "CHI") return "CHL";
    if (clean === "EST" && rawInput.toUpperCase().includes("UNIDOS")) return "USA";

    // 4. Si los primeros 3 caracteres limpios forman un ISO válido
    const first3 = clean.slice(0, 3);
    if (COUNTRY_MAP[first3]) {
        return COUNTRY_MAP[first3];
    }
    if (VALID_ISO3_CODES.has(first3)) {
        return first3;
    }

    // 5. Fallback por defecto seguro
    return "ESP";
}

/**
 * Lista de nacionalidades comunes para selectores / autocompletado en el frontend
 */
export const COMMON_NATIONALITIES = [
    { code: "ESP", label: "España (ESP)" },
    { code: "ROU", label: "Rumanía (ROU)" },
    { code: "FRA", label: "Francia (FRA)" },
    { code: "DEU", label: "Alemania (DEU)" },
    { code: "GBR", label: "Reino Unido (GBR)" },
    { code: "ITA", label: "Italia (ITA)" },
    { code: "PRT", label: "Portugal (PRT)" },
    { code: "NLD", label: "Países Bajos / Holanda (NLD)" },
    { code: "BEL", label: "Bélgica (BEL)" },
    { code: "CHE", label: "Suiza (CHE)" },
    { code: "POL", label: "Polonia (POL)" },
    { code: "UKR", label: "Ucrania (UKR)" },
    { code: "IRL", label: "Irlanda (IRL)" },
    { code: "SWE", label: "Suecia (SWE)" },
    { code: "NOR", label: "Noruega (NOR)" },
    { code: "DNK", label: "Dinamarca (DNK)" },
    { code: "AUT", label: "Austria (AUT)" },
    { code: "USA", label: "Estados Unidos (USA)" },
    { code: "MAR", label: "Marruecos (MAR)" },
    { code: "COL", label: "Colombia (COL)" },
    { code: "ARG", label: "Argentina (ARG)" },
    { code: "VEN", label: "Venezuela (VEN)" },
    { code: "AND", label: "Andorra (AND)" }
];
