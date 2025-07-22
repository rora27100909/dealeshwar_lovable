import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PlatformSearchResult {
  platform: string;
  name: string;
  price: string;
  url: string;
  image?: string;
  inStock: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, brand, category, productId } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Searching for product: "${productName}" by "${brand}" (category: "${category}")`);

    const searchQueries = [
      `${productName} ${brand || ''}`.trim(),
      productName,
      `${brand || ''} ${productName}`.trim()
    ].filter(q => q.length > 0);

    const platforms = [
      {
        name: 'Amazon',
        searchUrl: 'https://www.amazon.in/s?k=',
        selector: '[data-component-type="s-search-result"]',
        priceSelector: '.a-price-whole, .a-price .a-offscreen',
        nameSelector: 'h2 a span, [data-cy="title-recipe"]',
        linkSelector: 'h2 a',
        imageSelector: '.s-image'
      },
      {
        name: 'Flipkart',
        searchUrl: 'https://www.flipkart.com/search?q=',
        selector: '[data-id]',
        priceSelector: '._1_WHN1, ._30jeq3',
        nameSelector: '._4rR01T, .s1Q9rs',
        linkSelector: 'a',
        imageSelector: '._396cs4'
      }
    ];

    const results: PlatformSearchResult[] = [];

    for (const platform of platforms) {
      for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries per platform
        try {
          const searchUrl = platform.searchUrl + encodeURIComponent(query);
          console.log(`Searching ${platform.name}: ${searchUrl}`);

          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          if (!response.ok) continue;

          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');

          const products = doc?.querySelectorAll(platform.selector);
          if (!products) continue;

          for (let i = 0; i < Math.min(3, products.length); i++) {
            const productElement = products[i];
            
            const nameElement = productElement.querySelector(platform.nameSelector);
            const priceElement = productElement.querySelector(platform.priceSelector);
            const linkElement = productElement.querySelector(platform.linkSelector);
            const imageElement = productElement.querySelector(platform.imageSelector);

            if (!nameElement || !priceElement || !linkElement) continue;

            const name = nameElement.textContent?.trim() || '';
            const priceText = priceElement.textContent?.trim() || '';
            const href = linkElement.getAttribute('href') || '';
            const imageSrc = imageElement?.getAttribute('src') || '';

            // Extract price number
            const priceMatch = priceText.match(/[\d,]+/);
            if (!priceMatch) continue;

            const price = parseFloat(priceMatch[0].replace(/,/g, ''));
            if (isNaN(price) || price <= 0) continue;

            // Build full URL
            let fullUrl = href;
            if (href.startsWith('/')) {
              const baseUrl = platform.name === 'Amazon' ? 'https://www.amazon.in' : 'https://www.flipkart.com';
              fullUrl = baseUrl + href;
            }

            // Check if this looks like our product
            const nameWords = name.toLowerCase().split(' ');
            const productWords = productName.toLowerCase().split(' ');
            const matchCount = productWords.filter(word => 
              nameWords.some(nameWord => nameWord.includes(word) || word.includes(nameWord))
            ).length;

            if (matchCount >= Math.min(2, productWords.length)) {
              results.push({
                platform: platform.name,
                name: name,
                price: priceText,
                url: fullUrl,
                image: imageSrc.startsWith('http') ? imageSrc : undefined,
                inStock: true // Assume in stock if listed
              });

              // Save to price history
              try {
                await supabase.from('price_history').insert({
                  product_id: productId,
                  platform_name: platform.name,
                  platform_url: fullUrl,
                  price: price,
                  currency: 'INR',
                  in_stock: true,
                  scraped_at: new Date().toISOString()
                });
              } catch (dbError) {
                console.error('Error saving to DB:', dbError);
              }
            }
          }

          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error searching ${platform.name}:`, error);
        }
      }
    }

    console.log(`Found ${results.length} matching products across platforms`);

    return new Response(
      JSON.stringify({ 
        results,
        count: results.length,
        message: `Found ${results.length} matching products across platforms`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-platforms function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to search platforms',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});