import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import FirecrawlApp from 'https://esm.sh/@mendable/firecrawl-js@1.29.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')!;

interface ProductData {
  name: string;
  price: number;
  currency: string;
  image_url?: string;
  brand?: string;
  platform_name: string;
  platform_url: string;
  in_stock: boolean;
}

async function scrapeProductWithFirecrawl(url: string): Promise<ProductData> {
  console.log(`Scraping product with Firecrawl from: ${url}`);
  
  const app = new FirecrawlApp({ apiKey: firecrawlApiKey });
  
  try {
    const scrapeResult = await app.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'span', 'div'],
      excludeTags: ['script', 'style', 'nav', 'footer'],
      onlyMainContent: true
    });

    if (!scrapeResult.success) {
      throw new Error('Failed to scrape with Firecrawl');
    }

    console.log('Firecrawl scrape successful, processing data...');
    
    const content = scrapeResult.data?.markdown || '';
    const htmlContent = scrapeResult.data?.html || '';
    
    // Extract product data from the scraped content
    let productData: ProductData = {
      name: '',
      price: 0,
      currency: 'INR',
      platform_name: getPlatformName(url),
      platform_url: url,
      in_stock: true
    };

    if (url.includes('amazon.')) {
      productData = extractAmazonData(content, htmlContent, url);
    } else if (url.includes('flipkart.')) {
      productData = extractFlipkartData(content, htmlContent, url);
    } else if (url.includes('myntra.')) {
      productData = extractMyntraData(content, htmlContent, url);
    } else if (url.includes('ajio.')) {
      productData = extractAjioData(content, htmlContent, url);
    } else if (url.includes('nykaa.')) {
      productData = extractNykaaData(content, htmlContent, url);
    } else {
      // Generic extraction
      productData = extractGenericData(content, htmlContent, url);
    }

    console.log(`Extracted product data: name="${productData.name}", price=${productData.price}, brand="${productData.brand}"`);
    return productData;
    
  } catch (error) {
    console.error('Firecrawl scraping failed:', error);
    
    // Fallback to URL-based extraction
    const fallbackName = extractNameFromUrl(url);
    return {
      name: fallbackName || 'Unknown Product',
      price: 0,
      currency: 'INR',
      platform_name: getPlatformName(url),
      platform_url: url,
      in_stock: true
    };
  }
}

function getPlatformName(url: string): string {
  if (url.includes('amazon.')) return 'Amazon';
  if (url.includes('flipkart.')) return 'Flipkart';
  if (url.includes('myntra.')) return 'Myntra';
  if (url.includes('ajio.')) return 'Ajio';
  if (url.includes('nykaa.')) return 'Nykaa';
  return 'Unknown';
}

function extractNameFromUrl(url: string): string {
  try {
    if (url.includes('/dp/') && url.includes('amazon.')) {
      const urlParts = url.split('/');
      const dpIndex = urlParts.findIndex(part => part === 'dp');
      if (dpIndex > 0 && urlParts[dpIndex - 1]) {
        return urlParts[dpIndex - 1].replace(/-/g, ' ');
      }
    }
    
    // Generic URL-based name extraction
    const pathParts = new URL(url).pathname.split('/').filter(part => part.length > 3);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/[-_]/g, ' ');
    }
  } catch (error) {
    console.error('Error extracting name from URL:', error);
  }
  return '';
}

function extractAmazonData(markdown: string, html: string, url: string): ProductData {
  console.log('Extracting Amazon product data...');
  
  let name = '';
  let price = 0;
  let brand = '';
  let image = '';

  // Extract product name from markdown
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    name = titleMatch[1].trim();
  }

  // Extract price from markdown - look for currency symbols
  const priceMatches = markdown.match(/₹[\d,]+(?:\.\d{2})?|Rs[\.\s]?[\d,]+(?:\.\d{2})?|\$[\d,]+(?:\.\d{2})?/g);
  if (priceMatches) {
    const priceText = priceMatches[0].replace(/[₹Rs\$,\s]/g, '');
    const numericPrice = parseFloat(priceText);
    if (!isNaN(numericPrice) && numericPrice > 0) {
      price = numericPrice;
    }
  }

  // Extract brand - look for "Visit the X Store" or "Brand: X"
  const brandMatch = markdown.match(/Visit the (.+?) Store|Brand:\s*(.+?)(?:\n|$)/i);
  if (brandMatch) {
    brand = (brandMatch[1] || brandMatch[2]).trim();
  }

  // Extract image from HTML
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) {
    image = imgMatch[1];
  }

  // Fallback name extraction if needed
  if (!name) {
    name = extractNameFromUrl(url) || 'Unknown Product';
  }

  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand,
    platform_name: 'Amazon',
    platform_url: url,
    in_stock: true
  };
}

