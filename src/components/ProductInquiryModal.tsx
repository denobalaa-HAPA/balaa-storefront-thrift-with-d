import React from "react";
import { Product, ShopInfo } from "../types";
import { X, Instagram, MapPin, Compass, Send } from "lucide-react";

interface ProductInquiryModalProps {
  product: Product | null;
  onClose: () => void;
  onPlaceOrder?: (product: Product) => void;
  onGetDirections?: () => void;
  shopInfo?: ShopInfo | null;
}

export default function ProductInquiryModal({
  product,
  onClose,
  onPlaceOrder,
  onGetDirections,
  shopInfo,
}: ProductInquiryModalProps) {
  if (!product) return null;

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);

  const shopName = shopInfo?.name || "Shop";
  const shopPhone = shopInfo?.contact?.phone || shopInfo?.phone || "";
  const shopEmail = shopInfo?.contact?.email || shopInfo?.email || "";

  const instagramUrl = shopInfo?.social?.instagram ? `https://instagram.com/${shopInfo.social.instagram.replace('@', '')}` : "https://instagram.com/";

  const handlePlaceOrder = () => {
    if (onPlaceOrder) {
      onPlaceOrder(product);
    }
    onClose();
  };

  const handleInstagramInquiry = () => {
    window.open(instagramUrl, "_blank");
    onClose();
  };

  const handleDirectionsClick = () => {
    if (onGetDirections) {
      onGetDirections();
    }
    onClose();
  };

  const images = (product.product_images && product.product_images.length > 0)
    ? product.product_images.map(img => img.image_url)
    : [product.imageUrl];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-[#FAF6EE]">
      <div className="relative w-full max-w-md bg-[#1C1917] border-2 border-stone-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 overflow-hidden flex flex-col justify-between select-none">
        <div className="absolute left-0 top-0 right-0 h-1.5 bg-gradient-to-r from-[#e0ff4f] to-[#FAF6EE] opacity-80" />
        <div className="flex justify-end items-center mb-4 pb-2 border-b border-stone-850/50">
          <button onClick={onClose} className="text-stone-400 hover:bg-stone-800 hover:text-white p-1 rounded-full border border-stone-800 transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-mono uppercase bg-[#e0ff4f] text-[#12100E] px-2 py-0.5 rounded font-black tracking-wider block w-fit">
              {product.category}
            </span>
            <span className="text-xs font-mono font-bold text-stone-400">
              {product.title}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {images.map((imgUrl, idx) => (
              <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 relative">
                <img src={imgUrl} alt={`${product.title} - ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        <p className="font-serif text-xs text-stone-400 leading-relaxed mb-6">
          You are looking at a handpicked archive piece. Select an action below to negotiate or inquire, or get directions to our depot.
        </p>

        <div className="space-y-3 font-mono text-xs">
          <button onClick={handlePlaceOrder} className="w-full flex items-center justify-center gap-2 bg-[#e0ff4f] hover:bg-[#c8eb2c] text-[#12100E] py-3 px-4 rounded-xl border border-stone-800 shadow-md transition-colors cursor-pointer font-black uppercase text-[11px]">
            <Send className="w-4 h-4 text-stone-900" />
            <span>Order Item</span>
          </button>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={handleDirectionsClick} className="flex items-center justify-center gap-1.5 bg-stone-800/40 hover:bg-stone-800/60 text-stone-300 py-3 px-3 rounded-xl border border-stone-800/50 transition-colors cursor-pointer font-black uppercase text-[10px]">
              <Compass className="w-3.5 h-3.5" />
              <span>Get Directions</span>
            </button>

            <button onClick={handleInstagramInquiry} className="flex items-center justify-center gap-1.5 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 py-3 px-3 rounded-xl border border-pink-500/30 transition-colors cursor-pointer font-black uppercase text-[10px]">
              <Instagram className="w-3.5 h-3.5" />
              <span>Instagram</span>
            </button>
          </div>

          <div className="pt-2 flex items-center gap-1.5 justify-center text-[10px] text-stone-500 font-sans border-t border-dashed border-stone-800 mt-2">
            <MapPin className="w-3 h-3 text-[#e0ff4f]" />
            <span>Physical Depot: Nairobi, Kenya</span>
          </div>

          <button onClick={onClose} className="w-full text-stone-400 bg-stone-900/40 hover:bg-stone-900 py-2.5 px-4 rounded-xl border border-stone-850 transition-colors cursor-pointer font-bold uppercase text-[10px] mt-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
