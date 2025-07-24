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
  availability: string;
  numericPrice: number;
}

// Clean product name for better search results
function cleanProductName(productName: string): string {
  return productName
    .replace(/\|/g, ' ') // Replace pipes with spaces
    .replace(/[()[\]]/g, ' ') // Remove brackets
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(with|without|pack|jar|bottle|ml|g|kg|ltr|litre|pieces?)\b/gi, '') // Remove common descriptors
    .trim();
}

// Fuzzy matching function
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(' ').filter(w => w.length > 2);
  const words2 = str2.toLowerCase().split(' ').filter(w => w.length > 2);
  
  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

// Platform configurations
const platforms = [
  {
    name: 'Flipkart',
    searchUrl: 'https://www.flipkart.com/search?q=',
    baseUrl: 'https://www.flipkart.com',
    selectors: {
      container: '._1AtVbE, ._13oc-S',
      name: '._4rR01T, .s1Q9rs, ._2WkVRV',
      price: '._30jeq3, ._1_WHN1',
      link: 'a',
      image: '._396cs4 img, ._2r_T1I img'
    }
  },
  {
    name: 'BigBasket',
    searchUrl: 'https://www.bigbasket.com/ps/?q=',
    baseUrl: 'https://www.bigbasket.com',
    selectors: {
      container: '.SKUDynamic, .product',
      name: '.break-words, .product-name',
      price: '.Pricing___StyledDiv2-sc, .sale-price',
      link: 'a',
      image: 'img'
    }
  },
  {
    name: 'Blinkit',
    searchUrl: 'https://blinkit.com/s/?q=',
    baseUrl: 'https://blinkit.com',
    selectors: {
      container: '.Product__UpdatedC, .product-item',
      name: '.Product__ProductName, .product-name',
      price: '.Product__UpdatedPrice, .product-price',
      link: 'a',
      image: 'img'
    }
  }
];

async function searchPlatform(platform: any, query: string, originalProduct: string): Promise<PlatformSearchResult[]> {
  const results: PlatformSearchResult[] = [];
  
  try {
    const searchUrl = platform.searchUrl + encodeURIComponent(query);
    console.log(`Searching ${platform.name}: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.log(`${platform.name} search failed with status: ${response.status}`);
      return results;
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    if (!doc) {
      console.log(`Failed to parse HTML for ${platform.name}`);
      return results;
    }

    const containers = doc.querySelectorAll(platform.selectors.container);
    console.log(`Found ${containers.length} product containers on ${platform.name}`);

    for (let i = 0; i < Math.min(5, containers.length); i++) {
      try {
        const container = containers[i];
        
        const nameElement = container.querySelector(platform.selectors.name);
        const priceElement = container.querySelector(platform.selectors.price);
        const linkElement = container.querySelector(platform.selectors.link);
        const imageElement = container.querySelector(platform.selectors.image);

        if (!nameElement || !priceElement) continue;

        const name = nameElement.textContent?.trim() || '';
        const priceText = priceElement.textContent?.trim() || '';
        
        if (!name || !priceText) continue;

        // Extract numeric price
        const priceMatch = priceText.match(/[\d,]+(?:\.\d{2})?/);
        if (!priceMatch) continue;

        const numericPrice = parseFloat(priceMatch[0].replace(/,/g, ''));
        if (isNaN(numericPrice) || numericPrice <= 0) continue;

        // Get link
        const href = linkElement?.getAttribute('href') || '';
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = platform.baseUrl + href;
        } else if (!href.startsWith('http')) {
          fullUrl = platform.baseUrl + '/' + href;
        }

        // Get image
        const imageSrc = imageElement?.getAttribute('src') || imageElement?.getAttribute('data-src') || '';

        // Calculate similarity with original product
        const similarity = calculateSimilarity(originalProduct, name);
        
        if (similarity > 0.3) { // Minimum 30% similarity
          results.push({
            platform: platform.name,
            name: name,
            price: `₹${numericPrice.toLocaleString('en-IN')}`,
            url: fullUrl,
            image: imageSrc.startsWith('http') ? imageSrc : undefined,
            availability: 'In Stock',
            numericPrice: numericPrice
          });
        }
      } catch (error) {
        console.error(`Error processing product ${i} from ${platform.name}:`, error);
      }
    }

    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error(`Error searching ${platform.name}:`, error);
  }

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, brand, category, productId } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting cross-platform search for: "${productName}" by "${brand}"`);

    // If productId is provided but productName is empty, try to get product data from database
    let searchName = productName;
    let searchBrand = brand;
    
    if ((!productName || productName.trim().length === 0) && productId) {
      console.log(`Product name empty, fetching from database for ID: ${productId}`);
      const { data: productData, error } = await supabase
        .from('products')
        .select('product_name, brand, original_url')
        .eq('id', productId)
        .single();
      
      if (productData) {
        searchName = productData.product_name;
        searchBrand = productData.brand;
        
        // If still no name, try to extract from URL
        if (!searchName && productData.original_url) {
          if (productData.original_url.includes('/dp/')) {
            const urlParts = productData.original_url.split('/');
            const dpIndex = urlParts.findIndex(part => part === 'dp');
            if (dpIndex > 0 && urlParts[dpIndex - 1]) {
              searchName = urlParts[dpIndex - 1].replace(/-/g, ' ');
              console.log(`Extracted name from URL: ${searchName}`);
            }
          }
        }
      }
    }

    if (!searchName || searchName.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          results: [],
          count: 0,
          message: "Product name is required for search"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean and prepare search queries
    const cleanedName = cleanProductName(searchName);
    const brandName = searchBrand?.replace(/^(Visit the|by)\s*/i, '').trim() || '';
    
    const searchQueries = [
      cleanedName,
      `${brandName} ${cleanedName}`.trim(),
      searchName.split('|')[0].trim() // Take first part before pipe
    ].filter(q => q.length > 3);

    console.log(`Search queries: ${JSON.stringify(searchQueries)}`);

    const allResults: PlatformSearchResult[] = [];

    // Search each platform with different queries
    for (const platform of platforms) {
      for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries per platform
        const platformResults = await searchPlatform(platform, query, searchName);
        allResults.push(...platformResults);
      }
    }

    // Remove duplicates and sort by best match/price
    const uniqueResults = allResults.reduce((acc, current) => {
      const existing = acc.find(item => 
        item.platform === current.platform && 
        calculateSimilarity(item.name, current.name) > 0.8
      );
      
      if (!existing || current.numericPrice < existing.numericPrice) {
        return acc.filter(item => !(item.platform === current.platform && 
          calculateSimilarity(item.name, current.name) > 0.8)).concat(current);
      }
      
      return acc;
    }, [] as PlatformSearchResult[]);

    // Sort by price
    uniqueResults.sort((a, b) => a.numericPrice - b.numericPrice);

    // Save to price history
    for (const result of uniqueResults) {
      try {
        await supabase.from('price_history').insert({
          product_id: productId,
          platform_name: result.platform,
          platform_url: result.url,
          price: result.numericPrice,
          currency: 'INR',
          in_stock: true,
          scraped_at: new Date().toISOString()
        });
      } catch (dbError) {
        console.error('Error saving to DB:', dbError);
      }
    }

    // Find best deal
    const bestDeal = uniqueResults.length > 0 ? uniqueResults[0] : null;
    let message = `Found ${uniqueResults.length} matching products across platforms`;
    
    if (bestDeal) {
      message += `. Best available deal is on ${bestDeal.platform} at ${bestDeal.price}`;
    }

    console.log(message);

    return new Response(
      JSON.stringify({ 
        results: uniqueResults.map(r => ({
          platform: r.platform,
          name: r.name,
          price: r.price,
          link: r.url,
          availability: r.availability,
          image: r.image
        })),
        count: uniqueResults.length,
        message,
        bestDeal: bestDeal ? {
          platform: bestDeal.platform,
          price: bestDeal.price,
          link: bestDeal.url
        } : null
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