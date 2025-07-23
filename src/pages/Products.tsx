import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  product_name: string;
  brand?: string;
  image_url?: string;
  category?: string;
  original_url: string;
  created_at: string;
}

interface PriceHistory {
  id: string;
  product_id: string;
  platform_name: string;
  price: number;
  currency: string;
  in_stock: boolean;
  scraped_at: string;
}

const Products = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProducts();
  }, [user, navigate]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // Fetch user's products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch latest price history for each product
      if (productsData && productsData.length > 0) {
        const { data: priceData, error: priceError } = await supabase
          .from("price_history")
          .select("*")
          .in("product_id", productsData.map(p => p.id))
          .order("scraped_at", { ascending: false });

        if (priceError) throw priceError;
        setPriceHistory(priceData || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load your products. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getLatestPrice = (productId: string) => {
    return priceHistory
      .filter(p => p.product_id === productId)
      .sort((a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime())[0];
  };

  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Products</h1>
            <p className="text-muted-foreground">
              Track {products.length} products across multiple platforms
            </p>
          </div>
          <Button onClick={() => navigate("/")} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>

        {products.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary">
              {filteredProducts.length} of {products.length} products
            </Badge>
          </div>
        )}

        {products.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>No Products Yet</CardTitle>
              <CardDescription>
                Start tracking products by adding a product URL from supported retailers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/")} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Product
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const latestPrice = getLatestPrice(product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  currentPrice={latestPrice ? {
                    price: latestPrice.price,
                    currency: latestPrice.currency,
                    platform_name: latestPrice.platform_name,
                    in_stock: latestPrice.in_stock
                  } : undefined}
                  onViewHistory={(productId) => navigate(`/products/${productId}/history`)}
                  onSetAlert={(productId) => {
                    toast({
                      title: "Coming Soon",
                      description: "Price alerts will be available soon!",
                    });
                  }}
                  onDelete={async (productId) => {
                    try {
                      const { error } = await supabase
                        .from('products')
                        .delete()
                        .eq('id', productId);
                      
                      if (error) throw error;
                      
                      toast({
                        title: "Product Deleted",
                        description: "Product has been removed from tracking",
                      });
                      
                      // Refresh the products list
                      fetchProducts();
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to delete product",
                        variant: "destructive",
                      });
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Products;