import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location") || "Almassora";
    
    try {
        // We will try to scrape Booking.com as it's slightly easier to get basic HTML than Airbnb
        const searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(location)}`;
        
        // Simulating a real browser request to avoid basic bot blocks
        const response = await fetch(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            }
        });

        if (!response.ok) {
            throw new Error(`Booking.com responded with status: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        
        const properties: any[] = [];
        
        // Booking property cards often have data-testid="property-card"
        $('[data-testid="property-card"]').each((i, el) => {
            if (i >= 10) return; // Limit to 10 results
            
            const title = $(el).find('[data-testid="title"]').text().trim();
            const priceText = $(el).find('[data-testid="price-and-discounted-price"]').text().trim();
            
            // Extract numeric price from text (e.g. "€ 120" -> 120)
            const priceMatch = priceText.match(/[\d.,]+/);
            let price = 0;
            if (priceMatch) {
                // Remove dots (used for thousands in ES) and replace comma with dot
                const cleanNumStr = priceMatch[0].replace(/\./g, '').replace(',', '.');
                price = parseFloat(cleanNumStr);
            }
            
            const rating = $(el).find('[data-testid="review-score"] div:first-child').text().trim();
            const link = $(el).find('a[data-testid="title-link"]').attr('href');
            
            if (title && price > 0) {
                properties.push({
                    title,
                    price,
                    priceText,
                    rating,
                    url: link ? (link.startsWith('http') ? link : `https://www.booking.com${link}`) : searchUrl
                });
            }
        });

        // If scraping failed to find elements (likely due to A/B testing or bot protection),
        // we fallback to generating realistic mock data for the requested city.
        if (properties.length === 0) {
            console.warn("Scraping returned 0 results. Bot protection might be active. Using fallback data for", location);
            
            // Mock data fallback
            const basePrices = location.toLowerCase().includes('castell') ? 110 : 85;
            for(let i=0; i<8; i++) {
                const variance = Math.random() * 40 - 20; // +/- 20
                properties.push({
                    title: `Vivienda Vacacional en ${location} #${i+1}`,
                    price: Math.round(basePrices + variance),
                    priceText: `€ ${Math.round(basePrices + variance)}`,
                    rating: (8.0 + Math.random() * 2).toFixed(1),
                    url: searchUrl,
                    isMock: true
                });
            }
            
            return NextResponse.json({ 
                success: true, 
                data: properties, 
                location, 
                warning: "Datos simulados. Booking.com bloqueó la petición automatizada (Anti-bot)." 
            });
        }

        return NextResponse.json({ success: true, data: properties, location });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
