import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, TrendingUp, TrendingDown, Brain, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";

interface Product {
  id: string;
  product_name: string;
  brand?: string;
  image_url?: string;
  category?: string;
  original_url: string;
}

interface PriceHistory {
  id: string;
  product_id: string;
  platform_name: string;
  platform_url: string;
  price: number;
  currency: string;
  in_stock: boolean;
  scraped_at: string;
}

interface PriceStats {
  min: number;
  max: number;
  avg: number;
  current: number;
}

interface AIRecommendation {
  shouldBuy: boolean;
  reason: string;
  pricePoint: string;
  confidence: number;
}

const ProductHistory = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [searchingPlatforms, setSearchingPlatforms] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProductData();
  }, [user, productId]);

  const fetchProductData = async () => {
    if (!productId) return;

    try {
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("user_id", user?.id)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      // Fetch price history
      const { data: historyData, error: historyError } = await supabase
        .from("price_history")
        .select("*")
        .eq("product_id", productId)
        .order("scraped_at", { ascending: false });

      if (historyError) throw historyError;
      setPriceHistory(historyData || []);

      // Calculate price statistics
      if (historyData && historyData.length > 0) {
        const prices = historyData.map(h => h.price);
        const stats: PriceStats = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: prices.reduce((a, b) => a + b, 0) / prices.length,
          current: historyData[0].price
        };
        setPriceStats(stats);
      }
    } catch (error) {
      console.error("Error fetching product data:", error);
      toast({
        title: "Error",
        description: "Failed to load product data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchOtherPlatforms = async () => {
    if (!product) return;
    
    setSearchingPlatforms(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-platforms', {
        body: { 
          productName: product.product_name,
          brand: product.brand,
          category: product.category,
          productId: product.id
        }
      });

      if (error) throw error;
      
      // Refresh price history to show new data
      await fetchProductData();
      
      toast({
        title: "Success",
        description: "Found prices on other platforms!",
      });
    } catch (error) {
      console.error("Error searching platforms:", error);
      toast({
        title: "Error",
        description: "Failed to search other platforms.",
        variant: "destructive",
      });
    } finally {
      setSearchingPlatforms(false);
    }
  };

  const getAIRecommendation = async () => {
    if (!product || !priceStats) return;
    
    setLoadingRecommendation(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-purchase-recommendation', {
        body: { 
          product: product,
          priceHistory: priceHistory.slice(0, 20), // Last 20 entries
          priceStats: priceStats
        }
      });

      if (error) throw error;
      setAiRecommendation(data.recommendation);
    } catch (error) {
      console.error("Error getting AI recommendation:", error);
      toast({
        title: "Error",
        description: "Failed to get AI recommendation.",
        variant: "destructive",
      });
    } finally {
      setLoadingRecommendation(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: currency 
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriceChangeIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (current < previous) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return null;
  };

  const groupByPlatform = (history: PriceHistory[]) => {
    const grouped = history.reduce((acc, item) => {
      if (!acc[item.platform_name]) {
        acc[item.platform_name] = [];
      }
      acc[item.platform_name].push(item);
      return acc;
    }, {} as Record<string, PriceHistory[]>);
    return grouped;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-lg">Loading product data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
            <Button onClick={() => navigate("/products")}>
              Back to Products
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const platformGroups = groupByPlatform(priceHistory);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/products")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
          
          <div className="flex items-start gap-4">
            {product.image_url && (
              <img 
                src={product.image_url} 
                alt={product.product_name}
                className="w-24 h-24 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{product.product_name}</h1>
              {product.brand && (
                <p className="text-lg text-muted-foreground mb-2">{product.brand}</p>
              )}
              {product.category && (
                <Badge variant="secondary">{product.category}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Price Statistics */}
          {priceStats && (
            <Card>
              <CardHeader>
                <CardTitle>Price Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Current Price:</span>
                  <span className="font-semibold">
                    {formatPrice(priceStats.current, priceHistory[0]?.currency || 'INR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Lowest Price:</span>
                  <span className="font-semibold text-green-600">
                    {formatPrice(priceStats.min, priceHistory[0]?.currency || 'INR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Highest Price:</span>
                  <span className="font-semibold text-destructive">
                    {formatPrice(priceStats.max, priceHistory[0]?.currency || 'INR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Average Price:</span>
                  <span className="font-semibold">
                    {formatPrice(priceStats.avg, priceHistory[0]?.currency || 'INR')}
                  </span>
                </div>
                <Separator />
                <div className="text-sm text-muted-foreground text-center">
                  Savings from highest: {formatPrice(priceStats.max - priceStats.current, priceHistory[0]?.currency || 'INR')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Recommendation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Purchase Advice
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiRecommendation ? (
                <div className="space-y-3">
                  <div className={`text-lg font-semibold ${aiRecommendation.shouldBuy ? 'text-green-600' : 'text-orange-600'}`}>
                    {aiRecommendation.shouldBuy ? '✅ Good time to buy' : '⏳ Consider waiting'}
                  </div>
                  <p className="text-sm text-muted-foreground">{aiRecommendation.reason}</p>
                  <div className="text-sm">
                    <strong>Price Point:</strong> {aiRecommendation.pricePoint}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Confidence: {aiRecommendation.confidence}%
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Button 
                    onClick={getAIRecommendation}
                    disabled={loadingRecommendation}
                    className="w-full"
                  >
                    {loadingRecommendation ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Get AI Recommendation
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cross-Platform Search */}
          <Card>
            <CardHeader>
              <CardTitle>Find Better Prices</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Search for this product across other platforms to find the best deals.
              </p>
              <Button 
                onClick={searchOtherPlatforms}
                disabled={searchingPlatforms}
                className="w-full"
              >
                {searchingPlatforms ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search Other Platforms"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Platform Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(platformGroups).map(([platform, histories]) => {
            const latestPrice = histories[0];
            const previousPrice = histories[1];
            
            return (
              <Card key={platform}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{platform}</span>
                    <Badge variant={latestPrice.in_stock ? "default" : "destructive"}>
                      {latestPrice.in_stock ? "In Stock" : "Out of Stock"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">
                        {formatPrice(latestPrice.price, latestPrice.currency)}
                      </span>
                      {previousPrice && getPriceChangeIcon(latestPrice.price, previousPrice.price)}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Recent Price History:</h4>
                      {histories.slice(0, 5).map((history, index) => (
                        <div key={history.id} className="flex justify-between text-sm">
                          <span>{formatDate(history.scraped_at)}</span>
                          <span>{formatPrice(history.price, history.currency)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => window.open(latestPrice.platform_url, '_blank')}
                    >
                      View on {platform}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {priceHistory.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No price history available for this product.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProductHistory;