import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting daily price scraping...');

    // Get all products that need price updates
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }

    console.log(`Found ${products?.length || 0} products to update`);

    let successCount = 0;
    let errorCount = 0;

    // Process each product
    for (const product of products || []) {
      try {
        console.log(`Scraping product: ${product.product_name}`);
        
        // Call the scrape-product function to get updated price
        const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('scrape-product', {
          body: {
            url: product.original_url,
            user_id: product.user_id
          }
        });

        if (scrapeError) {
          console.error(`Error scraping product ${product.id}:`, scrapeError);
          errorCount++;
          continue;
        }

        console.log(`Successfully updated price for product: ${product.product_name}`);
        successCount++;

        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Daily scraping completed. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Daily scraping completed. Updated ${successCount} products, ${errorCount} errors.`,
        successCount,
        errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily price scraper:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Daily price scraping failed',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});