function extractFlipkartData(markdown: string, html: string, url: string): ProductData {
  console.log('Extracting Flipkart product data...');
  
  let name = '';
  let price = 0;
  let brand = '';

  // Extract name
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    name = titleMatch[1].trim();
  }

  // Extract price
  const priceMatches = markdown.match(/₹[\d,]+(?:\.\d{2})?/g);
  if (priceMatches) {
    const priceText = priceMatches[0].replace(/[₹,]/g, '');
    const numericPrice = parseFloat(priceText);
    if (!isNaN(numericPrice) && numericPrice > 0) {
      price = numericPrice;
    }
  }

  if (!name) {
    name = extractNameFromUrl(url) || 'Unknown Product';
  }

  return {
    name: name.trim(),
    price,
    currency: 'INR',
    brand: brand,
    platform_name: 'Flipkart',
    platform_url: url,
    in_stock: true
  };
}

function extractMyntraData(markdown: string, html: string, url: string): ProductData {
  return extractGenericData(markdown, html, url, 'Myntra');
}

function extractAjioData(markdown: string, html: string, url: string): ProductData {
  return extractGenericData(markdown, html, url, 'Ajio');
}

function extractNykaaData(markdown: string, html: string, url: string): ProductData {
  return extractGenericData(markdown, html, url, 'Nykaa');
}

function extractGenericData(markdown: string, html: string, url: string, platformName?: string): ProductData {
  console.log(`Extracting generic product data for ${platformName || 'unknown platform'}...`);
  
  let name = '';
  let price = 0;

  // Extract name from first heading
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    name = titleMatch[1].trim();
  }

  // Extract price - look for any currency format
  const priceMatches = markdown.match(/₹[\d,]+(?:\.\d{2})?|Rs[\.\s]?[\d,]+(?:\.\d{2})?|\$[\d,]+(?:\.\d{2})?/g);
  if (priceMatches) {
    const priceText = priceMatches[0].replace(/[₹Rs\$,\s]/g, '');
    const numericPrice = parseFloat(priceText);
    if (!isNaN(numericPrice) && numericPrice > 0) {
      price = numericPrice;
    }
  }

  if (!name) {
    name = extractNameFromUrl(url) || 'Unknown Product';
  }

  return {
    name: name.trim(),
    price,
    currency: 'INR',
    platform_name: platformName || getPlatformName(url),
    platform_url: url,
    in_stock: true
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, user_id } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Scrape product data using Firecrawl
    const productData = await scrapeProductWithFirecrawl(url);

    // Insert product into database
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        user_id: user_id,
        original_url: url,
        product_name: productData.name,
        brand: productData.brand,
        image_url: productData.image_url,
        category: null, // Can be enhanced later
        description: null
      })
      .select()
      .single();

    if (productError) throw productError;

    // Insert price history
    const { error: priceError } = await supabase
      .from('price_history')
      .insert({
        product_id: product.id,
        platform_name: productData.platform_name,
        platform_url: productData.platform_url,
        price: productData.price,
        currency: productData.currency,
        in_stock: productData.in_stock,
        scraped_at: new Date().toISOString()
      });

    if (priceError) throw priceError;

    console.log(`Product scraped and saved successfully: ${product.id}`);

    // Optionally trigger cross-platform search
    try {
      await supabase.functions.invoke('search-platforms', {
        body: {
          productName: productData.name,
          brand: productData.brand,
          category: null,
          productId: product.id
        }
      });
    } catch (searchError) {
      console.error('Error triggering cross-platform search:', searchError);
      // Don't fail the main operation if search fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        product: product,
        productData: productData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-product function:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to scrape product',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});