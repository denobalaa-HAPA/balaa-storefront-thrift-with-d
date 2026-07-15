import React, { useState, useEffect, useRef } from "react";
import { Draft, Order, Chat } from "../types";
import { 
  FolderSync, 
  Trash2, 
  CheckCircle, 
  ArrowLeft,
  X,
  Plus,
  RefreshCw,
  Sliders,
  Bell,
  Eye,
  ShieldAlert,
  Download,
  Terminal as TerminalIcon,
  MessageCircle,
  ShoppingBag,
  Send,
  User as UserIcon,
  Lock,
  LogOut,
  Globe,
  Trash,
  Loader2,
  Sparkles,
  CreditCard
} from "lucide-react";

interface SellerConfig {
  id: string;
  name: string;
  url: string;
}

interface AyoAdminCompanionProps {
  onClose: () => void;
}

const DEFAULT_SELLERS: SellerConfig[] = [
  { id: "s1", name: "Ayo (Dagoretti)", url: window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1") ? "http://localhost:3000" : window.location.origin }
];

export default function AyoAdminCompanion({ onClose }: AyoAdminCompanionProps) {
  // Sellers directory state
  const [sellers, setSellers] = useState<SellerConfig[]>(() => {
    const saved = localStorage.getItem("thrift-with-d-master-sellers");
    return saved ? JSON.parse(saved) : DEFAULT_SELLERS;
  });
  const [selectedSellerId, setSelectedSellerId] = useState<string>(() => {
    return sellers[0]?.id || "";
  });

  // Active seller details
  const activeSeller = sellers.find(s => s.id === selectedSellerId);
  const activeSellerUrl = activeSeller ? activeSeller.url : "";

  // Tokens mapped by Hosting URL
  const [tokens, setTokens] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("thrift-with-d-master-tokens");
    return saved ? JSON.parse(saved) : {};
  });

  const activeToken = activeSellerUrl ? tokens[activeSellerUrl] || null : null;
  const [adminUser, setAdminUser] = useState<{ username: string; role: string; fullName: string } | null>(null);

  // Login state for the active seller site
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // New Seller form state
  const [newSellerName, setNewSellerName] = useState("");
  const [newSellerUrl, setNewSellerUrl] = useState("");
  const [showAddSeller, setShowAddSeller] = useState(false);

  // Dashboard content states (specific to selected seller)
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [apiConfigured, setApiConfigured] = useState(false);

  // Tabs inside Ayo's Admin
  const [activeTab, setActiveTab] = useState<"drafts" | "orders" | "chats" | "installer" | "revenue">("drafts");

  // Revenue & Ads states
  const [shopInfo, setShopInfo] = useState<{
    subscription: { active: boolean; expiryDate: string; tillNumber: string; priceKsh: number };
    adsConfig: { enabled: boolean; bannerUrl: string; targetUrl: string; interstitialUrl: string };
    metrics: { totalUploaded: number; totalSold: number; totalDeleted: number };
  } | null>(null);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [adsBannerUrl, setAdsBannerUrl] = useState("");
  const [adsTargetUrl, setAdsTargetUrl] = useState("");
  const [adsInterstitialUrl, setAdsInterstitialUrl] = useState("");
  const [isUpdatingAds, setIsUpdatingAds] = useState(false);
  const [isTogglingSub, setIsTogglingSub] = useState(false);

  // Draft review form states
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number | string>("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("tops");
  const [tags, setTags] = useState("");
  const [size, setSize] = useState("M");

  // Status and logs
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState("Ready");
  
  // Terminal Deployment logs state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);

  // WhatsApp simulation states
  const [replyMessage, setReplyMessage] = useState("");
  const [activeChatSender, setActiveChatSender] = useState<string | null>(null);

  const resolveCatalogAssetUrl = (url: string) => {
    if (!url || /^(https?:|data:|blob:)/.test(url)) return url;
    if (!url.startsWith("/")) return url;

    const baseUrl = import.meta.env.BASE_URL || "/";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}${url.replace(/^\/+/, "")}`;
  };
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);

  // Autoscroll for terminal
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Save sellers list to localStorage
  useEffect(() => {
    localStorage.setItem("thrift-with-d-master-sellers", JSON.stringify(sellers));
  }, [sellers]);

  // Save tokens to localStorage
  useEffect(() => {
    localStorage.setItem("thrift-with-d-master-tokens", JSON.stringify(tokens));
  }, [tokens]);

  // Verify credentials when switching seller or on load
  useEffect(() => {
    if (activeToken && activeSellerUrl) {
      void verifyTokenAndLoad();
    } else {
      setAdminUser(null);
      setDrafts([]);
      setOrders([]);
      setChats([]);
    }
  }, [activeToken, selectedSellerId]);

  useEffect(() => {
    if (showTerminal && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs, showTerminal]);

  const verifyTokenAndLoad = async () => {
    try {
      setIsLoading(true);
      setStatusText(`Verifying connection to ${activeSeller?.name}...`);
      const response = await fetch(`${activeSellerUrl}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!response.ok) throw new Error("Session expired on remote host");
      const user = await response.json();
      if (user.role !== "master_admin") {
        throw new Error("Access Denied: Master Admin permissions required.");
      }
      setAdminUser(user);
      setStatusText(`Connected to ${activeSeller?.name} as Master Admin`);
      void refreshDashboard();
    } catch (err: any) {
      setLoginError(err.message || "Failed verification on remote host");
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSellerUrl) return;
    if (!usernameInput || !passwordInput) {
      setLoginError("Please enter both username and password");
      return;
    }
    try {
      setIsLoggingIn(true);
      setLoginError("");
      const res = await fetch(`${activeSellerUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Incorrect credentials");
      }
      const data = await res.json();
      if (data.user.role !== "master_admin") {
        throw new Error("Access Denied: This portal is reserved for Master Administrators.");
      }
      // Save token in the dictionary
      setTokens(prev => ({
        ...prev,
        [activeSellerUrl]: data.token
      }));
      setAdminUser(data.user);
    } catch (err: any) {
      setLoginError(err.message || "Unable to connect to seller host");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (!activeSellerUrl) return;
    setTokens(prev => {
      const copy = { ...prev };
      delete copy[activeSellerUrl];
      return copy;
    });
    setAdminUser(null);
    setDrafts([]);
    setOrders([]);
    setChats([]);
    setUsernameInput("");
    setPasswordInput("");
  };

  const fetchRevenueAndAds = async () => {
    if (!activeToken || !activeSellerUrl) return;
    try {
      const [infoRes, reqsRes] = await Promise.all([
        fetch(`${activeSellerUrl}/api/shop-info`),
        fetch(`${activeSellerUrl}/api/subscription/requests`, {
          headers: { Authorization: `Bearer ${activeToken}` }
        })
      ]);

      if (infoRes.ok && reqsRes.ok) {
        const info = await infoRes.json();
        const reqs = await reqsRes.json();
        setShopInfo(info);
        setSubscriptionRequests(reqs);
        
        // Initialize ads form fields
        setAdsEnabled(info.adsConfig?.enabled !== false);
        setAdsBannerUrl(info.adsConfig?.bannerUrl || "");
        setAdsTargetUrl(info.adsConfig?.targetUrl || "");
        setAdsInterstitialUrl(info.adsConfig?.interstitialUrl || "");
      }
    } catch (err) {
      console.warn("Could not fetch revenue/ads data", err);
    }
  };

  const handleApproveRequest = async (requestId: string, status: "approved" | "rejected") => {
    if (!activeToken || !activeSellerUrl) return;
    try {
      setStatusText(`${status === "approved" ? "Approving" : "Rejecting"} request...`);
      const res = await fetch(`${activeSellerUrl}/api/subscription/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ requestId, status })
      });
      if (!res.ok) throw new Error("Could not process request");
      setStatusText(`Subscription request ${status} successfully!`);
      void refreshDashboard();
    } catch (err: any) {
      setStatusText(err.message || "Failed to process request");
    }
  };

  const handleToggleSubscription = async (active: boolean) => {
    if (!activeToken || !activeSellerUrl) return;
    try {
      setIsTogglingSub(true);
      setStatusText("Toggling subscription...");
      const res = await fetch(`${activeSellerUrl}/api/subscription/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error("Could not toggle subscription");
      setStatusText(`Subscription set to ${active ? "Active" : "Inactive"}`);
      void refreshDashboard();
    } catch (err: any) {
      setStatusText(err.message || "Failed to toggle subscription");
    } finally {
      setIsTogglingSub(false);
    }
  };

  const handleUpdateAds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken || !activeSellerUrl) return;
    try {
      setIsUpdatingAds(true);
      setStatusText("Updating ad configuration...");
      const res = await fetch(`${activeSellerUrl}/api/ads/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          enabled: adsEnabled,
          bannerUrl: adsBannerUrl.trim(),
          targetUrl: adsTargetUrl.trim(),
          interstitialUrl: adsInterstitialUrl.trim()
        })
      });
      if (!res.ok) throw new Error("Could not update ads configuration");
      setStatusText("Ad configuration updated successfully!");
      void refreshDashboard();
    } catch (err: any) {
      setStatusText(err.message || "Failed to update ads config");
    } finally {
      setIsUpdatingAds(false);
    }
  };

  const refreshDashboard = async () => {
    if (!activeToken || !activeSellerUrl) return;
    try {
      setIsLoading(true);
      setStatusText("Refreshing Master Console...");
      
      const [draftsRes, ordersRes, chatsRes, aiStatusRes] = await Promise.all([
        fetch(`${activeSellerUrl}/api/drafts`, { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetch(`${activeSellerUrl}/api/orders`, { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetch(`${activeSellerUrl}/api/chats`, { headers: { Authorization: `Bearer ${activeToken}` } }),
        fetch(`${activeSellerUrl}/api/ai-status`)
      ]);

      if (draftsRes.ok) setDrafts(await draftsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.ok ? await ordersRes.json() : []);
      if (chatsRes.ok) setChats(await chatsRes.ok ? await chatsRes.json() : []);
      if (aiStatusRes.ok) {
        const status = await aiStatusRes.json();
        setApiConfigured(status.configured);
      }
      
      void fetchRevenueAndAds();
      setStatusText(`Synchronized with ${activeSeller?.name}`);
    } catch (err) {
      setStatusText("Remote synchronization failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName || !newSellerUrl) return;

    let cleanUrl = newSellerUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }
    cleanUrl = cleanUrl.replace(/\/+$/, "");

    const newSeller: SellerConfig = {
      id: "s_" + Date.now(),
      name: newSellerName.trim(),
      url: cleanUrl
    };

    setSellers(prev => [...prev, newSeller]);
    setSelectedSellerId(newSeller.id);
    setNewSellerName("");
    setNewSellerUrl("");
    setShowAddSeller(false);
  };

  const handleDeleteSeller = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sellers.length <= 1) {
      alert("You must keep at least one seller site registered.");
      return;
    }
    if (!window.confirm("Remove this seller from your master directory?")) return;
    
    const seller = sellers.find(s => s.id === id);
    if (seller) {
      setTokens(prev => {
        const copy = { ...prev };
        delete copy[seller.url];
        return copy;
      });
    }

    const filtered = sellers.filter(s => s.id !== id);
    setSellers(filtered);
    if (selectedSellerId === id) {
      setSelectedSellerId(filtered[0].id);
    }
  };

  const handleSimulateMediaArrival = async (imageUrl: string, sender: string) => {
    try {
      setIsSimulatingUpload(true);
      setStatusText("Simulating WhatsApp image drop...");
      const res = await fetch(`${activeSellerUrl}/api/drafts/whatsapp-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({ imageUrl, sender }),
      });
      if (!res.ok) throw new Error("Drop simulation failed");
      setStatusText("New WhatsApp draft parsed successfully!");
      void refreshDashboard();
    } catch (err: any) {
      setStatusText(err.message || "Failed to drop image");
    } finally {
      setIsSimulatingUpload(false);
    }
  };

  const handleSelectDraft = (draft: Draft) => {
    setSelectedDraft(draft);
    setTitle(draft.title);
    setPrice(draft.price);
    setDescription(draft.description);
    setCategory(draft.category);
    setSize(draft.size);
    setTags(draft.tags.join(", "));
  };

  const handlePublishDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDraft || !activeToken) return;

    try {
      setIsSaving(true);
      setStatusText(`Publishing product drops...`);
      
      const payload = {
        title: title.trim(),
        price: Number(price) || 0,
        description: description.trim(),
        category,
        size,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean)
      };

      const res = await fetch(`${activeSellerUrl}/api/drafts/publish/${selectedDraft.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Could not publish draft");
      setStatusText("Draft successfully published to storefront catalog!");
      setSelectedDraft(null);
      void refreshDashboard();
    } catch (err: any) {
      setStatusText(err.message || "Failed publishing draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardDraft = async (id: string) => {
    if (!window.confirm("Are you sure you want to discard this raw draft?")) return;
    try {
      setIsSaving(true);
      setStatusText("Discarding draft...");
      const res = await fetch(`${activeSellerUrl}/api/drafts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!res.ok) throw new Error("Failed to delete draft");
      setStatusText("Draft deleted");
      setSelectedDraft(null);
      void refreshDashboard();
    } catch (err: any) {
      setStatusText(err.message || "Could not discard draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendChatReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage || !activeChatSender || !activeToken) return;

    try {
      setIsSaving(true);
      const res = await fetch(`${activeSellerUrl}/api/chats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          sender: activeChatSender,
          message: replyMessage,
        })
      });
      if (res.ok) {
        setReplyMessage("");
        void refreshDashboard();
      }
    } catch {
      setStatusText("Could not send chat reply");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerVercelBuild = async () => {
    alert("BALAA storefront is hosted on Google Cloud Run. Deployment is managed via Google Cloud Build / GitHub Actions CI/CD automatically.");
  };

  const activeChatMessages = chats.filter((c) => c.sender === activeChatSender);

  // Unauthenticated view for the selected seller site
  const renderLoginView = () => (
    <div className="min-h-[70dvh] flex items-center justify-center px-4 font-sans antialiased">
      <div className="w-full max-w-md border border-stone-850 bg-stone-950 p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-24 h-24 bg-[#e0ff4f]/5 rounded-full blur-2xl pointer-events-none" />
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#e0ff4f] text-[#12100E] font-black text-xl mb-3">D</div>
          <h2 className="text-sm font-black uppercase tracking-widest text-[#FAF6EE]">Authenticate Session</h2>
          <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400 mt-1 flex items-center justify-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" /> Target: {activeSeller?.name}
          </p>
          <span className="text-[9px] font-mono text-stone-500 truncate block mt-0.5 max-w-full">{activeSellerUrl}</span>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          {loginError && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-300 text-xs font-mono rounded-lg text-center">
              {loginError}
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f] flex items-center gap-1"><UserIcon className="h-3 w-3" />Admin Username</span>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.trim())}
              className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"
              placeholder="admin"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f] flex items-center gap-1"><Lock className="h-3 w-3" />Admin Password</span>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#12100E] disabled:opacity-65 cursor-pointer mt-2"
          >
            {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Access Master Console"}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-[#FAF6EE] font-sans antialiased flex flex-col justify-between">
      
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-stone-850 bg-stone-950/95 px-4 py-3 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-[#e0ff4f] rounded-xl flex items-center justify-center text-[#12100E] font-black text-lg shadow-md shadow-[#e0ff4f]/15">D</div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-1.5">
              Ayo's Master Console <span className="rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 text-[8px] font-mono uppercase text-amber-400">Master</span>
            </h1>
            <p className="text-[9px] font-mono uppercase tracking-wider text-stone-500">Centralized Multi-Tenant Storefront Console</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {adminUser && (
            <button
              onClick={handleTriggerVercelBuild}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-[#e0ff4f]/40 bg-[#e0ff4f]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#e0ff4f] hover:bg-[#e0ff4f] hover:text-[#12100E] disabled:opacity-60 cursor-pointer"
            >
              <FolderSync className="h-3.5 w-3.5" /> Check Deployment
            </button>
          )}
          {adminUser && (
            <button
              onClick={handleLogout}
              className="grid h-9 w-9 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200 cursor-pointer"
              title="Disconnect Site"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200 cursor-pointer"
            title="Close Console"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-grow max-w-6xl w-full mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start pb-24">
        
        {/* Left Sidebar: Sellers Directory switcher */}
        <aside className="border border-stone-850 bg-stone-950 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-900 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#e0ff4f] flex items-center gap-1.5"><Globe className="h-4 w-4" />Store Directory</h3>
            <button onClick={() => setShowAddSeller(!showAddSeller)} className="text-[#e0ff4f] hover:text-[#FAF6EE]"><Plus className="h-4 w-4" /></button>
          </div>

          {/* Add Seller Form overlay */}
          {showAddSeller && (
            <form onSubmit={handleAddSeller} className="p-3 bg-stone-900/60 rounded-xl border border-stone-800 space-y-3">
              <label className="block space-y-1">
                <span className="text-[8px] font-mono uppercase text-[#e0ff4f]">Seller Name</span>
                <input required value={newSellerName} onChange={e => setNewSellerName(e.target.value)} className="w-full rounded border border-stone-800 bg-stone-950 px-2 py-1.5 text-xs outline-none focus:border-[#e0ff4f]" placeholder="e.g. Ayo Nairobi" />
              </label>
              <label className="block space-y-1">
                <span className="text-[8px] font-mono uppercase text-[#e0ff4f]">Hosting URL</span>
                <input required value={newSellerUrl} onChange={e => setNewSellerUrl(e.target.value)} className="w-full rounded border border-stone-800 bg-stone-950 px-2 py-1.5 text-xs outline-none focus:border-[#e0ff4f]" placeholder="e.g. shop.web.app" />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#e0ff4f] text-[#12100E] text-[10px] font-black uppercase py-1.5 rounded cursor-pointer">Register</button>
                <button type="button" onClick={() => setShowAddSeller(false)} className="px-2 border border-stone-800 text-stone-400 text-[10px] rounded">Cancel</button>
              </div>
            </form>
          )}

          {/* Switcher list */}
          <div className="space-y-1.5">
            {sellers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSellerId(s.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                  selectedSellerId === s.id
                    ? "bg-[#e0ff4f]/10 border-[#e0ff4f]/35 text-stone-100"
                    : "border-stone-850 hover:bg-stone-900/60 text-stone-400"
                }`}
              >
                <div className="min-w-0">
                  <span className="block font-bold text-xs truncate">{s.name}</span>
                  <span className="block text-[8px] font-mono text-stone-500 truncate mt-0.5">{s.url.replace(/^https?:\/\//i, "")}</span>
                </div>
                <Trash
                  onClick={(e) => handleDeleteSeller(s.id, e)}
                  className="h-3.5 w-3.5 text-stone-600 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                />
              </button>
            ))}
          </div>
        </aside>

        {/* Right Panel: Active Workspace Dashboard */}
        <section className="space-y-4">
          
          {!adminUser ? (
            renderLoginView()
          ) : (
            <>
              {/* Status bar */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-850 bg-stone-950 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {isLoading || isSaving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#e0ff4f]" /> : <CheckCircle className="h-4 w-4 shrink-0 text-[#e0ff4f]" />}
                  <span className="truncate text-[10px] font-mono uppercase tracking-wider text-stone-300">{statusText}</span>
                </div>
                <button type="button" onClick={() => void refreshDashboard()} disabled={isLoading || isSaving} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 disabled:opacity-50" title="Refresh Dashboard"><RefreshCw className="h-4 w-4" /></button>
              </div>

              {/* Terminal log panel */}
              {showTerminal && (
                <section className="rounded-lg border border-stone-800 bg-black p-4 font-mono text-xs text-[#e0ff4f] shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-stone-900 pb-2 mb-3">
                    <span className="text-[10px] uppercase tracking-widest font-black text-stone-500 flex items-center gap-1.5"><TerminalIcon className="h-3.5 w-3.5" />Build Pipeline Console Log</span>
                    <button onClick={() => setShowTerminal(false)} className="text-stone-500 hover:text-[#FAF6EE]"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {terminalLogs.length === 0 ? (
                      <div className="text-stone-600 animate-pulse">Initializing pipeline connection...</div>
                    ) : (
                      terminalLogs.map((log, index) => <div key={`log-${index}`} className="leading-relaxed">{log}</div>)
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </section>
              )}

              {/* Draft Review list */}
              {activeTab === "drafts" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-stone-850 bg-stone-950 p-3">
                    <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#e0ff4f]" />Review Sync Queue ({drafts.length})</h2>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-stone-500">Review new photo drops synchronized for {activeSeller?.name}</p>
                  </div>

                  {drafts.length === 0 ? (
                    <div className="text-center rounded-xl border border-stone-850 bg-stone-900/30 p-10 space-y-2">
                      <FolderSync className="w-8 h-8 text-stone-600 mx-auto" />
                      <h4 className="text-sm font-bold uppercase tracking-wider">Queue Empty</h4>
                      <p className="text-xs text-stone-500">No pending drafts to review. New seller media uploads will appear here.</p>
                    </div>
                  ) : selectedDraft ? (
                    /* Edit & Publish draft form */
                    <form onSubmit={handlePublishDraft} className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-4">
                      <div className="flex items-center justify-between border-b border-stone-900 pb-2">
                        <button type="button" onClick={() => setSelectedDraft(null)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-stone-200"><ArrowLeft className="h-4 w-4" />Back to List</button>
                        <button type="button" onClick={() => handleDiscardDraft(selectedDraft.id)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" />Discard Draft</button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
                        <img src={resolveCatalogAssetUrl(selectedDraft.imageUrl)} alt="review" className="w-full aspect-[3/4] rounded-lg object-cover border border-stone-850" />
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f]" /></label>
                            <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Price (USD/KSh base)</span><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f]" /></label>
                            <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Category</span><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f]"><option value="tops">Tops</option><option value="outerwear">Outerwear</option><option value="bottoms">Bottoms</option><option value="accessories">Accessories</option></select></label>
                            <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Size</span><input value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f]" /></label>
                          </div>
                          <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Creative Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full min-h-20 rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f]" /></label>
                          <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Tags</span><input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f]" /></label>
                          <button type="submit" disabled={isSaving} className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#12100E] disabled:opacity-60 cursor-pointer">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Publish Drop"}</button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    /* Draft grid */
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {drafts.map((draft) => (
                        <article key={draft.id} onClick={() => handleSelectDraft(draft)} className="group border border-stone-850 bg-stone-950 rounded-xl overflow-hidden cursor-pointer hover:border-[#e0ff4f] transition-all">
                          <div className="aspect-[3/4] relative overflow-hidden">
                            <img src={resolveCatalogAssetUrl(draft.imageUrl)} alt={draft.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                            <span className="absolute bottom-2 left-2 bg-black/85 text-[8px] font-mono uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded border border-amber-500/25">Pending Review</span>
                          </div>
                          <div className="p-3 space-y-1">
                            <h4 className="font-bold text-xs truncate">{draft.title}</h4>
                            <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 uppercase">
                              <span>{draft.size} / KSh {(draft.price * 100).toLocaleString()}</span>
                              <span className="text-[#e0ff4f] flex items-center gap-0.5"><Eye className="h-3 w-3" />Edit</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Orders log */}
              {activeTab === "orders" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-stone-850 bg-stone-950 p-3">
                    <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-[#e0ff4f]" />Order Receipts ({orders.length})</h2>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-stone-500">Captured checkout orders for {activeSeller?.name}</p>
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center rounded-xl border border-stone-850 bg-stone-900/30 p-10">
                      <ShoppingBag className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                      <p className="text-xs text-stone-500">No orders placed yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.map((order) => (
                        <div key={order.id} className="grid grid-cols-[70px_1fr] gap-3 rounded-lg border border-stone-850 bg-stone-950 p-2.5">
                          <img src={resolveCatalogAssetUrl(order.imageUrl)} alt={order.productTitle} className="h-20 w-full rounded object-cover border border-stone-850" />
                          <div className="min-w-0 flex flex-col justify-between">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold truncate">{order.productTitle}</h4>
                                <p className="text-[10px] font-mono text-stone-400 mt-0.5">Customer: {order.customerName} ({order.customerPhone})</p>
                              </div>
                              <span className="shrink-0 bg-[#e0ff4f]/10 border border-[#e0ff4f]/35 text-[#e0ff4f] text-[8px] font-mono uppercase px-1.5 py-0.5 rounded">{order.status}</span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-stone-500">
                              <span>Size: {order.size} / KSh {(order.price * 100).toLocaleString()}</span>
                              <span>{new Date(order.dateOrdered).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Chat interface */}
              {activeTab === "chats" && (
                <div className="grid grid-cols-[1fr_2fr] gap-4 min-h-[460px] max-h-[480px]">
                  
                  {/* Chat threads list */}
                  <div className="border border-stone-850 bg-stone-950 rounded-xl overflow-y-auto p-2 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-stone-500 px-2 py-1 mb-1 border-b border-stone-900">Threads</div>
                    {chats.reduce<string[]>((acc, cur) => (acc.includes(cur.sender) ? acc : [...acc, cur.sender]), []).map((sender) => {
                      const lastMessage = chats.filter((c) => c.sender === sender).slice(-1)[0];
                      return (
                        <button
                          key={sender}
                          onClick={() => setActiveChatSender(sender)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all truncate flex flex-col gap-0.5 ${
                            activeChatSender === sender
                              ? "bg-[#e0ff4f]/10 border-[#e0ff4f]/35 text-stone-100"
                              : "border-stone-850 hover:bg-stone-900 text-stone-400"
                          }`}
                        >
                          <span className="font-bold text-xs truncate flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{lastMessage.name || sender}</span>
                          <span className="text-[9px] font-mono truncate">{lastMessage.message}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Chat detail screen */}
                  <div className="border border-stone-850 bg-stone-950 rounded-xl flex flex-col justify-between overflow-hidden">
                    {activeChatSender ? (
                      <>
                        {/* Header */}
                        <div className="border-b border-stone-900 bg-stone-950 px-3 py-2.5 flex items-center justify-between">
                          <div>
                            <h3 className="text-xs font-black">{activeChatMessages[0]?.name || activeChatSender}</h3>
                            <p className="text-[8px] font-mono text-stone-500 uppercase mt-0.5">Line: {activeChatSender}</p>
                          </div>
                        </div>

                        {/* Messages pane */}
                        <div className="flex-grow overflow-y-auto p-3 space-y-2 max-h-[300px]">
                          {activeChatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex flex-col max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                                msg.isFromCustomer
                                  ? "bg-stone-900 text-[#FAF6EE] rounded-tl-none self-start mr-auto"
                                  : "bg-[#e0ff4f] text-[#12100E] rounded-tr-none self-end ml-auto"
                              }`}
                            >
                              <div>{msg.message}</div>
                              <span className={`block text-[8px] font-mono mt-1 ${msg.isFromCustomer ? "text-stone-500 text-left" : "text-stone-800 text-right"}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Footer Input */}
                        <form onSubmit={handleSendChatReply} className="border-t border-stone-900 p-2 flex items-center gap-2">
                          <input
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            className="flex-grow rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-xs outline-none focus:border-[#e0ff4f]"
                            placeholder="Reply to customer..."
                          />
                          <button type="submit" disabled={isSaving} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e0ff4f] text-[#12100E]"><Send className="h-3.5 w-3.5" /></button>
                        </form>
                      </>
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-6 space-y-2 text-stone-500">
                        <MessageCircle className="h-7 w-7" />
                        <p className="text-xs font-mono uppercase tracking-wider">Select a conversation thread</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Revenue & Ads tab */}
              {activeTab === "revenue" && (
                <section className="space-y-4">
                  
                  {/* Store Metrics Dashboard */}
                  <div className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-3 shadow-xl">
                    <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-[#e0ff4f]" /> Store Performance & Metrics
                    </h2>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                      Distribution metrics & product lifecycles for {activeSeller?.name}
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="rounded-xl border border-stone-850 bg-stone-900/60 p-3 text-center">
                        <span className="block text-[8px] font-mono uppercase text-stone-500">Uploaded</span>
                        <strong className="block text-lg font-black text-[#e0ff4f] mt-1">
                          {shopInfo?.metrics?.totalUploaded ?? 0}
                        </strong>
                      </div>
                      <div className="rounded-xl border border-stone-850 bg-stone-900/60 p-3 text-center">
                        <span className="block text-[8px] font-mono uppercase text-stone-500">Marked Sold</span>
                        <strong className="block text-lg font-black text-amber-400 mt-1">
                          {shopInfo?.metrics?.totalSold ?? 0}
                        </strong>
                      </div>
                      <div className="rounded-xl border border-stone-850 bg-stone-900/60 p-3 text-center">
                        <span className="block text-[8px] font-mono uppercase text-stone-500">Deleted</span>
                        <strong className="block text-lg font-black text-red-400 mt-1">
                          {shopInfo?.metrics?.totalDeleted ?? 0}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Subscription management */}
                  <div className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-4 shadow-xl">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#e0ff4f]">Subscription Status</h3>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-stone-900 border border-stone-800">
                      <div>
                        <span className="block text-xs font-bold text-stone-300">
                          {shopInfo?.subscription?.active ? "Active Ad-Free" : "Inactive (Showing Ads)"}
                        </span>
                        {shopInfo?.subscription?.expiryDate && (
                          <span className="block text-[9px] font-mono text-stone-500 uppercase mt-0.5">
                            Expiry: {new Date(shopInfo.subscription.expiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleSubscription(!shopInfo?.subscription?.active)}
                        disabled={isTogglingSub}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border cursor-pointer ${
                          shopInfo?.subscription?.active
                            ? "border-red-900/50 bg-red-950/20 text-red-400"
                            : "border-[#e0ff4f]/35 bg-[#e0ff4f]/10 text-[#e0ff4f]"
                        }`}
                      >
                        {shopInfo?.subscription?.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>

                    {/* Request Approval Queue */}
                    <div className="space-y-3 pt-3 border-t border-stone-900">
                      <h4 className="text-[10px] font-mono uppercase text-stone-400">M-Pesa Verification Queue</h4>
                      {subscriptionRequests.filter(r => r.status === "pending").length === 0 ? (
                        <p className="text-[10px] font-serif italic text-stone-500">No pending verification requests.</p>
                      ) : (
                        <div className="space-y-2">
                          {subscriptionRequests.filter(r => r.status === "pending").map((req) => (
                            <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-stone-900 border border-stone-800 text-xs font-mono">
                              <div>
                                <span className="block text-stone-300 font-bold">Code: {req.transactionCode}</span>
                                <span className="block text-[8px] text-stone-500">{new Date(req.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveRequest(req.id, "approved")}
                                  className="px-2 py-1 bg-[#e0ff4f] text-[#12100E] text-[9px] font-black uppercase rounded cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleApproveRequest(req.id, "rejected")}
                                  className="px-2 py-1 border border-stone-800 text-red-400 text-[9px] font-bold uppercase rounded cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ads Configuration Form */}
                  <form onSubmit={handleUpdateAds} className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-4 shadow-xl">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#e0ff4f]">Ads Config (3rd Party Promos)</h3>
                    
                    <label className="flex items-center gap-2 cursor-pointer p-1">
                      <input
                        type="checkbox"
                        checked={adsEnabled}
                        onChange={e => setAdsEnabled(e.target.checked)}
                        className="rounded border-stone-800 bg-stone-900 text-[#e0ff4f]"
                      />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-stone-300">Enable Ads on Storefront</span>
                    </label>

                    <div className="space-y-3 pt-2">
                      <label className="block space-y-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">Banner Ad Image URL</span>
                        <input
                          type="url"
                          value={adsBannerUrl}
                          onChange={e => setAdsBannerUrl(e.target.value)}
                          placeholder="e.g. https://images.unsplash.com/... (Suggested: 800x100)"
                          className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-xs outline-none focus:border-[#e0ff4f]"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">Interstitial Ad Image URL</span>
                        <input
                          type="url"
                          value={adsInterstitialUrl}
                          onChange={e => setAdsInterstitialUrl(e.target.value)}
                          placeholder="e.g. https://images.unsplash.com/... (Suggested: 600x800)"
                          className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-xs outline-none focus:border-[#e0ff4f]"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">Ad Click Destination URL</span>
                        <input
                          type="url"
                          value={adsTargetUrl}
                          onChange={e => setAdsTargetUrl(e.target.value)}
                          placeholder="e.g. https://instagram.com/mybrand"
                          className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-xs outline-none focus:border-[#e0ff4f]"
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdatingAds}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-[#12100E] disabled:opacity-60 cursor-pointer"
                    >
                      {isUpdatingAds ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Ads Configuration"}
                    </button>
                  </form>
                </section>
              )}

              {/* Installer instructions */}
              {activeTab === "installer" && (
                <section className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-4">
                  <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><Sliders className="h-4 w-4 text-[#e0ff4f]" />System Diagnostics & Configuration</h2>
                  
                  <div className="space-y-3 font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    <div className="rounded-lg border border-stone-850 bg-stone-900/60 p-3 space-y-1.5">
                      <div className="flex justify-between"><span>Shop Name:</span><strong className="text-[#e0ff4f]">{activeSeller?.name}</strong></div>
                      <div className="flex justify-between"><span>Storefront URL:</span><strong className="text-stone-300">{activeSellerUrl.replace(/^https?:\/\//i, "")}</strong></div>
                      <div className="flex justify-between"><span>Database:</span><strong className="text-stone-300">Cloud Firestore</strong></div>
                    </div>

                    <div className="space-y-1.5 p-1">
                      <h3 className="text-[11px] font-black text-stone-300 flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />API Limit & Platform Optimization</h3>
                      <p className="text-stone-500 font-serif leading-relaxed text-[11px] normal-case">Each storefront operates on Google Cloud Run with Firestore as the backend datastore. Uploads and modifications propagate instantly. Master admin coordinates connections via the central cloud gateway.</p>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

        </section>

      </div>

      {/* Footer Navigation */}
      {adminUser && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-850 bg-stone-950 px-3 py-2">
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-2">
            <button onClick={() => setActiveTab("drafts")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "drafts" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><FolderSync className="h-4 w-4" />Review</button>
            <button onClick={() => setActiveTab("orders")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "orders" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><ShoppingBag className="h-4 w-4" />Orders</button>
            <button onClick={() => setActiveTab("chats")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "chats" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><MessageCircle className="h-4 w-4" />Chats</button>
            <button onClick={() => setActiveTab("revenue")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "revenue" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><CreditCard className="h-4 w-4" />Revenue</button>
            <button onClick={() => setActiveTab("installer")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "installer" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><Sliders className="h-4 w-4" />Config</button>
          </div>
        </nav>
      )}
    </div>
  );
}
