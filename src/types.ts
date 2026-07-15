export interface Product {
  id: string;
  title: string;
  price: number;
  description: string;
  category: string; // 'outerwear' | 'tops' | 'bottoms' | 'accessories'
  imageUrl: string;
  status: 'Available' | 'Sold' | 'On Hold';
  tags: string[];
  size: string;
  dateAdded: string;
  product_images?: Array<{ image_url: string }>;
}

export interface Draft {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  size: string;
  dateAdded: string;
  sender: string;
  status: 'Pending Review';
}

export interface MessageStatus {
  id: string;
  imageUrl: string;
  timestamp: string;
  viewed: boolean;
}

export interface Order {
  id: string;
  productId: string;
  productTitle: string;
  price: number;
  size: string;
  imageUrl: string;
  customerPhone: string;
  customerName: string;
  dateOrdered: string;
  status: string;
}

export interface Chat {
  id: string;
  sender: string;
  name: string;
  message: string;
  timestamp: string;
  isFromCustomer: boolean;
}

export interface Delivery {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  status: 'Pending' | 'In Transit' | 'Delivered' | 'Cancelled';
  riderLocation?: {
    lat: number;
    lng: number;
  };
  estimatedTime?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Analytics {
  totalVisits: number;
  returningVisitors: number;
  contacts: {
    total: number;
    byCategory: Record<string, number>;
  };
}

export interface ShopInfo {
  name: string;
  description: string;
  phone?: string;
  email?: string;
  contact?: {
    phone: string;
    email: string;
  };
  social?: {
    instagram?: string;
    x?: string;
  };
  subscription?: {
    active: boolean;
    plan?: string;
  };
  adsConfig?: {
    enabled: boolean;
    bannerUrl?: string;
    targetUrl?: string;
    interstitialUrl?: string;
  };
}