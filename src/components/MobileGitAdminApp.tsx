import React, { useEffect, useState, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, MediaTypeSelection } from "@capacitor/camera";
import localDatabase from "../../products-db.json";
import { Product } from "../types";
import {
  Archive,
  CheckCircle2,
  Edit3,
  ImagePlus,
  Loader2,
  PackagePlus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  UploadCloud,
  Lock,
  User as UserIcon,
  LogOut,
  Globe,
  CreditCard
} from "lucide-react";

type ProductForm = { title: string; price: string; description: string; category: string; size: string; status: Product["status"]; tags: string };
type SelectedImage = { file: File; fileName: string; mimeType: string; dataUrl: string };
type CompressedImage = { base64: string; fileName: string; bytes: number };
type QueuedUploadStatus = "pending" | "uploading" | "failed";
type QueuedUpload = {
  id: string;
  createdAt: string;
  shopUrl: string;
  payload: ProductPayload;
  editingProductId: string | null;
  status?: QueuedUploadStatus;
  retryCount?: number;
  nextRetryTime?: number;
  errorMessage?: string;
};
type ProductPayload = { title: string; price: number; description: string; category: string; size: string; tags: string[]; images: CompressedImage[] };

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_MIN_DIMENSION = 420;
const IMAGE_INITIAL_QUALITY = 0.78;
const IMAGE_MIN_QUALITY = 0.36;
const IMAGE_TARGET_BYTES = 69 * 1024;
const IMAGE_SERVER_LIMIT_BYTES = 70 * 1024;
const PENDING_UPLOADS_KEY = "thrift-with-d-pending-product-uploads";

const blankProductForm: ProductForm = {
  title: "",
  price: "",
  description: "",
  category: "shirt",
  size: "M",
  status: "Available",
  tags: "Thrift, Vintage, Mutumba, Thrift With D",
};

