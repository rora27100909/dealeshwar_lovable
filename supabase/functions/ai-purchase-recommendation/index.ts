import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product, priceHistory, priceStats } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare data for AI analysis
    const analysisData = {
      productName: product.product_name,
      brand: product.brand,
      category: product.category,
      currentPrice: priceStats.current,
      minPrice: priceStats.min,
      maxPrice: priceStats.max,
      avgPrice: priceStats.avg,
      recentPrices: priceHistory.slice(0, 10).map(h => ({
        price: h.price,
        platform: h.platform_name,
        date: h.scraped_at,
        inStock: h.in_stock
      })),
      savingsFromMax: priceStats.max - priceStats.current,
      priceVariation: ((priceStats.max - priceStats.min) / priceStats.min * 100).toFixed(2)
    };

    const prompt = `
As an expert e-commerce price analyst, analyze this product data and provide a purchase recommendation:

Product: ${analysisData.productName} ${analysisData.brand ? `by ${analysisData.brand}` : ''}
Category: ${analysisData.category || 'Unknown'}

Price Analysis:
- Current Price: ₹${analysisData.currentPrice}
- Lowest Price Ever: ₹${analysisData.minPrice}
- Highest Price Ever: ₹${analysisData.maxPrice}
- Average Price: ₹${analysisData.avgPrice.toFixed(2)}
- Savings from highest: ₹${analysisData.savingsFromMax}
- Price variation: ${analysisData.priceVariation}%

Recent Price History:
${analysisData.recentPrices.map(p => `- ${p.platform}: ₹${p.price} (${new Date(p.date).toLocaleDateString()}) ${p.inStock ? '✓' : '✗'}`).join('\n')}

Provide a JSON response with:
{
  "shouldBuy": boolean,
  "reason": "Brief explanation of why to buy now or wait",
  "pricePoint": "Current price assessment (e.g., 'Good deal', 'Fair price', 'Overpriced')",
  "confidence": number (1-100)
}

Consider factors like:
- Current price vs historical prices
- Recent price trends
- Stock availability
- Seasonal patterns
- Platform comparison
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert e-commerce price analyst. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    let recommendation;
    try {
      recommendation = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // Fallback recommendation
      recommendation = {
        shouldBuy: analysisData.currentPrice <= analysisData.avgPrice,
        reason: "Current price is " + (analysisData.currentPrice <= analysisData.avgPrice ? "below" : "above") + " average. Analysis based on price history.",
        pricePoint: analysisData.currentPrice <= analysisData.minPrice * 1.1 ? "Great deal" : 
                   analysisData.currentPrice <= analysisData.avgPrice ? "Good price" : "Above average",
        confidence: 75
      };
    }

    console.log('AI recommendation generated for product:', product.product_name);

    return new Response(
      JSON.stringify({ recommendation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-purchase-recommendation function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate recommendation',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});