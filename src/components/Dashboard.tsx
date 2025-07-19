import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Search, TrendingDown, Bell, BarChart3 } from "lucide-react";

const ProductUrlForm = () => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    
    try {
      // TODO: Implement product scraping logic
      console.log("Scraping product from URL:", url);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Product Added Successfully",
        description: "We're now tracking this product across multiple platforms!"
      });
      
      setUrl("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isValidUrl = (urlString: string) => {
    try {
      const url = new URL(urlString);
      return ['amazon.in', 'amazon.com', 'flipkart.com', 'meesho.com', 'myntra.com', 'ajio.com'].some(
        domain => url.hostname.includes(domain)
      );
    } catch {
      return false;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Add Product to Track
        </CardTitle>
        <CardDescription>
          Paste a product URL from Amazon, Flipkart, Meesho, or other supported retailers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-url">Product URL</Label>
            <Input
              id="product-url"
              type="url"
              placeholder="https://www.amazon.in/product/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            {url && !isValidUrl(url) && (
              <p className="text-sm text-destructive">
                Please enter a valid URL from supported retailers
              </p>
            )}
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !isValidUrl(url)}
          >
            {isLoading ? "Analyzing Product..." : "Start Tracking"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: TrendingDown,
      title: "Price Tracking",
      description: "Monitor prices across multiple platforms in real-time"
    },
    {
      icon: Bell,
      title: "Smart Alerts",
      description: "Get notified when prices drop to your target"
    },
    {
      icon: BarChart3,
      title: "AI Insights",
      description: "Get AI-powered buying recommendations based on price trends"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Smart Price Comparison
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Track products across platforms, get price alerts, and make informed buying decisions with AI insights
        </p>
      </div>

      <ProductUrlForm />

      <div className="grid md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="text-center">
            <CardHeader>
              <feature.icon className="h-8 w-8 mx-auto text-primary" />
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Supported Platforms</CardTitle>
          <CardDescription>
            We track prices across these major Indian e-commerce platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {['Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Ajio', 'More Soon'].map((platform) => (
              <div key={platform} className="p-3 bg-background rounded-lg border">
                <span className="font-medium">{platform}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;