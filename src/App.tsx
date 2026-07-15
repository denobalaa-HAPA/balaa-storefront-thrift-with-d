import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Product, Draft, Order, Chat, Analytics } from "./types";
import Product3DCarousel from "./components/Product3DCarousel";
import ProductInquiryModal from "./components/ProductInquiryModal";
import StoreDirections from "./components/StoreDirections";
import ParticleBackground from "./components/ParticleBackground";
import MobileGitAdminApp from "./components/MobileGitAdminApp";

const localDatabase: { products: Product[]; drafts: Draft[]; orders: Order[]; chats: Chat[] } = {
  products: [
    {
      id: "prod-1",
      name: "Vintage Denim Jacket",
      price: 2500,
      description: "Classic retro denim jacket, perfect condition.",
      category: "jacket",
      status: "Available",
      imageUrl: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=600&q=80",
      created_at: new Date().toISOString()
    },
    {
      id: "prod-2",
      name: "Retro Graphic Tee",
      price: 1200,
      description: "90s band graphic tshirt, soft cotton.",
      category: "tshirt",
      status: "Available",
      imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80",
      created_at: new Date().toISOString()
    }
  ],
  drafts: [],
  orders: [],
  chats: []
};
import { 
  RefreshCw, 
  Shirt, 
  Compass,
  Download,
  Smartphone
} from "lucide-react";

type LocalDatabase = {
  products?: Product[];
  drafts?: Draft[];
  orders?: Order[];
  chats?: Chat[];
};

type AiStatus = {
  configured: boolean;
};

type ActiveTab = "archive" | "directions";

const CATEGORIES = ["All", "shirt", "tshirt", "dress", "trouser", "shoe", "boxer_short", "jacket", "bag", "accessory"];
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const isAdminAppRoute = () => {
  const cleanPath = window.location.pathname.replace(/\/+$/, "");
  return window.location.hash === "#/admin" || cleanPath.endsWith("/admin");
};

