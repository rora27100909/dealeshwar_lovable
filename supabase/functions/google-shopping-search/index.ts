import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleShoppingResult {
  title: string;
  price: string;
  source: string;
  link: string;
  rating?: string;
  reviews?: string;
}

async function searchGoogleShopping(query: string): Promise<GoogleShoppingResult[]> {
  const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    const response = await fetch(searchUrl, { headers });
    const html = await response.text();
    
    // Parse results using regex patterns since we can't use DOM parser for Google
    const results: GoogleShoppingResult[] = [];
    
    // Extract product cards from Google Shopping
    const productRegex = /<div[^>]*data-docid[^>]*>[\s\S]*?<\/div>/g;
    const matches = html.match(productRegex) || [];
    
    for (let i = 0; i < Math.min(matches.length, 10); i++) {
      const match = matches[i];
      
      // Extract title
      const titleMatch = match.match(/<h3[^>]*>([^<]+)<\/h3>/) || match.match(/aria-label="([^"]+)"/);
      const title = titleMatch ? titleMatch[1] : '';
      
      // Extract price
      const priceMatch = match.match(/₹[\d,]+/) || match.match(/\$[\d,]+\.?\d*/);
      const price = priceMatch ? priceMatch[0] : '';
      
      // Extract source/store
      const sourceMatch = match.match(/href="[^"]*"[^>]*>([^<]+)</) || 
                         match.match(/data-store="([^"]+)"/);
      const source = sourceMatch ? sourceMatch[1] : '';
      
      // Extract link
      const linkMatch = match.match(/href="([^"]+)"/);
      const link = linkMatch ? linkMatch[1] : '';
      
      if (title && price && source) {
        results.push({
          title: title.trim(),
          price: price.trim(),
          source: source.trim(),
          link: link.startsWith('http') ? link : `https://google.com${link}`
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Google Shopping search error:', error);
    return [];
  }
}

function mapToKnownPlatforms(results: GoogleShoppingResult[]): any[] {
  const platformMappings = {
    'amazon': { name: 'Amazon', baseUrl: 'https://amazon.in' },
    'flipkart': { name: 'Flipkart', baseUrl: 'https://flipkart.com' },
    'myntra': { name: 'Myntra', baseUrl: 'https://myntra.com' },
    'ajio': { name: 'AJIO', baseUrl: 'https://ajio.com' },
    'nykaa': { name: 'Nykaa', baseUrl: 'https://nykaa.com' },
    'meesho': { name: 'Meesho', baseUrl: 'https://meesho.com' },
    'snapdeal': { name: 'Snapdeal', baseUrl: 'https://snapdeal.com' },
    'paytm': { name: 'Paytm Mall', baseUrl: 'https://paytmmall.com' }
  };
  
  const mappedResults = [];
  
  for (const result of results) {
    const sourceLower = result.source.toLowerCase();
    
    for (const [key, platform] of Object.entries(platformMappings)) {
      if (sourceLower.includes(key)) {
        const price = parseFloat(result.price.replace(/[^\d.]/g, ''));
        
        if (price > 0) {
          mappedResults.push({
            platform_name: platform.name,
            platform_url: result.link,
            title: result.title,
            price: price,
            currency: 'INR',
            in_stock: true,
            source: 'google_shopping'
          });
        }
        break;
      }
    }
  }
  
  return mappedResults;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, brand, productId } = await req.json();
    
    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching Google Shopping for:', productName, brand);
    
    // Create search query
    const searchQuery = brand ? `${productName} ${brand}` : productName;
    
    // Search Google Shopping
    const googleResults = await searchGoogleShopping(searchQuery);
    console.log('Found', googleResults.length, 'results from Google Shopping');
    
    // Map to known platforms
    const platformResults = mapToKnownPlatforms(googleResults);
    console.log('Mapped to', platformResults.length, 'known platforms');
    
    // If productId is provided, save the results to price_history
    if (productId && platformResults.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Insert each result as price history entry
      for (const result of platformResults) {
        try {
          await supabase.from('price_history').insert({
            product_id: productId,
            platform_name: result.platform_name,
            platform_url: result.platform_url,
            price: result.price,
            currency: result.currency,
            in_stock: result.in_stock
          });
        } catch (insertError) {
          console.error('Error inserting price history:', insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results: platformResults,
        total_found: googleResults.length,
        mapped_platforms: platformResults.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in google-shopping-search function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});