const resolveCatalogAssetUrl = (url: string) => {
  if (!url || /^(https?:|data:|blob:)/.test(url)) return url;
  if (!url.startsWith("/")) return url;
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${url.replace(/^\/+/, "")}`;
};

const getFileExtension = (fileName: string, mimeType: string) => {
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension) return extension === "jpeg" ? "jpg" : extension;
  const mimeExtension = mimeType.split("/")[1]?.toLowerCase();
  return mimeExtension === "jpeg" ? "jpg" : mimeExtension || "jpg";
};

const readImageFile = (file: File) =>
  new Promise<SelectedImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ file, fileName: file.name, mimeType: file.type || "image/jpeg", dataUrl: String(reader.result || "") });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const getBase64Bytes = (dataUrl: string) => {
  const cleanBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const padding = cleanBase64.endsWith("==") ? 2 : cleanBase64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleanBase64.length * 3) / 4) - padding);
};

const applyRandomLUT = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  
  // Pick a random vintage LUT style: 0 = Warm Analog, 1 = Cool Retro, 2 = Gold Fade
  const style = Math.floor(Math.random() * 3);
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i+1];
    let b = data[i+2];
    
    if (style === 0) {
      // Warm Analog (Warm shadows, golden highlights, slightly faded blacks)
      r = Math.min(255, r * 1.05 + 10);
      g = Math.min(255, g * 0.98 + 5);
      b = Math.max(0, b * 0.90 - 5);
    } else if (style === 1) {
      // Cool Retro (Cyan/blue shadows, low contrast highlights)
      r = Math.max(0, r * 0.92);
      g = Math.min(255, g * 0.98 + 5);
      b = Math.min(255, b * 1.08 + 12);
    } else {
      // Gold Fade (Golden midtones, raised black level)
      r = Math.min(255, r * 1.02 + 8);
      g = Math.min(255, g * 0.95 + 8);
      b = Math.max(12, b * 0.85 + 4);
    }
    
    data[i] = r;
    data[i+1] = g;
    data[i+2] = b;
  }
  ctx.putImageData(imgData, 0, 0);
};

const loadPendingUploads = (): QueuedUpload[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_UPLOADS_KEY) || "[]") as QueuedUpload[];
  } catch {
    return [];
  }
};

const savePendingUploads = (uploads: QueuedUpload[]) => {
  localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
};

export default function MobileGitAdminApp() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("thrift-with-d-seller-token"));
  const [shopUrl, setShopUrl] = useState<string>(() => {
    const saved = localStorage.getItem("thrift-with-d-shop-url");
    if (saved) return saved;
    // Default to empty for native app, or current origin for web
    return Capacitor.isNativePlatform() ? "" : window.location.origin;
  });
  const [user, setUser] = useState<{ username: string; role: string; fullName: string } | null>(null);
  
  // Login credentials state
  const [shopUrlInput, setShopUrlInput] = useState(() => {
    const saved = localStorage.getItem("thrift-with-d-shop-url");
    if (saved) return saved;
    return Capacitor.isNativePlatform() ? "" : window.location.origin;
  });
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(blankProductForm);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"new" | "products" | "subscription">("new");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState("Ready");
  const [search, setSearch] = useState("");
  const [galleryPermission, setGalleryPermission] = useState("web picker");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscription states
  const [shopInfo, setShopInfo] = useState<{
    subscription: { active: boolean; expiryDate: string; tillNumber: string; priceKsh: number };
    subscriptionRequests: any[];
    adsConfig: { enabled: boolean; bannerUrl: string; targetUrl: string; interstitialUrl: string };
    metrics: { totalUploaded: number; totalSold: number; totalDeleted: number };
  } | null>(null);
  const [transCodeInput, setTransCodeInput] = useState("");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [subError, setSubError] = useState("");
  const [subSuccess, setSubSuccess] = useState("");

  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [pendingUploads, setPendingUploads] = useState<QueuedUpload[]>(() => loadPendingUploads());
  const [pendingUploadCount, setPendingUploadCount] = useState(() => loadPendingUploads().length);

  const updatePendingUploads = (uploads: QueuedUpload[]) => {
    savePendingUploads(uploads);
    setPendingUploads(uploads);
    setPendingUploadCount(uploads.length);
  };

  const nativeAdmin = Capacitor.isNativePlatform();
  const availableCount = products.filter((p) => p.status === "Available").length;
  const soldCount = products.filter((p) => p.status === "Sold").length;
  const filteredProducts = products.filter((p) => `${p.title} ${p.category} ${p.size} ${p.status}`.toLowerCase().includes(search.toLowerCase()));

  // Validate JWT on startup
  useEffect(() => {
    if (token && shopUrl) {
      void verifyTokenAndLoad();
    }
  }, [token, shopUrl]);

  // Request native permissions
  useEffect(() => {
    if (!nativeAdmin || !token) return;
    Camera.requestPermissions({ permissions: ["photos"] })
      .then((permissions) => {
        setGalleryPermission(permissions.photos);
      })
      .catch(() => setGalleryPermission("prompt"));
  }, [nativeAdmin, token]);

  const verifyTokenAndLoad = async () => {
    try {
      setIsLoading(true);
      setStatusText("Verifying credentials...");
      const response = await fetch(`${shopUrl}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Invalid token session");
      }
      const data = await response.json();
      setUser(data);
      setStatusText(`Logged in as ${data.fullName}`);
      void refreshCatalog();
    } catch {
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopUrlInput) {
      setLoginError("Please enter your Shop Hosting URL");
      return;
    }
    if (!usernameInput || !passwordInput) {
      setLoginError("Please enter both username and password");
      return;
    }

    // Clean URL: ensure starts with https:// or http://, strip trailing slash
    let cleanUrl = shopUrlInput.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }
    cleanUrl = cleanUrl.replace(/\/+$/, "");

    try {
      setIsLoggingIn(true);
      setLoginError("");
      const res = await fetch(`${cleanUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Incorrect login credentials");
      }
      const data = await res.json();
      localStorage.setItem("thrift-with-d-seller-token", data.token);
      localStorage.setItem("thrift-with-d-shop-url", cleanUrl);
      setToken(data.token);
      setShopUrl(cleanUrl);
      setUser(data.user);
      setStatusText(`Welcome, ${data.user.fullName}`);
    } catch (err: any) {
      setLoginError(err.message || "Unable to connect to shop server");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("thrift-with-d-seller-token");
    setToken(null);
    setUser(null);
    setProducts([]);
    setUsernameInput("");
    setPasswordInput("");
  };

  const fetchShopInfo = async () => {
    if (!token || !shopUrl) return;
    try {
      const [infoRes, reqsRes] = await Promise.all([
        fetch(`${shopUrl}/api/shop-info`),
        fetch(`${shopUrl}/api/subscription/requests`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      if (infoRes.ok && reqsRes.ok) {
        const info = await infoRes.json();
        const reqs = await reqsRes.json();
        setShopInfo({
          ...info,
          subscriptionRequests: reqs
        });
      }
    } catch (err) {
      console.warn("Could not fetch shop info", err);
    }
  };

  const handleRequestSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transCodeInput || transCodeInput.trim().length < 5) {
      setSubError("Please enter a valid transaction code.");
      return;
    }
    try {
      setIsSubmittingCode(true);
      setSubError("");
      setSubSuccess("");
      const res = await fetch(`${shopUrl}/api/subscription/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ transactionCode: transCodeInput.trim() })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit request");
      }
      setSubSuccess("Subscription request submitted successfully! Pending confirmation by Master Admin.");
      setTransCodeInput("");
      void fetchShopInfo();
    } catch (err: any) {
      setSubError(err.message || "Failed to submit request.");
    } finally {
      setIsSubmittingCode(false);
    }
  };

  const refreshCatalog = async () => {
    try {
      setIsLoading(true);
      setStatusText("Syncing latest catalog...");
      const res = await fetch(`${shopUrl}/api/products`);
      if (!res.ok) throw new Error("Could not download catalog");
      const data = await res.json();
      setProducts(data);
      setStatusText("Catalog synchronized");
      void fetchShopInfo();
    } catch (err: any) {
      setStatusText(err.message || "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  };

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? (Array.prototype.slice.call(event.target.files) as File[]).filter((file) => file.type.startsWith("image/")) : [];
    if (files.length === 0) return;
    try {
      setStatusText("Reading selected images...");
      const images = await Promise.all(files.map(readImageFile));
      setSelectedImages(images);
      setStatusText(`${images.length} image${images.length === 1 ? "" : "s"} ready`);
    } catch {
      setStatusText("Could not read selected images");
    }
  };

  const handleNativeGalleryPick = async () => {
    if (!nativeAdmin) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const permissions = await Camera.requestPermissions({ permissions: ["photos"] });
      setGalleryPermission(permissions.photos);
      if (permissions.photos !== "granted" && permissions.photos !== "limited") {
        setStatusText("Gallery permission not granted");
        return;
      }
      setStatusText("Opening phone gallery...");
      const result = await Camera.chooseFromGallery({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: !editingProductId,
        limit: editingProductId ? 1 : 20,
        quality: 92,
        targetWidth: 2200,
        targetHeight: 2200,
        correctOrientation: true,
      });
      const images = await Promise.all(result.results.map(async (photo, index) => {
        const src = photo.webPath || (photo.uri ? Capacitor.convertFileSrc(photo.uri) : "");
        if (!src) throw new Error("Image path was unavailable");
        const response = await fetch(src);
        const blob = await response.blob();
        const extension = getFileExtension(`gallery-${index + 1}.${photo.metadata?.format || "jpg"}`, blob.type || "image/jpeg");
        const file = new File([blob], `gallery-${Date.now()}-${index + 1}.${extension}`, { type: blob.type || "image/jpeg" });
        return readImageFile(file);
      }));
      setSelectedImages(images);
      setStatusText(`${images.length} gallery image${images.length === 1 ? "" : "s"} ready`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not open gallery");
    }
  };

  const resetEditor = () => {
    setForm(blankProductForm);
    setSelectedImages([]);
    setEditingProductId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canvasToJpegDataUrl = (canvas: HTMLCanvasElement, quality: number) =>
    new Promise<string>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Image compression failed"));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }, "image/jpeg", quality);
    });

  const compressImage = async (image: SelectedImage, index: number): Promise<CompressedImage> => {
    const imgEl = new Image();
    imgEl.src = image.dataUrl;
    await new Promise((resolve, reject) => {
      imgEl.onload = resolve;
      imgEl.onerror = reject;
    });

    let maxDimension = 1080; // Target max 1080px
    let quality = 0.80;      // Start at 80% quality
    let lastResult: CompressedImage | null = null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const scale = Math.min(1, maxDimension / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
      const width = Math.max(1, Math.round(imgEl.naturalWidth * scale));
      const height = Math.max(1, Math.round(imgEl.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.drawImage(imgEl, 0, 0, width, height);

      // Apply random LUT on the first attempt or before resizing down too much
      if (attempt === 0) {
        try {
          applyRandomLUT(ctx, width, height);
        } catch (e) {
          console.warn("LUT filter application failed:", e);
        }
      }

      const base64 = await canvasToJpegDataUrl(canvas, quality);
      const bytes = getBase64Bytes(base64);
      lastResult = { base64, fileName: image.fileName || `upload-${index + 1}.jpg`, bytes };

      if (bytes <= IMAGE_TARGET_BYTES) return lastResult;

      // Iteratively scale down or reduce quality to fit within limits
      if (quality > IMAGE_MIN_QUALITY) {
        quality = Math.max(IMAGE_MIN_QUALITY, quality - 0.10);
      } else {
        maxDimension = Math.max(IMAGE_MIN_DIMENSION, Math.floor(maxDimension * 0.80));
      }
    }

    if (lastResult && lastResult.bytes <= IMAGE_SERVER_LIMIT_BYTES) return lastResult;
    throw new Error(`Image ${image.fileName} could not compress below 70KB. Try cropping or choosing a smaller photo.`);
  };

  const buildProductPayload = (images: CompressedImage[]): ProductPayload => ({
    title: form.title.trim() || "New Vintage apparel",
    price: Number(form.price) || 0,
    description: form.description.trim(),
    category: form.category || "shirt",
    size: form.size || "M",
    tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    images
  });

  const enqueuePendingUpload = (payload: ProductPayload, productId: string | null) => {
    const uploads = loadPendingUploads();
    uploads.push({
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      shopUrl,
      payload,
      editingProductId: productId,
      status: "pending"
    });
    updatePendingUploads(uploads);
  };

  const postProductPayload = async (payload: ProductPayload, productId: string | null, onSuccess?: () => void) => {
    const url = productId ? `${shopUrl}/api/products/${productId}` : `${shopUrl}/api/products`;
    const method = productId ? "PUT" : "POST";
    
    // Map product payload to what the API expects (name, description, price, category)
    const apiBody = {
      name: payload.title,
      description: payload.description,
      price: payload.price,
      category: payload.category
    };

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(apiBody)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to ${method} product`);
    }

    onSuccess?.();
  };

  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const runQueueWorker = async () => {
    if (!token || !shopUrl || isProcessingQueue) return;

    const queue = loadPendingUploads().filter((item) => item.shopUrl === shopUrl);
    if (queue.length === 0) return;

    // Find the first item that is ready to be uploaded (either new/pending, or failed and retry time has arrived)
    const now = Date.now();
    const candidateIndex = queue.findIndex((item) => {
      if (!item.status || item.status === "pending") return true;
      if (item.status === "failed" && (!item.nextRetryTime || now >= item.nextRetryTime)) return true;
      return false;
    });

    if (candidateIndex === -1) return;

    const candidate = queue[candidateIndex];
    setIsProcessingQueue(true);

    // Update candidate status to "uploading"
    const updatedQueueBefore = loadPendingUploads();
    const targetIdx = updatedQueueBefore.findIndex((item) => item.id === candidate.id);
    if (targetIdx !== -1) {
      updatedQueueBefore[targetIdx].status = "uploading";
      updatedQueueBefore[targetIdx].errorMessage = undefined;
      updatePendingUploads(updatedQueueBefore);
    }

    try {
      setStatusText(`Uploading "${candidate.payload.title}" (background)...`);
      await postProductPayload(candidate.payload, candidate.editingProductId);

      // Success: Remove item from queue
      const remainingQueue = loadPendingUploads().filter((item) => item.id !== candidate.id);
      updatePendingUploads(remainingQueue);
      setStatusText(`Successfully uploaded "${candidate.payload.title}"`);
      void refreshCatalog();
    } catch (err: any) {
      const errMsg = err.message || "Network error";
      const retryCount = (candidate.retryCount || 0) + 1;
      // Exponential backoff: 5s, 10s, 20s, 40s... max 120s
      const delayMs = Math.min(120_000, 5_000 * Math.pow(2, retryCount - 1));
      const nextRetryTime = Date.now() + delayMs;

      console.warn(`Upload failed for ${candidate.id}. Retry in ${delayMs / 1000}s. Error: ${errMsg}`);

      const updatedQueueAfter = loadPendingUploads();
      const errIdx = updatedQueueAfter.findIndex((item) => item.id === candidate.id);
      if (errIdx !== -1) {
        updatedQueueAfter[errIdx].status = "failed";
        updatedQueueAfter[errIdx].retryCount = retryCount;
        updatedQueueAfter[errIdx].nextRetryTime = nextRetryTime;
        updatedQueueAfter[errIdx].errorMessage = `${errMsg} (Retrying in ${Math.round(delayMs / 1000)}s)`;
        updatePendingUploads(updatedQueueAfter);
      }
      setStatusText(`Upload failed: ${errMsg}`);
    } finally {
      setIsProcessingQueue(false);
    }
  };

  useEffect(() => {
    if (!token || !shopUrl) return;
    const intervalId = setInterval(() => {
      void runQueueWorker();
    }, 3000);

    const onlineTrigger = () => {
      // Reset retry times of failed items to run immediately when back online
      const currentQueue = loadPendingUploads();
      const resetQueue = currentQueue.map((item) => {
        if (item.status === "failed") {
          return { ...item, nextRetryTime: 0 };
        }
        return item;
      });
      updatePendingUploads(resetQueue);
      void runQueueWorker();
    };

    window.addEventListener("online", onlineTrigger);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", onlineTrigger);
    };
  }, [token, shopUrl, isProcessingQueue]);

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingProductId && selectedImages.length === 0) {
      setStatusText("Select at least one product image");
      return;
    }

    try {
      setIsSaving(true);
      setStatusText("Processing and queueing images...");

      const compressedImages: CompressedImage[] = [];
      for (let idx = 0; idx < selectedImages.length; idx += 1) {
        setStatusText(`Processing image ${idx + 1}/${selectedImages.length}...`);
        const compressed = await compressImage(selectedImages[idx], idx);
        compressedImages.push(compressed);
      }

      if (editingProductId) {
        const payload = buildProductPayload(compressedImages);
        enqueuePendingUpload(payload, editingProductId);
        setStatusText("Product edit added to sync queue");
      } else {
        // Multiple selected images are added as separate product entries in the catalog
        for (let idx = 0; idx < compressedImages.length; idx += 1) {
          const payload = buildProductPayload([compressedImages[idx]]);
          enqueuePendingUpload(payload, null);
        }
        setStatusText(`Added ${compressedImages.length} items to sync queue`);
      }

      resetEditor();
      setActiveTab("products");
    } catch (error: any) {
      setStatusText(`Queueing failed: ${error.message || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };
  const handleModifyProduct = async (productId: string, action: "sold" | "restore" | "delete", title: string) => {
    if (action === "delete" && !window.confirm(`Delete ${title}?`)) return;

    try {
      setIsSaving(true);
      setStatusText(`Processing product ${action}...`);

      let res;
      if (action === "delete") {
        res = await fetch(`${shopUrl}/api/products/${productId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } else {
        const newStatus = action === "sold" ? "sold" : "active";
        res = await fetch(`${shopUrl}/api/products/${productId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${action} product`);
      }

      setStatusText(`Product ${action} completed successfully.`);
      void refreshCatalog();
    } catch (err: any) {
      setStatusText(err.message || `Failed to ${action} product`);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingProduct = (product: Product) => {
    setEditingProductId(product.id);
    setForm({
      title: product.title,
      price: String(product.price),
      description: product.description,
      category: product.category,
      size: product.size,
      status: product.status,
      tags: product.tags.join(", "),
    });
    setSelectedImages([]);
    setActiveTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Rendering Login view if unauthenticated
  if (!token) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] text-[#FAF6EE] flex items-center justify-center px-4 font-sans antialiased">
        <div className="w-full max-w-md border border-stone-850 bg-stone-950 p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#e0ff4f]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#e0ff4f] text-[#12100E] font-black text-xl mb-3 shadow-md shadow-[#e0ff4f]/15">D</div>
            <h1 className="text-base font-black uppercase tracking-widest">Thrift With D</h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500 mt-1">Seller Administration</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-300 text-xs font-mono rounded-lg text-center">
                {loginError}
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f] flex items-center gap-1"><Globe className="h-3 w-3" />Shop Hosting URL</span>
              <input
                type="text"
                value={shopUrlInput}
                onChange={(e) => setShopUrlInput(e.target.value)}
                className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"
                placeholder="my-thrift-shop.web.app"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f] flex items-center gap-1"><UserIcon className="h-3 w-3" />Shop Name</span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"
                placeholder="e.g. Ayo Shop"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f] flex items-center gap-1"><Lock className="h-3 w-3" />Phone Number</span>
              <input
                type="tel"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"
                placeholder="e.g. 0712345678"
              />
            </label>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#12100E] disabled:opacity-65 cursor-pointer mt-2"
            >
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Identity"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-[#FAF6EE] font-sans antialiased">
      <header className="sticky top-0 z-40 border-b border-stone-850 bg-stone-950/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e0ff4f] text-sm font-black text-[#12100E]">D</div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black uppercase tracking-widest">Thrift With D Admin</h1>
                <p className="truncate text-[9px] font-mono uppercase tracking-wider text-stone-500">Secure Serverless Git Proxy Client</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-400 hover:text-stone-200"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2 text-center font-mono text-[9px] uppercase tracking-wider">
          <div className="rounded-lg border border-stone-850 bg-stone-900/60 px-2 py-2"><span className="block text-stone-500">Available</span><strong className="text-[#e0ff4f]">{availableCount}</strong></div>
          <div className="rounded-lg border border-stone-850 bg-stone-900/60 px-2 py-2"><span className="block text-stone-500">Sold Out</span><strong className="text-stone-200">{soldCount}</strong></div>
          <div className="rounded-lg border border-stone-850 bg-stone-900/60 px-2 py-2">
            <span className="block text-stone-500">Daily Deploys</span>
            <strong className="text-[#e0ff4f]">{quotaRemaining !== null ? `${quotaRemaining} left` : "5/5"}</strong>
          </div>
          <div className="rounded-lg border border-stone-850 bg-stone-900/60 px-2 py-2"><span className="block text-stone-500">Client</span><strong className="text-stone-200">{galleryPermission}</strong></div>
          <div className="rounded-lg border border-stone-850 bg-stone-900/60 px-2 py-2"><span className="block text-stone-500">Queued</span><strong className="text-[#e0ff4f]">{pendingUploadCount}</strong></div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-28 pt-4">
        {/* Connection status card */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-850 bg-stone-950 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {isLoading || isSaving || isProcessingQueue ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#e0ff4f]" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-[#e0ff4f]" />}
            <span className="truncate text-[10px] font-mono uppercase tracking-wider text-stone-300">{statusText}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pendingUploadCount > 0 && <button type="button" onClick={() => void runQueueWorker()} disabled={isLoading || isSaving || isProcessingQueue} className="rounded-lg border border-[#e0ff4f]/35 bg-[#e0ff4f]/10 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-[#e0ff4f] disabled:opacity-50">Sync Now ({pendingUploadCount})</button>}
            <button type="button" onClick={() => void refreshCatalog()} disabled={isLoading || isSaving} className="grid h-9 w-9 place-items-center rounded-lg border border-stone-800 bg-stone-900 text-stone-300 disabled:opacity-50" title="Sync Git catalog" aria-label="Sync Git catalog"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></button>
          </div>
        </div>

        {/* Background Sync Queue Status */}
        {pendingUploads.length > 0 && (
          <div className="rounded-lg border border-stone-850 bg-stone-950 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-stone-900 pb-2">
              <span className="text-[10px] font-mono uppercase text-stone-400">Sync Queue ({pendingUploads.length} items)</span>
              <span className="text-[9px] font-mono uppercase text-[#e0ff4f] animate-pulse">Background Sync Active</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-stone-900/40">
              {pendingUploads.map((item) => (
                <div key={item.id} className="flex items-center justify-between pt-1.5 text-[9px] font-mono uppercase">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-stone-200 block truncate">{item.payload.title}</span>
                    <span className="text-[8px] text-stone-500 block">
                      {item.payload.category} • {item.payload.size} • KSh {(item.payload.price * 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-2">
                    {item.status === "uploading" && (
                      <span className="text-[#e0ff4f] flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="text-red-400 text-right max-w-[200px] truncate" title={item.errorMessage}>
                        {item.errorMessage || "Failed"}
                      </span>
                    )}
                    {(!item.status || item.status === "pending") && (
                      <span className="text-stone-500">
                        Waiting in queue
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "new" && (
          <section className="rounded-lg border border-stone-850 bg-stone-950 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-xs font-black uppercase tracking-widest">{editingProductId ? "Edit Product" : "Add Product"}</h2><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-stone-500">{editingProductId ? "Update one catalog item" : "Gallery to live carousel"}</p></div>
              {editingProductId && <button type="button" onClick={resetEditor} className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-300">Clear</button>}
            </div>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div className="rounded-lg border border-dashed border-[#e0ff4f]/35 bg-[#e0ff4f]/5 p-4 text-center">
                <input ref={fileInputRef} type="file" accept="image/*" multiple={!editingProductId} onChange={handleImageSelect} className="sr-only" />
                <ImagePlus className="mx-auto h-8 w-8 text-[#e0ff4f]" />
                <span className="mt-2 block text-xs font-black uppercase tracking-widest">Select From Phone Gallery</span>
                <span className="mt-1 block text-[10px] font-mono uppercase tracking-wider text-stone-500">{selectedImages.length > 0 ? `${selectedImages.length} selected` : editingProductId ? "Optional replacement image" : "One or many product photos"}</span>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleNativeGalleryPick} className="flex items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#12100E]"><CheckCircle2 className="h-4 w-4" />Gallery Access</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-stone-200"><ImagePlus className="h-4 w-4" />File Picker</button>
                </div>
              </div>
              {selectedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedImages.slice(0, 6).map((image) => <img key={`${image.fileName}-${image.dataUrl.slice(0, 32)}`} src={image.dataUrl} alt={image.fileName} className="aspect-[3/4] w-full rounded-lg border border-stone-850 object-cover" />)}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Title</span><input value={form.title} onChange={(event) => updateForm("title", event.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]" placeholder="Vintage mutumba puffer" /></label>
                <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Price</span><input type="number" inputMode="numeric" value={form.price} onChange={(event) => updateForm("price", event.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]" placeholder="45" /></label>
                <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Category</span><select value={form.category} onChange={(event) => updateForm("category", event.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"><option value="shirt">Shirt</option><option value="tshirt">T-Shirt</option><option value="dress">Dress</option><option value="trouser">Trouser</option><option value="shoe">Shoe</option><option value="boxer_short">Boxer Short</option><option value="jacket">Jacket / Outerwear</option><option value="bag">Bag</option><option value="accessory">Accessory</option></select></label>
                <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Size</span><input value={form.size} onChange={(event) => updateForm("size", event.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]" placeholder="M" /></label>
              </div>
              <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Description</span><textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className="min-h-24 w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]" placeholder="Fabric, condition, fit, styling notes..." /></label>
              <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Tags</span><input value={form.tags} onChange={(event) => updateForm("tags", event.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]" placeholder="Mutumba, Puffer, Streetwear" /></label>
              {editingProductId && <label className="space-y-1 block"><span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">Status</span><select value={form.status} onChange={(event) => updateForm("status", event.target.value as Product["status"])} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]"><option value="Available">Available</option><option value="On Hold">On Hold</option><option value="Sold">Sold</option></select></label>}
              <button type="submit" disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#12100E] disabled:opacity-60 cursor-pointer">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{editingProductId ? "Compress + Push Update" : "Compress + Push To Git"}</button>
            </form>
          </section>
        )}

        {activeTab === "products" && (
          <section className="space-y-3">
            <div className="rounded-lg border border-stone-850 bg-stone-950 p-3">
              <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-xs font-black uppercase tracking-widest">Products</h2><span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">Secure Serverless Proxy</span></div>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-3 text-sm outline-none focus:border-[#e0ff4f]" placeholder="Search catalog" />
            </div>
            {filteredProducts.map((product) => (
              <article key={product.id} className="grid grid-cols-[86px_1fr] gap-3 rounded-lg border border-stone-850 bg-stone-950 p-2">
                <img src={resolveCatalogAssetUrl(product.imageUrl)} alt={product.title} className="h-28 w-full rounded-lg border border-stone-850 object-cover" />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><h3 className="truncate text-sm font-bold">{product.title}</h3><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-stone-500">{product.category} / {product.size} / KSh {(product.price * 100).toLocaleString()}</p></div>
                    <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-black uppercase tracking-wider ${product.status === "Available" ? "bg-[#e0ff4f] text-[#12100E]" : "bg-stone-800 text-stone-300"}`}>{product.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => startEditingProduct(product)} className="flex items-center justify-center gap-1 rounded-lg border border-stone-800 bg-stone-900 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-stone-200"><Edit3 className="h-3.5 w-3.5" />Edit</button>
                    {product.status === "Available" ? <button type="button" onClick={() => handleModifyProduct(product.id, "sold", product.title)} disabled={isSaving} className="flex items-center justify-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-amber-200 disabled:opacity-60"><ShoppingBag className="h-3.5 w-3.5" />Sold</button> : <button type="button" onClick={() => handleModifyProduct(product.id, "restore", product.title)} disabled={isSaving} className="flex items-center justify-center gap-1 rounded-lg border border-[#e0ff4f]/30 bg-[#e0ff4f]/10 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-[#e0ff4f] disabled:opacity-60"><Archive className="h-3.5 w-3.5" />Restore</button>}
                    <button type="button" onClick={() => handleModifyProduct(product.id, "delete", product.title)} disabled={isSaving} className="col-span-2 flex items-center justify-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-red-200 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" />Delete From Git Catalog</button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {activeTab === "subscription" && (
          <section className="space-y-4">
            <div className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-3">
              <h2 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#e0ff4f]" /> Ad-Free Subscription
              </h2>
              <p className="text-[10px] font-mono uppercase tracking-wider text-stone-500">
                Remove advertisements from your storefront website and seller APK
              </p>

              {/* Status Display */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-stone-900 border border-stone-800">
                <span className="text-[10px] font-mono uppercase text-stone-400">Subscription Status:</span>
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                  shopInfo?.subscription?.active 
                    ? "bg-[#e0ff4f]/15 border border-[#e0ff4f]/35 text-[#e0ff4f]" 
                    : "bg-red-950/20 border border-red-900/50 text-red-400"
                }`}>
                  {shopInfo?.subscription?.active ? "Active" : "Inactive (Showing Ads)"}
                </span>
              </div>

              {shopInfo?.subscription?.active && shopInfo?.subscription?.expiryDate && (
                <div className="text-[9px] font-mono uppercase text-stone-400 text-right mt-1">
                  Expires: {new Date(shopInfo.subscription.expiryDate).toLocaleDateString([], { dateStyle: "long" })}
                </div>
              )}
            </div>

            {/* Payment instructions */}
            <div className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">Payment Instructions</h3>
              <div className="space-y-2 text-[11px] leading-relaxed text-stone-400">
                <p>To purchase or renew your ad-free subscription (300 KSh/month), make payments via M-Pesa Buy Goods Till:</p>
                <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 text-center font-mono space-y-1">
                  <span className="text-[10px] uppercase text-stone-500 block">M-PESA BUY GOODS TILL NUMBER</span>
                  <strong className="text-lg font-black text-[#e0ff4f] block tracking-widest">5834631</strong>
                  <span className="text-[10px] uppercase text-stone-300 block">Amount: 300 KSh</span>
                </div>
                <p className="mt-2 text-stone-500 font-serif italic">Once paid, enter the M-Pesa Transaction Code below to request activation from the Master Admin.</p>
              </div>

              <form onSubmit={handleRequestSubscription} className="space-y-3 pt-2 border-t border-stone-900">
                {subError && <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-300 text-[10px] font-mono rounded-lg text-center">{subError}</div>}
                {subSuccess && <div className="p-3 bg-[#e0ff4f]/10 border border-[#e0ff4f]/25 text-[#e0ff4f] text-[10px] font-mono rounded-lg text-center">{subSuccess}</div>}
                
                <label className="block space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-[#e0ff4f]">M-Pesa Transaction Code</span>
                  <input
                    required
                    type="text"
                    value={transCodeInput}
                    onChange={e => setTransCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. QW12ER34TY"
                    className="w-full rounded-lg border border-stone-800 bg-stone-900 px-3 py-2.5 text-sm outline-none focus:border-[#e0ff4f] uppercase font-mono"
                  />
                </label>
                
                <button
                  type="submit"
                  disabled={isSubmittingCode}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#e0ff4f] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#12100E] disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Activation"}
                </button>
              </form>
            </div>

            {/* Request history */}
            {shopInfo?.subscriptionRequests && shopInfo.subscriptionRequests.length > 0 && (
              <div className="rounded-lg border border-stone-850 bg-stone-950 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-300">Transaction History</h3>
                <div className="space-y-2">
                  {shopInfo.subscriptionRequests.map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between p-2 rounded border border-stone-900 bg-stone-900/40 text-[10px] font-mono uppercase">
                      <div>
                        <span className="font-bold text-[#e0ff4f]">{req.transactionCode}</span>
                        <span className="block text-[8px] text-stone-500 mt-0.5">{new Date(req.timestamp).toLocaleString()}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        req.status === "approved" ? "bg-[#e0ff4f]/10 text-[#e0ff4f]" :
                        req.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-950/20 text-red-400"
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Ad Banner display if inactive */}
        {shopInfo && !shopInfo.subscription?.active && shopInfo.adsConfig?.enabled && (
          <div className="mt-4 rounded-lg border border-stone-850 bg-stone-950 overflow-hidden shadow-lg relative aspect-[16/5] sm:aspect-[6/1] w-full">
            <a href={shopInfo.adsConfig.targetUrl || "#"} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img 
                src={shopInfo.adsConfig.bannerUrl || "https://images.unsplash.com/photo-1542291026-7eec264c27ff"} 
                alt="Sponsored Ad" 
                className="w-full h-full object-cover" 
              />
              <span className="absolute top-1 right-1 bg-black/60 text-[7px] font-mono text-stone-400 uppercase tracking-widest px-1 py-0.5 rounded">Sponsored Ad</span>
            </a>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-850 bg-stone-950 px-3 py-2">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
          <button type="button" onClick={() => setActiveTab("new")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "new" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><PackagePlus className="h-4 w-4" />Add</button>
          <button type="button" onClick={() => setActiveTab("products")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "products" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><ShoppingBag className="h-4 w-4" />Products</button>
          <button type="button" onClick={() => setActiveTab("subscription")} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-wider cursor-pointer ${activeTab === "subscription" ? "bg-[#e0ff4f] text-[#12100E]" : "text-stone-400"}`}><CreditCard className="h-4 w-4" />Subscribe</button>
        </div>
      </nav>
    </div>
  );
}




