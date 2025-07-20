import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { chromium } from "npm:playwright@1.40.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductData {
  name: string;
  price: number;
  currency: string;
  image_url?: string;
  brand?: string;
  description?: string;
  category?: string;
  platform_name: string;
  platform_url: string;
  in_stock: boolean;
}

async function scrapeProduct(url: string): Promise<ProductData> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    let productData: ProductData;
    
    if (url.includes('amazon.')) {
      productData = await scrapeAmazon(page, url);
    } else if (url.includes('flipkart.')) {
      productData = await scrapeFlipkart(page, url);
    } else if (url.includes('myntra.')) {
      productData = await scrapeMyntra(page, url);
    } else if (url.includes('ajio.')) {
      productData = await scrapeAjio(page, url);
    } else if (url.includes('nykaa.')) {
      productData = await scrapeNykaa(page, url);
    } else {
      throw new Error('Unsupported platform');
    }
    
    await browser.close();
    return productData;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function scrapeAmazon(page: any, url: string): Promise<ProductData> {
  const name = await page.textContent('#productTitle') || '';
  const priceText = await page.textContent('.a-price-whole') || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  const image = await page.getAttribute('#landingImage', 'src') || '';
  const brand = await page.textContent('#bylineInfo') || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand.replace('Brand:', '').trim(),
    platform_name: 'Amazon',
    platform_url: url,
    in_stock: true
  };
}

async function scrapeFlipkart(page: any, url: string): Promise<ProductData> {
  const name = await page.textContent('.B_NuCI') || '';
  const priceText = await page.textContent('._30jeq3') || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  const image = await page.getAttribute('._396cs4 img', 'src') || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    platform_name: 'Flipkart',
    platform_url: url,
    in_stock: true
  };
}

async function scrapeMyntra(page: any, url: string): Promise<ProductData> {
  const name = await page.textContent('.pdp-name') || '';
  const priceText = await page.textContent('.pdp-price strong') || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  const image = await page.getAttribute('.image-grid-image', 'src') || '';
  const brand = await page.textContent('.pdp-title') || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand.trim(),
    platform_name: 'Myntra',
    platform_url: url,
    in_stock: true
  };
}

async function scrapeAjio(page: any, url: string): Promise<ProductData> {
  const name = await page.textContent('.prod-name') || '';
  const priceText = await page.textContent('.prod-sp') || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  const image = await page.getAttribute('.prod-image img', 'src') || '';
  const brand = await page.textContent('.prod-brand') || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand.trim(),
    platform_name: 'AJIO',
    platform_url: url,
    in_stock: true
  };
}

async function scrapeNykaa(page: any, url: string): Promise<ProductData> {
  const name = await page.textContent('.product-title') || '';
  const priceText = await page.textContent('.post-card__content-price-offer') || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  const image = await page.getAttribute('.product-image img', 'src') || '';
  const brand = await page.textContent('.brand-name') || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand.trim(),
    platform_name: 'Nykaa',
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
    
    if (!url || !user_id) {
      return new Response(
        JSON.stringify({ error: 'URL and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping product from:', url);
    const productData = await scrapeProduct(url);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert product
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        user_id,
        product_name: productData.name,
        brand: productData.brand,
        image_url: productData.image_url,
        description: productData.description,
        category: productData.category,
        original_url: url
      })
      .select()
      .single();

    if (productError) {
      console.error('Error inserting product:', productError);
      throw productError;
    }

    // Insert price history
    const { error: priceError } = await supabase
      .from('price_history')
      .insert({
        product_id: product.id,
        platform_name: productData.platform_name,
        platform_url: productData.platform_url,
        price: productData.price,
        currency: productData.currency,
        in_stock: productData.in_stock
      });

    if (priceError) {
      console.error('Error inserting price history:', priceError);
      throw priceError;
    }

    console.log('Product scraped and saved successfully:', product.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        product: product,
        current_price: productData.price,
        currency: productData.currency
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-product function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});