const resolveCatalogAssetUrl = (url: string) => {
  if (!url || /^(https?:|data:|blob:)/.test(url)) return url;
  if (!url.startsWith("/")) return url;

  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${url.replace(/^\/+/, "")}`;
};

const withResolvedImageUrl = <T extends { imageUrl: string }>(item: T): T => ({
  ...item,
  imageUrl: resolveCatalogAssetUrl(item.imageUrl),
});

const getStaticStoreData = () => {
  const db = localDatabase as LocalDatabase;

  return {
    products: (db.products ?? []).map(withResolvedImageUrl),
    drafts: (db.drafts ?? []).map(withResolvedImageUrl),
    orders: (db.orders ?? []).map(withResolvedImageUrl),
    chats: db.chats ?? [],
  };
};

const fetchJson = async <T,>(url: string): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;

    return (await response.json()) as T;
  } catch (err) {
    console.warn(`Unable to load ${url}; falling back to bundled store data.`, err);
    return null;
  }
};

import AyoAdminCompanion from "./components/AyoAdminCompanion";

const isMasterAdminAppRoute = () => {
  if (Capacitor.isNativePlatform()) return false;
  const cleanPath = window.location.pathname.replace(/\/+$/, "");
  return (
    window.location.hash === "#/master-admin" ||
    cleanPath.endsWith("/master-admin") ||
    cleanPath.endsWith("/master-admin.html")
  );
};

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(isAdminAppRoute);
  const [isMasterRoute, setIsMasterRoute] = useState(isMasterAdminAppRoute);

  useEffect(() => {
    const syncRoute = () => {
      setIsAdminRoute(isAdminAppRoute());
      setIsMasterRoute(isMasterAdminAppRoute());
    };
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  const closeAdminApp = () => {
    window.location.hash = "";
    setIsAdminRoute(false);
    setIsMasterRoute(false);
  };

  if (isMasterRoute) {
    return <AyoAdminCompanion onClose={closeAdminApp} />;
  }

  if (isAdminRoute) {
    return <MobileGitAdminApp onExit={Capacitor.isNativePlatform() ? undefined : closeAdminApp} />;
  }

  return <StorefrontApp />;
}

function StorefrontApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  
  const [activeTab, setActiveTab] = useState<ActiveTab>("archive");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [apiConfigured, setApiConfigured] = useState(false);
  const productsRef = useRef<Product[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  // Ad-related states
  const [shopInfo, setShopInfo] = useState<{
    subscription: { active: boolean; expiryDate: string; tillNumber: string; priceKsh: number };
    adsConfig: { enabled: boolean; bannerUrl: string; targetUrl: string; interstitialUrl: string };
    metrics: { totalUploaded: number; totalSold: number; totalDeleted: number };
  } | null>(null);
  const [showInterstitial, setShowInterstitial] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState("All");

  const storefrontProducts = products.filter((product) => {
    const isAvailable = product.status === "Available";
    if (selectedCategory === "All") return isAvailable;
    return isAvailable && product.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Fetch all data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setErrorText("");

      const staticData = getStaticStoreData();
      const [apiProducts, apiDrafts, apiOrders, apiChats, aiStatus, apiShopInfo] = await Promise.all([
        fetchJson<Product[]>(`${API_BASE_URL}/api/products`),
        fetchJson<Draft[]>(`${API_BASE_URL}/api/drafts`),
        fetchJson<Order[]>(`${API_BASE_URL}/api/orders`),
        fetchJson<Chat[]>(`${API_BASE_URL}/api/chats`),
        fetchJson<AiStatus>(`${API_BASE_URL}/api/ai-status`),
        fetchJson<any>(`${API_BASE_URL}/api/shop-info`)
      ]);

      setProducts(apiProducts ?? staticData.products);
      setDrafts(apiDrafts ?? staticData.drafts);
      setOrders(apiOrders ?? staticData.orders);
      setChats(apiChats ?? staticData.chats);
      setApiConfigured(aiStatus?.configured ?? false);
      if (apiShopInfo) {
        setShopInfo(apiShopInfo);
      }
    } catch (err) {
      console.error(err);
      const staticData = getStaticStoreData();
      setProducts(staticData.products);
      setDrafts(staticData.drafts);
      setOrders(staticData.orders);
      setChats(staticData.chats);
      setApiConfigured(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);



  // Analytics visitor tracking
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        const lastVisit = localStorage.getItem("last_visit_time");
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (!lastVisit) {
          localStorage.setItem("last_visit_time", now.toString());
          await fetch(`${API_BASE_URL}/api/analytics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "visit" }),
          });
        } else if (now - Number(lastVisit) > oneDayMs) {
          localStorage.setItem("last_visit_time", now.toString());
          await fetch(`${API_BASE_URL}/api/analytics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "returning_visit" }),
          });
        }
      } catch (err) {
        console.warn("Analytics tracking failed:", err);
      }
    };
    trackVisitor();
  }, []);

  // AdSense push initializer
  useEffect(() => {
    if (shopInfo && !shopInfo.subscription?.active && shopInfo.adsConfig?.enabled) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Suppress push errors in local development
      }
    }
  }, [shopInfo]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    const archiveState = { dyos: true, tab: "archive" as ActiveTab, guard: false };
    const currentState = window.history.state as {
      dyos?: boolean;
      tab?: ActiveTab;
      productId?: string;
      guard?: boolean;
    } | null;

    if (currentState?.dyos) {
      const nextTab: ActiveTab = currentState.tab === "directions" ? "directions" : "archive";
      setActiveTab(nextTab);

      if (nextTab === "archive" && !currentState.productId && !currentState.guard) {
        window.history.pushState({ ...archiveState, guard: true }, "", window.location.href);
      }
    } else {
      window.history.replaceState(archiveState, "", window.location.href);
      window.history.pushState({ ...archiveState, guard: true }, "", window.location.href);
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as {
        dyos?: boolean;
        tab?: ActiveTab;
        productId?: string;
        guard?: boolean;
      } | null;

      if (!state?.dyos) {
        window.history.pushState({ ...archiveState, guard: true }, "", window.location.href);
        setActiveTab("archive");
        setSelectedProduct(null);
        return;
      }

      const nextTab: ActiveTab = state.tab === "directions" ? "directions" : "archive";
      const nextProduct = state.productId
        ? productsRef.current.find((product) => product.id === state.productId) ?? null
        : null;

      setActiveTab(nextTab);
      setSelectedProduct(nextProduct);

      if (nextTab === "archive" && !nextProduct && !state.guard) {
        window.history.pushState({ ...archiveState, guard: true }, "", window.location.href);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await fetchJson<Order[]>(`${API_BASE_URL}/api/orders`);
      if (data) setOrders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChats = async () => {
    try {
      const data = await fetchJson<Chat[]>(`${API_BASE_URL}/api/chats`);
      if (data) setChats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDrafts = async () => {
    try {
      const data = await fetchJson<Draft[]>(`${API_BASE_URL}/api/drafts`);
      if (data) setDrafts(data);
    } catch (e) {
      console.error(e);
    }
  };

// Place order tracker callback
   const handlePlaceOrder = async (product: Product) => {
     try {
       await fetch(`${API_BASE_URL}/api/analytics/track`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ event: "contact_click", category: product.category }),
       }).catch((err) => console.warn("Analytics contact click tracking failed:", err));

       await fetch(`${API_BASE_URL}/api/orders`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           productId: product.id,
           productTitle: product.title,
           price: product.price,
           imageUrl: product.imageUrl,
           size: product.size,
           customerName: "Kamau Njuguna",
           customerPhone: "+254 711 500201"
         }),
       });
       fetchOrders();
       fetchChats();
     } catch (err) {
       console.error("Order placement error:", err);
     }
   };

  // Ayo admin companion handlers
  const handlePublishDraft = async (id: string, updatedDraft: Partial<Draft>) => {
    const res = await fetch(`${API_BASE_URL}/api/drafts/publish/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedDraft),
    });
    if (res.ok) {
      await Promise.all([fetchDrafts(), fetchOrders(), fetchChats()]);
      // Reload products list to populate generated products
      const data = await fetchJson<Product[]>(`${API_BASE_URL}/api/products`);
      if (data) setProducts(data);
    }
  };

  const handleDiscardDraft = async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/api/drafts/${id}`, { method: "DELETE" });
    if (res.ok) await fetchDrafts();
  };

  const handleSimulateMediaArrival = async (imageUrl: string, sender: string) => {
    const res = await fetch(`${API_BASE_URL}/api/drafts/whatsapp-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, sender }),
    });
    if (res.ok) await fetchDrafts();
  };

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === activeTab && !selectedProduct) return;

    setActiveTab(tab);
    setSelectedProduct(null);
    window.history.pushState({ dyos: true, tab, guard: true }, "", window.location.href);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    window.history.pushState(
      { dyos: true, tab: activeTab, productId: product.id, guard: true },
      "",
      window.location.href
    );
  };

  const handleCloseProduct = () => {
    const state = window.history.state as { dyos?: boolean; productId?: string } | null;
    if (state?.dyos && state.productId) {
      window.history.back();
      return;
    }

    setSelectedProduct(null);
  };

  const handleProductDirections = () => {
    setActiveTab("directions");
    setSelectedProduct(null);
    window.history.replaceState({ dyos: true, tab: "directions", guard: true }, "", window.location.href);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#0a0a0a] text-[#FAF6EE] overflow-hidden font-sans antialiased relative flex flex-col justify-between">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 right-0 hidden sm:block w-[450px] h-[450px] bg-[#e0ff4f]/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 hidden sm:block w-[450px] h-[450px] bg-[#e0ff4f]/4 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Interactive Particle Background */}
      <ParticleBackground />

      {/* Modern Glassmorphic Header */}
      <header className="w-full z-50 bg-stone-950/95 sm:bg-stone-950/60 sm:backdrop-blur-md border-b border-stone-900 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-xl relative will-change-transform" style={{ transform: "translate3d(0, 0, 0)" }}>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 bg-[#e0ff4f] rounded-xl flex items-center justify-center text-[#12100E] font-sans font-black tracking-tighter text-lg shadow-md shadow-[#e0ff4f]/15 border border-[#FAF6EE]/10 select-none">
            D
          </div>
          <div>
            <h1 className="font-sans font-black text-sm uppercase tracking-widest text-[#FAF6EE]">
              Thrift With D
            </h1>
            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider block">
              Curated Thrift • Nairobi
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="hidden sm:flex items-center gap-1 bg-stone-900/60 p-1 rounded-xl border border-stone-850">
          <button
            onClick={() => handleTabChange("archive")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
              activeTab === "archive"
                ? "bg-[#e0ff4f] text-[#12100E] shadow-md"
                : "text-stone-400 hover:text-[#FAF6EE]"
            }`}
          >
            Catalog
          </button>
          
          <button
            onClick={() => handleTabChange("directions")}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider font-bold transition-all cursor-pointer ${
              activeTab === "directions"
                ? "bg-[#e0ff4f] text-[#12100E] shadow-md"
                : "text-stone-400 hover:text-[#FAF6EE]"
            }`}
          >
            Get Directions
          </button>
        </nav>

      </header>

      {/* Main View Area */}
      <main className={`flex-grow min-h-0 w-full relative overscroll-contain [-webkit-overflow-scrolling:touch] z-10 flex flex-col ${
        activeTab === "archive" ? "overflow-hidden" : "overflow-y-auto"
      }`}>
        {isLoading ? (
          <div className="flex-grow flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-[#e0ff4f] animate-spin" />
            <p className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">
              Syncing archives...
            </p>
          </div>
        ) : errorText ? (
          <div className="flex-grow flex items-center justify-center p-6">
            <div className="p-4 bg-red-950/20 border border-red-900/50 text-red-300 text-xs font-mono rounded-2xl max-w-sm text-center">
              {errorText}
            </div>
          </div>
        ) : (
          <div className="w-full flex-grow min-h-0 flex flex-col items-center">
            
            {/* 1. CATALOG TAB */}
            {activeTab === "archive" && (
              <div className="w-full flex-1 min-h-0 flex flex-col items-center relative overflow-hidden">
                {/* Beautiful About Us / Story Block (Page 1 just below shop title) */}
                {/* Kept off the main carousel plane so the catalog can use the full viewport. */}
                <div className="pointer-events-none absolute bottom-5 left-5 z-30 hidden 2xl:block w-[min(28rem,calc(100%-3rem))]">
                  <div className="border-l border-[#e0ff4f]/35 bg-stone-950/45 py-3 pl-4 pr-3 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 w-24 h-24 bg-[#e0ff4f]/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase text-[#e0ff4f] tracking-widest font-black block">
                        🏬 Physical Depot • Dagoretti Kabiria, Nairobi
                      </span>
                      <h3 className="font-sans font-black text-sm uppercase tracking-tight text-[#FAF6EE]">
                        Preserving the street textures of East African street fashion.
                      </h3>
                      <p className="font-serif text-[11px] text-stone-400 leading-relaxed">
                        Thrift With D is more than an apparel outlet — it is an active digital archive. Curated by Dayo, we limit our inventory to exclusive, spring-soft washed drops. Visit our sorting vaults at Dagoretti Kabiria to collect.
                      </p>
                    </div>
                    <button 
                      onClick={() => handleTabChange("directions")}
                      className="pointer-events-auto mt-3 shrink-0 font-mono text-[9px] uppercase tracking-wider font-bold bg-[#e0ff4f]/10 text-[#e0ff4f] hover:bg-[#e0ff4f] hover:text-[#12100E] border border-[#e0ff4f]/35 px-3 py-2 rounded-lg transition-all cursor-pointer w-fit"
                    >
                      Get Directions &rarr;
                    </button>
                  </div>
                </div>

                {/* Horizontal Category filter bar */}
                <div className="w-full max-w-4xl px-4 py-2 mt-2 z-30 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-2 justify-start sm:justify-center">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider font-bold transition-all border shrink-0 cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-[#e0ff4f] text-[#12100E] border-[#e0ff4f] shadow-md shadow-[#e0ff4f]/10"
                          : "bg-[#12100E] border-stone-850 text-stone-400 hover:text-stone-200"
                      }`}
                    >
                      {cat.replace("_", " ")}
                    </button>
                  ))}
                </div>

                {storefrontProducts.length === 0 ? (
                  <div className="flex-grow flex items-center justify-center p-6 mt-10">
                    <div className="text-center bg-stone-900/30 border border-stone-850 rounded-3xl p-10 max-w-xs space-y-3">
                      <Shirt className="w-8 h-8 text-stone-700 mx-auto" />
                      <h4 className="font-sans font-black text-sm uppercase tracking-wider">No Catalog Items</h4>
                      <p className="font-serif text-[11px] text-stone-500">The collection catalog currently has zero products published.</p>
                    </div>
                  </div>
                ) : (
                  <Product3DCarousel
                    products={storefrontProducts}
                    onSelect={handleProductSelect}
                  />
                )}
              </div>
            )}

            {/* 2. GET DIRECTIONS TAB */}
            {activeTab === "directions" && (
              <StoreDirections />
            )}

            {/* Ads display if inactive (Custom Banner + Google AdSense Square Slot) */}
            {shopInfo && !shopInfo.subscription?.active && shopInfo.adsConfig?.enabled && (
              <div className="mx-auto max-w-4xl px-4 pb-3 w-full flex flex-col md:flex-row gap-3 items-center justify-between z-30">
                {/* 1. Custom Banner Ad */}
                <div className="rounded-xl border border-stone-850 bg-stone-950 overflow-hidden shadow-lg relative aspect-[16/4] md:aspect-[6/1] flex-grow w-full">
                  <a href={shopInfo.adsConfig.targetUrl || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                    <img 
                      src={shopInfo.adsConfig.bannerUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff"} 
                      alt="Sponsored Ad" 
                      className="w-full h-full object-cover" 
                    />
                    <span className="absolute top-1 right-1 bg-black/60 text-[7px] font-mono text-[#FAF6EE] uppercase tracking-widest px-1 py-0.5 rounded">Partner Ad</span>
                  </a>
                </div>
                
                {/* 2. Google AdSense Square Slot */}
                <div className="w-full md:w-[150px] h-[65px] md:h-[80px] shrink-0 bg-stone-950 border border-stone-850 rounded-xl overflow-hidden relative flex flex-col items-center justify-center p-1">
                  <ins className="adsbygoogle"
                       style={{ display: "inline-block", width: "100%", height: "100%" }}
                       data-ad-client="ca-pub-5507842353286175"
                       data-ad-slot="9876543210"
                       data-ad-format="rectangle"
                       data-full-width-responsive="true"></ins>
                  <span className="absolute top-1 right-1 bg-black/60 text-[6px] font-mono text-[#FAF6EE] uppercase tracking-widest px-1 py-0.5 rounded">AdSense</span>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="sm:hidden z-50 bg-stone-950 border-t border-stone-900 px-2 py-2 flex items-center justify-around relative will-change-transform" style={{ transform: "translate3d(0, 0, 0)" }}>
        <button
          onClick={() => handleTabChange("archive")}
          className={`flex flex-col items-center gap-1 py-1 px-5 rounded-xl font-mono text-[9px] uppercase tracking-wider font-bold transition-all ${
            activeTab === "archive" ? "text-[#e0ff4f]" : "text-stone-500"
          }`}
        >
          <Shirt className="w-4.5 h-4.5" />
          <span>Catalog</span>
        </button>

        <button
          onClick={() => handleTabChange("directions")}
          className={`flex flex-col items-center gap-1 py-1 px-5 rounded-xl font-mono text-[9px] uppercase tracking-wider font-bold transition-all ${
            activeTab === "directions" ? "text-[#e0ff4f]" : "text-stone-500"
          }`}
        >
          <Compass className="w-4.5 h-4.5" />
          <span>Get Directions</span>
        </button>
      </nav>

{/* Inquiry Modal */}
        <ProductInquiryModal
          product={selectedProduct}
          onClose={handleCloseProduct}
          onPlaceOrder={handlePlaceOrder}
          onGetDirections={handleProductDirections}
          shopInfo={shopInfo}
        />

      {/* Interstitial Ad Modal */}
      {shopInfo && !shopInfo.subscription?.active && shopInfo.adsConfig?.enabled && showInterstitial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md border border-stone-800 bg-stone-950 p-5 rounded-2xl shadow-2xl relative flex flex-col items-center text-center">
            <span className="absolute top-2 left-2 bg-[#e0ff4f]/10 border border-[#e0ff4f]/35 text-[#e0ff4f] text-[7px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded">Sponsored Promo</span>
            
            {/* Close button */}
            <button 
              onClick={() => setShowInterstitial(false)}
              className="absolute top-3 right-3 text-stone-500 hover:text-stone-300 font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer border border-stone-800 bg-stone-900 px-2 py-1 rounded-lg"
            >
              Skip Ad
            </button>
            
            <a href={shopInfo.adsConfig.targetUrl || "#"} target="_blank" rel="noopener noreferrer" className="block w-full mt-6 rounded-xl overflow-hidden aspect-[4/5] border border-stone-850">
              <img 
                src={shopInfo.adsConfig.interstitialUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30"} 
                alt="Sponsored Promo Ad" 
                className="w-full h-full object-cover" 
              />
            </a>
            
            <p className="mt-3 text-[10px] font-mono text-stone-500 uppercase tracking-widest">Click ad to view details</p>
          </div>
        </div>
      )}

      
    </div>
  );
}


