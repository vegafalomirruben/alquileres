"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Scale, TrendingUp, TrendingDown, Info, Search, MapPin, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { toast } from "sonner";

export default function ComparativaPage() {
    const [viviendas, setViviendas] = useState<any[]>([]);
    const [selectedVivienda, setSelectedVivienda] = useState<string>("");
    
    // Month selection
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

    const [stats, setStats] = useState<any>(null);
    const [mockMarketData, setMockMarketData] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);

    // Scraper state
    const [searchLocation, setSearchLocation] = useState("Almassora");
    const [isScraping, setIsScraping] = useState(false);
    const [scrapedData, setScrapedData] = useState<any[]>([]);
    const [scrapeWarning, setScrapeWarning] = useState<string | null>(null);

    useEffect(() => {
        fetchViviendas();
    }, []);

    useEffect(() => {
        if (selectedVivienda) {
            calculateStats();
        } else {
            setStats(null);
            setMockMarketData(null);
            setChartData([]);
        }
    }, [selectedVivienda, selectedMonth, selectedYear]);

    async function fetchViviendas() {
        const { data } = await supabase.from("viviendas").select("*").order("created_at");
        if (data) setViviendas(data);
    }

    async function calculateStats() {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0); // last day of month
        
        const startStr = format(start, "yyyy-MM-dd");
        const endStr = format(end, "yyyy-MM-dd");

        const { data: alquileres } = await supabase
            .from("alquileres")
            .select("*")
            .eq("vivienda_id", selectedVivienda)
            .gte("fecha_salida", startStr)
            .lte("fecha_entrada", endStr);

        let ingresosPropios = 0;
        let nochesOcupadasPropias = 0;
        let ingresosNetosPropios = 0;

        if (alquileres) {
            for (const a of alquileres) {
                const aStart = new Date(a.fecha_entrada);
                const aEnd = new Date(a.fecha_salida);
                const overlapStart = aStart < start ? start : aStart;
                const overlapEnd = aEnd > end ? end : aEnd;

                if (overlapStart < overlapEnd) {
                    const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 3600 * 24);
                    nochesOcupadasPropias += overlapDays;

                    // Proporcionate income
                    const totalDays = a.noches || 1;
                    const prop = overlapDays / totalDays;
                    ingresosPropios += (a.precio_bruto || 0) * prop;
                    ingresosNetosPropios += (a.precio_neto || 0) * prop;
                }
            }
        }

        const diasEnMes = end.getDate();
        const adrPropio = nochesOcupadasPropias > 0 ? ingresosPropios / nochesOcupadasPropias : 0;
        const ocupacionPropi = (nochesOcupadasPropias / diasEnMes) * 100;

        setStats({
            ingresosBrutos: ingresosPropios,
            ingresosNetos: ingresosNetosPropios,
            adr: adrPropio,
            ocupacion: ocupacionPropi,
            noches: nochesOcupadasPropias
        });

        // GENERATE MOCK MARKET DATA based on our data to make it look realistic
        const adrMercado = adrPropio > 0 ? adrPropio * (0.8 + Math.random() * 0.4) : 85 + Math.random() * 40; // +/- 20%
        const ocupacionMercado = ocupacionPropi > 0 ? Math.min(100, ocupacionPropi * (0.85 + Math.random() * 0.3)) : 40 + Math.random() * 30;
        
        setMockMarketData({
            adr: adrMercado,
            ocupacion: ocupacionMercado,
            ingresosEstimados: adrMercado * (ocupacionMercado / 100) * diasEnMes
        });

        // Generate chart data (days of month)
        const days = eachDayOfInterval({ start, end });
        const cData = days.map(d => {
            // Is occupied?
            const isOcc = alquileres?.some(a => {
                const fEntrada = new Date(a.fecha_entrada);
                const fSalida = new Date(a.fecha_salida);
                return d >= fEntrada && d < fSalida;
            });
            
            const p = isOcc ? adrPropio : null;
            // Market fluctuates
            const m = adrMercado * (0.8 + Math.random() * 0.4);

            return {
                dia: format(d, "d"),
                "Tu Precio (ADR)": p,
                "Mercado": Math.round(m)
            };
        });
        
        setChartData(cData);
    }

    async function handleScrape() {
        if (!searchLocation) return;
        setIsScraping(true);
        setScrapedData([]);
        setScrapeWarning(null);
        
        try {
            const res = await fetch(`/api/scraper?location=${encodeURIComponent(searchLocation)}`);
            const json = await res.json();
            
            if (json.success) {
                setScrapedData(json.data);
                if (json.warning) setScrapeWarning(json.warning);
                toast.success(`Se han encontrado ${json.data.length} viviendas en ${searchLocation}`);
            } else {
                toast.error("Error al buscar: " + json.error);
            }
        } catch (error) {
            toast.error("Error de conexión al buscar competidores");
        } finally {
            setIsScraping(false);
        }
    }

    const currentVivienda = viviendas.find(v => v.id === selectedVivienda);

    const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const anos = [currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Scale className="h-8 w-8 text-primary" />
                        Comparativa de Mercado
                    </h1>
                    <p className="text-muted-foreground">Compara el rendimiento de tu vivienda con el mercado local.</p>
                </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full">
                        <Select value={selectedVivienda} onValueChange={setSelectedVivienda}>
                            <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Selecciona una vivienda" />
                            </SelectTrigger>
                            <SelectContent>
                                {viviendas.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(Number(v))}>
                            <SelectTrigger className="w-[140px] bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {meses.map((m, i) => (
                                    <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
                            <SelectTrigger className="w-[100px] bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {anos.map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {!selectedVivienda ? (
                <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
                    <Scale className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Selecciona una vivienda</h3>
                    <p className="text-muted-foreground text-sm">Elige una vivienda y un mes para ver la comparativa.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Anuncios Links */}
                    <div className="flex flex-wrap gap-4">
                        {currentVivienda?.url_airbnb ? (
                            <Button variant="outline" className="gap-2 border-[#FF5A5F] text-[#FF5A5F] hover:bg-[#FF5A5F] hover:text-white transition-colors" asChild>
                                <a href={currentVivienda.url_airbnb} target="_blank" rel="noreferrer">
                                    Ver anuncio en Airbnb <ExternalLink className="h-4 w-4" />
                                </a>
                            </Button>
                        ) : (
                            <Button variant="outline" className="gap-2 border-dashed" onClick={() => toast.info("Añade la URL en Ajustes")}>
                                Airbnb no configurado
                            </Button>
                        )}
                        {currentVivienda?.url_booking ? (
                            <Button variant="outline" className="gap-2 border-[#003580] text-[#003580] hover:bg-[#003580] hover:text-white transition-colors" asChild>
                                <a href={currentVivienda.url_booking} target="_blank" rel="noreferrer">
                                    Ver anuncio en Booking <ExternalLink className="h-4 w-4" />
                                </a>
                            </Button>
                        ) : (
                            <Button variant="outline" className="gap-2 border-dashed" onClick={() => toast.info("Añade la URL en Ajustes")}>
                                Booking no configurado
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Tu Precio Medio (ADR)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats?.adr.toFixed(2)}€</div>
                                {mockMarketData && (
                                    <div className={`text-xs mt-1 flex items-center gap-1 ${stats.adr > mockMarketData.adr ? 'text-green-500' : 'text-red-500'}`}>
                                        {stats.adr > mockMarketData.adr ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {Math.abs(stats.adr - mockMarketData.adr).toFixed(2)}€ vs mercado
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">ADR Mercado (Est.)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{mockMarketData?.adr.toFixed(2)}€</div>
                                <p className="text-xs text-muted-foreground mt-1">Precio medio en la zona</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Tu Ocupación</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats?.ocupacion.toFixed(1)}%</div>
                                {mockMarketData && (
                                    <div className={`text-xs mt-1 flex items-center gap-1 ${stats.ocupacion > mockMarketData.ocupacion ? 'text-green-500' : 'text-red-500'}`}>
                                        {stats.ocupacion > mockMarketData.ocupacion ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {Math.abs(stats.ocupacion - mockMarketData.ocupacion).toFixed(1)}% vs mercado
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Ocupación Mercado</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{mockMarketData?.ocupacion.toFixed(1)}%</div>
                                <p className="text-xs text-muted-foreground mt-1">Media en viviendas similares</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Evolución de Precios: {meses[selectedMonth]} {selectedYear}</CardTitle>
                            <CardDescription>Comparativa de tu precio medio diario facturado vs precios de mercado de la zona.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
                                        <RechartsTooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: any) => [`${Number(value).toFixed(2)}€`, undefined]}
                                        />
                                        <Legend />
                                        <Line 
                                            type="monotone" 
                                            dataKey="Mercado" 
                                            stroke="#8884d8" 
                                            strokeWidth={2}
                                            dot={false}
                                        />
                                        <Line 
                                            type="stepAfter" 
                                            dataKey="Tu Precio (ADR)" 
                                            stroke="#10b981" 
                                            strokeWidth={3}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="mt-4 bg-blue-500/10 text-blue-600 dark:text-blue-400 p-4 rounded-xl flex gap-3 text-sm">
                                <Info className="h-5 w-5 shrink-0" />
                                <p>
                                    <strong>Nota sobre los datos del mercado:</strong> Actualmente la aplicación muestra estimaciones de mercado simuladas. Para integrar datos reales de tu competencia, es necesario conectar un proveedor de inteligencia de precios como AirDNA, PriceLabs o Transparent.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Scraper Section */}
                    <Card className="border-secondary/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="h-5 w-5 text-secondary" />
                                Buscador de Competidores en Tiempo Real
                            </CardTitle>
                            <CardDescription>
                                Busca precios actuales en plataformas como Booking para tu zona (ej: Almassora, Castelló de la plana).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2 w-full md:w-1/2">
                                <div className="relative flex-1">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        value={searchLocation} 
                                        onChange={e => setSearchLocation(e.target.value)} 
                                        placeholder="Ciudad o zona..."
                                        className="pl-9"
                                    />
                                </div>
                                <Button onClick={handleScrape} disabled={isScraping} className="gap-2">
                                    {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    Buscar
                                </Button>
                            </div>

                            {scrapeWarning && (
                                <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-3 rounded-xl text-sm border border-yellow-500/20">
                                    {scrapeWarning}
                                </div>
                            )}

                            {scrapedData.length > 0 && (
                                <div className="border rounded-xl overflow-hidden mt-4">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-muted text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Vivienda (Competencia)</th>
                                                <th className="px-4 py-3 font-medium">Precio</th>
                                                <th className="px-4 py-3 font-medium">Nota</th>
                                                <th className="px-4 py-3 font-medium">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {scrapedData.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-muted/50 transition-colors">
                                                    <td className="px-4 py-3 font-medium">
                                                        {item.title}
                                                        {item.isMock && <span className="ml-2 text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Simulado</span>}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-primary">{item.priceText}</td>
                                                    <td className="px-4 py-3">{item.rating || "-"}</td>
                                                    <td className="px-4 py-3">
                                                        <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs flex items-center gap-1">
                                                            Ver <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
