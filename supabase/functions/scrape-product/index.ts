import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };
  
  const response = await fetch(url, { headers });
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  
  if (!doc) {
    throw new Error('Failed to parse HTML');
  }
  
  if (url.includes('amazon.')) {
    return scrapeAmazon(doc, url);
  } else if (url.includes('flipkart.')) {
    return scrapeFlipkart(doc, url);
  } else if (url.includes('myntra.')) {
    return scrapeMyntra(doc, url);
  } else if (url.includes('ajio.')) {
    return scrapeAjio(doc, url);
  } else if (url.includes('nykaa.')) {
    return scrapeNykaa(doc, url);
  } else {
    throw new Error('Unsupported platform');
  }
}

function scrapeAmazon(doc: any, url: string): ProductData {
  console.log('Scraping Amazon product...');
  console.log('HTML snippet:', doc.documentElement.innerHTML.substring(0, 1000));
  
  // Enhanced selectors for product title
  const nameSelectors = [
    '#productTitle', 
    'h1 span#productTitle',
    '.a-size-large.a-size-base-plus.a-color-base.a-text-normal',
    '[data-automation-id="product-title"]',
    'h1.a-size-large',
    'h1 span',
    '.product-title'
  ];
  let name = '';
  for (const selector of nameSelectors) {
    const el = doc.querySelector(selector);
    if (el?.textContent?.trim()) {
      name = el.textContent.trim();
      console.log(`Found name with selector ${selector}: ${name}`);
      break;
    }
  }
  
  // Debug: log all elements that might contain title
  if (!name) {
    console.log('No title found, checking all h1 elements:');
    const allH1 = doc.querySelectorAll('h1');
    for (let i = 0; i < allH1.length; i++) {
      console.log(`H1 ${i}: ${allH1[i]?.textContent?.trim()}`);
    }
  }
  
  // Enhanced price selectors - try simple selectors first
  const priceSelectors = [
    'span.a-price-whole',
    '.a-price .a-offscreen',
    '.a-price-current .a-offscreen',
    '.a-price.a-text-price .a-offscreen',
    '.a-price-whole',
    '[data-a-price-whole]',
    '.a-color-price',
    '.a-price.a-text-normal .a-offscreen'
  ];
  let price = 0;
  
  for (const selector of priceSelectors) {
    const el = doc.querySelector(selector);
    if (el?.textContent) {
      const priceText = el.textContent.replace(/[₹,\s]/g, '').replace(/[^\d.]/g, '');
      console.log(`Price text from ${selector}: "${el.textContent}" -> "${priceText}"`);
      if (priceText && parseFloat(priceText) > 0) {
        price = parseFloat(priceText);
        console.log(`Found price: ${price}`);
        break;
      }
    }
  }
  
  // Debug: if no price found, check all price-related elements
  if (price === 0) {
    console.log('No price found with selectors, checking all price elements:');
    const priceElements = doc.querySelectorAll('[class*="price"]');
    for (let i = 0; i < Math.min(priceElements.length, 10); i++) {
      console.log(`Price element ${i}: ${priceElements[i]?.textContent?.trim()}`);
    }
    
    // Try to extract from any element containing currency symbols
    const currencyElements = doc.querySelectorAll('*');
    for (const el of currencyElements) {
      if (el?.textContent && /[₹$€£][\d,]+/.test(el.textContent)) {
        const priceMatch = el.textContent.match(/[₹$€£]([\d,]+(?:\.\d{2})?)/);
        if (priceMatch) {
          const priceText = priceMatch[1].replace(/,/g, '');
          price = parseFloat(priceText);
          console.log(`Found price via currency search: ${price} from ${el.textContent}`);
          if (price > 0) break;
        }
      }
    }
  }
  
  // Multiple selectors for image
  const imageSelectors = [
    '#landingImage', 
    '#imgTagWrapperId img', 
    '[data-old-hires]', 
    '.a-dynamic-image',
    '.a-image-wrapper img',
    '#imageBlock img'
  ];
  let image = '';
  for (const selector of imageSelectors) {
    const el = doc.querySelector(selector);
    if (el?.getAttribute('src') || el?.getAttribute('data-old-hires')) {
      image = el.getAttribute('src') || el.getAttribute('data-old-hires') || '';
      if (image && !image.includes('data:image')) {
        console.log(`Found image: ${image}`);
        break;
      }
    }
  }
  
  // Enhanced brand selectors
  const brandSelectors = [
    '#bylineInfo', 
    '[data-brand]', 
    '.a-size-base.po-brand', 
    'a[data-brand]',
    '.a-row .a-link-normal',
    '#brand',
    '.brand'
  ];
  let brand = '';
  for (const selector of brandSelectors) {
    const el = doc.querySelector(selector);
    if (el?.textContent?.trim()) {
      brand = el.textContent.replace(/^(Brand:|Visit the|by)\s*/i, '').trim();
      if (brand && brand.length > 1) {
        console.log(`Found brand: ${brand}`);
        break;
      }
    }
  }
  
  console.log(`Amazon scraping result: name="${name}", price=${price}, brand="${brand}"`);
  
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

function scrapeFlipkart(doc: any, url: string): ProductData {
  const nameEl = doc.querySelector('.B_NuCI') || doc.querySelector('h1');
  const name = nameEl?.textContent?.trim() || '';
  
  const priceEl = doc.querySelector('._30jeq3') || doc.querySelector('._1_WHN1');
  const priceText = priceEl?.textContent || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  
  const imageEl = doc.querySelector('._396cs4 img') || doc.querySelector('img[class*="product"]');
  const image = imageEl?.getAttribute('src') || '';
  
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

function scrapeMyntra(doc: any, url: string): ProductData {
  const nameEl = doc.querySelector('.pdp-name') || doc.querySelector('h1');
  const name = nameEl?.textContent?.trim() || '';
  
  const priceEl = doc.querySelector('.pdp-price strong') || doc.querySelector('[class*="price"]');
  const priceText = priceEl?.textContent || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  
  const imageEl = doc.querySelector('.image-grid-image') || doc.querySelector('img[class*="product"]');
  const image = imageEl?.getAttribute('src') || '';
  
  const brandEl = doc.querySelector('.pdp-title');
  const brand = brandEl?.textContent?.trim() || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand,
    platform_name: 'Myntra',
    platform_url: url,
    in_stock: true
  };
}

function scrapeAjio(doc: any, url: string): ProductData {
  const nameEl = doc.querySelector('.prod-name') || doc.querySelector('h1');
  const name = nameEl?.textContent?.trim() || '';
  
  const priceEl = doc.querySelector('.prod-sp') || doc.querySelector('[class*="price"]');
  const priceText = priceEl?.textContent || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  
  const imageEl = doc.querySelector('.prod-image img') || doc.querySelector('img[class*="product"]');
  const image = imageEl?.getAttribute('src') || '';
  
  const brandEl = doc.querySelector('.prod-brand');
  const brand = brandEl?.textContent?.trim() || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand,
    platform_name: 'AJIO',
    platform_url: url,
    in_stock: true
  };
}

function scrapeNykaa(doc: any, url: string): ProductData {
  const nameEl = doc.querySelector('.product-title') || doc.querySelector('h1');
  const name = nameEl?.textContent?.trim() || '';
  
  const priceEl = doc.querySelector('.post-card__content-price-offer') || doc.querySelector('[class*="price"]');
  const priceText = priceEl?.textContent || '0';
  const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
  
  const imageEl = doc.querySelector('.product-image img') || doc.querySelector('img[class*="product"]');
  const image = imageEl?.getAttribute('src') || '';
  
  const brandEl = doc.querySelector('.brand-name');
  const brand = brandEl?.textContent?.trim() || '';
  
  return {
    name: name.trim(),
    price,
    currency: 'INR',
    image_url: image,
    brand: brand,
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

    // Auto-trigger cross-platform search
    try {
      await supabase.functions.invoke('search-platforms', {
        body: {
          productName: productData.name,
          brand: productData.brand
        }
      });
    } catch (searchError) {
      console.log('Cross-platform search failed:', searchError.message);
    }

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