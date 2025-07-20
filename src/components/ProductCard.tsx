import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Minus, ExternalLink, Bell } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ProductCardProps {
  product: {
    id: string;
    product_name: string;
    brand?: string;
    image_url?: string;
    category?: string;
    original_url: string;
  };
  currentPrice?: {
    price: number;
    currency: string;
    platform_name: string;
    in_stock: boolean;
  };
  priceChange?: {
    amount: number;
    percentage: number;
  };
  onSetAlert?: (productId: string) => void;
  onViewHistory?: (productId: string) => void;
}

const ProductCard = ({ 
  product, 
  currentPrice, 
  priceChange, 
  onSetAlert, 
  onViewHistory 
}: ProductCardProps) => {
  const getPriceChangeIcon = () => {
    if (!priceChange) return <Minus className="h-4 w-4" />;
    if (priceChange.amount > 0) return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (priceChange.amount < 0) return <TrendingDown className="h-4 w-4 text-green-600" />;
    return <Minus className="h-4 w-4" />;
  };

  const getPriceChangeColor = () => {
    if (!priceChange) return "text-muted-foreground";
    if (priceChange.amount > 0) return "text-destructive";
    if (priceChange.amount < 0) return "text-green-600";
    return "text-muted-foreground";
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex gap-3">
          {product.image_url && (
            <img 
              src={product.image_url} 
              alt={product.product_name}
              className="w-16 h-16 object-cover rounded-md border"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg line-clamp-2 leading-tight">
              {product.product_name}
            </CardTitle>
            {product.brand && (
              <CardDescription className="text-sm mt-1">
                {product.brand}
              </CardDescription>
            )}
            {product.category && (
              <Badge variant="secondary" className="mt-2 w-fit">
                {product.category}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {currentPrice && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(currentPrice.price, currentPrice.currency)}
                </p>
                <p className="text-sm text-muted-foreground">
                  on {currentPrice.platform_name}
                </p>
              </div>
              <Badge variant={currentPrice.in_stock ? "default" : "destructive"}>
                {currentPrice.in_stock ? "In Stock" : "Out of Stock"}
              </Badge>
            </div>
            
            {priceChange && (
              <div className={`flex items-center gap-1 ${getPriceChangeColor()}`}>
                {getPriceChangeIcon()}
                <span className="text-sm font-medium">
                  {formatCurrency(Math.abs(priceChange.amount), currentPrice.currency)}
                  {" "}({Math.abs(priceChange.percentage).toFixed(1)}%)
                </span>
                <span className="text-xs text-muted-foreground">
                  vs last check
                </span>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open(product.original_url, '_blank')}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Product
          </Button>
          {onSetAlert && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetAlert(product.id)}
            >
              <Bell className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {onViewHistory && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onViewHistory(product.id)}
            className="w-full"
          >
            View Price History
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductCard;