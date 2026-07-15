import React, { useState, useEffect, useMemo, useRef } from "react";
import { Product } from "../types";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface Product3DCarouselProps {
  products: Product[];
  onSelect: (product: Product) => void;
}

const getCarouselImageUrl = (url: string, width: 480 | 768) => {
  if (!url || /^(https?:|data:|blob:)/i.test(url)) return url;

  const cleanUrl = url.split(/[?#]/)[0];
  const suffix = url.slice(cleanUrl.length);
  const slashIndex = cleanUrl.lastIndexOf("/");
  const directory = slashIndex >= 0 ? cleanUrl.slice(0, slashIndex) : "";
  const fileName = slashIndex >= 0 ? cleanUrl.slice(slashIndex + 1) : cleanUrl;
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex < 0) return url;

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  if (extension !== "jpg" && extension !== "jpeg") return url;

  const stem = fileName.slice(0, dotIndex);
  return `${directory ? `${directory}/` : ""}carousel/${stem}-${width}.jpg${suffix}`;
};

const getCarouselImageSrcSet = (url: string) => {
  if (!url || /^(https?:|data:|blob:)/i.test(url)) return undefined;
  const small = getCarouselImageUrl(url, 480);
  const large = getCarouselImageUrl(url, 768);
  if (small === url || large === url) return undefined;
  return `${small} 480w, ${large} 768w`;
};

export default function Product3DCarousel({ products, onSelect }: Product3DCarouselProps) {
  const [currentAngle, setCurrentAngle] = useState(0);
  const angleRef = useRef(0);
  
  // Carousel states
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const originalAngleRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Settings
  const angleIncrement = 30; // degrees per virtual product step; the list can loop through any catalog size
  const [radius, setRadius] = useState(690);
  const [cardWidth, setCardWidth] = useState(300);
  const [cardHeight, setCardHeight] = useState(360);
  const [isMobile, setIsMobile] = useState(false);

  // Scale against the real stage size so the carousel fills the available viewport.
  useEffect(() => {
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const handleResize = () => {
      const w = window.innerWidth;
      const stageBounds = stageRef.current?.getBoundingClientRect();
      const stageWidth = stageBounds?.width || window.innerWidth;
      const stageHeight = stageBounds?.height || window.innerHeight;
      const mobile = w < 640;

      setIsMobile(mobile);

      const sideReserve = mobile ? 92 : w < 1024 ? 130 : 190;
      const verticalReserve = mobile ? 58 : 36;
      const usableWidth = Math.max(220, stageWidth - sideReserve);
      const usableHeight = Math.max(260, stageHeight - verticalReserve);

      let nextCardHeight = 260;
      let nextCardWidth = 165;

      if (w < 480) {
        nextCardHeight = clamp(Math.min(usableHeight * 0.72, usableWidth * 1.32), 210, 280);
        nextCardWidth = clamp(nextCardHeight * 0.62, 132, 176);
      } else if (w < 640) {
        nextCardHeight = clamp(Math.min(usableHeight * 0.72, usableWidth * 1.28), 220, 300);
        nextCardWidth = clamp(nextCardHeight * 0.63, 150, 194);
      } else if (w < 1024) {
        nextCardHeight = clamp(Math.min(usableHeight * 0.7, usableWidth * 1.06), 260, 340);
        nextCardWidth = clamp(nextCardHeight * 0.66, 170, 228);
      } else if (w < 1440) {
        nextCardHeight = clamp(Math.min(usableHeight * 0.68, usableWidth * 0.78), 300, 390);
        nextCardWidth = clamp(nextCardHeight * 0.67, 205, 262);
      } else {
        nextCardHeight = clamp(Math.min(usableHeight * 0.68, usableWidth * 0.72), 330, 450);
        nextCardWidth = clamp(nextCardHeight * 0.68, 230, 306);
      }

      const radiusMultiplier = w < 480 ? 1.9 : w < 640 ? 1.98 : w < 1024 ? 2.04 : 2.12;
      setCardHeight(Math.round(nextCardHeight));
      setCardWidth(Math.round(nextCardWidth));
      setRadius(Math.round(nextCardWidth * radiusMultiplier));
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    let observer: ResizeObserver | undefined;
    if (stageRef.current && "ResizeObserver" in window) {
      observer = new ResizeObserver(handleResize);
      observer.observe(stageRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, []);

  // Wheel scroll handler
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || products.length === 0) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      const stepValue = direction * angleIncrement;
      // Snap to nearest slot
      angleRef.current = Math.round((angleRef.current + stepValue) / angleIncrement) * angleIncrement;
      setCurrentAngle(angleRef.current);
    };

    el.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => el.removeEventListener("wheel", handleWheelEvent);
  }, [products.length, angleIncrement]);

  // Drag handlers
  const onDragStart = (clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
    originalAngleRef.current = angleRef.current;
  };

  const onDragMove = (clientX: number) => {
    if (!isDragging) return;
    const deltaX = clientX - startXRef.current;
    const dynamicFactor = window.innerWidth < 640 ? 0.3 : 0.15;
    const nextAngle = originalAngleRef.current + (deltaX * dynamicFactor);
    angleRef.current = nextAngle;
    setCurrentAngle(nextAngle);
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    // Snap to nearest slot
    const snappedAngle = Math.round(angleRef.current / angleIncrement) * angleIncrement;
    angleRef.current = snappedAngle;
    setCurrentAngle(snappedAngle);
  };

  // Nav actions
  const handlePrev = () => {
    angleRef.current = Math.round((angleRef.current + angleIncrement) / angleIncrement) * angleIncrement;
    setCurrentAngle(angleRef.current);
  };

  const handleNext = () => {
    angleRef.current = Math.round((angleRef.current - angleIncrement) / angleIncrement) * angleIncrement;
    setCurrentAngle(angleRef.current);
  };

  // 1. Calculate active index centered in viewport
  // Angle is negative when spinning forward, so invert it
  const totalProducts = products.length;
  const centerItemIndex = totalProducts > 0 ? Math.round(-currentAngle / angleIncrement) : 0;
  const normalizedActiveIndex = totalProducts > 0
    ? ((centerItemIndex % totalProducts) + totalProducts) % totalProducts
    : 0;

  // 2. Generate window of cards (from centerItemIndex - windowRange to centerItemIndex + windowRange)
  // Rendering fewer cards on mobile (5 vs 9) reduces rendering overhead and prevents clutter
  const windowRange = isMobile ? 1 : 4;
  const visibleCards = useMemo(() => {
    const cards: { product: Product; slotIndex: number; cardAngle: number }[] = [];
    if (totalProducts === 0) return cards;

    for (let offset = -windowRange; offset <= windowRange; offset++) {
      const slotIndex = centerItemIndex + offset;
      const productIdx = ((slotIndex % totalProducts) + totalProducts) % totalProducts;
      const product = products[productIdx];
      const cardAngle = slotIndex * angleIncrement;
      cards.push({ product, slotIndex, cardAngle });
    }

    return cards;
  }, [angleIncrement, centerItemIndex, products, totalProducts, windowRange]);

  // No autoplay - manual interaction only

  if (!products || products.length === 0) return null;

  return (
    <div ref={stageRef} className="w-full h-full flex-1 min-h-0 overflow-hidden relative select-none flex flex-col items-center">
      
      {/* 3D Perspective CSS */}
      <style>{`
        .carousel-viewport-depth {
          perspective: 1800px;
        }
        .carousel-cylinder-preserve {
          transform-style: preserve-3d;
        }
        .carousel-item-preserve {
          transform-style: preserve-3d;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
      `}</style>

      {/* Collection identity, tucked away from the product stage */}
      <div className="pointer-events-none absolute left-4 top-5 z-30 hidden items-center gap-3 sm:flex">
        <div className="h-44 w-px bg-gradient-to-b from-transparent via-[#e0ff4f]/60 to-transparent" />
        <div className="flex rotate-180 items-center gap-3 [writing-mode:vertical-rl]">
          <div className="flex items-center gap-1.5 text-[#e0ff4f] text-[9px] font-mono uppercase tracking-widest font-black">
            <Sparkles className="h-3 w-3" />
            <span>Curated Selection</span>
          </div>
          <h2 className="font-sans text-sm font-black uppercase tracking-[0.28em] text-[#FAF6EE]/85">
            The Collection
          </h2>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-30 sm:hidden">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#e0ff4f]/25 bg-[#12100E]/75 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-[#e0ff4f] shadow-lg backdrop-blur-md">
          <Sparkles className="h-3 w-3" />
          <span>Curated</span>
        </div>
        <h2 className="mt-1 text-right font-sans text-[11px] font-black uppercase tracking-[0.24em] text-[#FAF6EE]/85">
          Collection
        </h2>
      </div>

      {/* Viewport Map Area */}
      <div 
        ref={viewportRef}
        onMouseDown={(e) => onDragStart(e.clientX)}
        onMouseMove={(e) => onDragMove(e.clientX)}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
        onTouchMove={(e) => onDragMove(e.touches[0].clientX)}
        onTouchEnd={onDragEnd}
        className="carousel-viewport-depth w-full h-full flex-1 min-h-0 flex justify-center items-center overflow-visible active:cursor-grabbing cursor-grab relative z-20 touch-pan-y"
      >
        {/* Soft edge blur overlays */}
        <div className="absolute inset-y-0 left-0 w-16 sm:w-36 bg-gradient-to-r from-[#12100E] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 sm:w-36 bg-gradient-to-l from-[#12100E] to-transparent z-10 pointer-events-none" />

        {/* Cylinder */}
        <div 
          className="carousel-cylinder-preserve relative transition-transform"
          style={{
            width: `${cardWidth}px`,
            height: `${cardHeight}px`,
            transform: `${isMobile ? "translateY(-10px) " : ""}rotateY(${currentAngle}deg)`,
            transition: isDragging ? "none" : `transform ${isMobile ? "0.45s" : "0.7s"} cubic-bezier(0.15, 0.85, 0.35, 1)`
          }}
        >
          {visibleCards.map(({ product, slotIndex, cardAngle }) => {
            // Calculate absolute angle difference to determine depth fade
            const relativeAngle = (cardAngle + currentAngle) % 360;
            const normalizedRelAngle = ((relativeAngle + 180) % 360) - 180;
            
            // Cards facing closer to front (0 degrees) are fully visible, 
            // cards rotating to the sides (+-90 degrees) fade out
            const angleFromCenter = Math.abs(normalizedRelAngle);
            const opacity = Math.max(0, 1 - angleFromCenter / 85);
            
            // Click should only work when the card is in the front semicircle
            const isClickable = angleFromCenter < 50;
            const shouldPrioritizeImage = angleFromCenter < 28;
            const shouldLoadImageSoon = angleFromCenter < 72;
            const carouselImageSrc = getCarouselImageUrl(product.imageUrl, 768);
            const carouselImageSrcSet = getCarouselImageSrcSet(product.imageUrl);

            return (
              <div
                key={`${product.id}-${slotIndex}`}
                className="carousel-item-preserve absolute left-0 top-0 transition-opacity duration-300"
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  transform: `rotateY(${cardAngle}deg) translateZ(${radius}px)`,
                  opacity: opacity,
                  pointerEvents: isClickable ? "auto" : "none"
                }}
              >
                <div 
                  className="w-full h-full cursor-pointer group/card"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isClickable) onSelect(product);
                  }}
                >
                  {/* Card Outer */}
                  <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-stone-800/80 shadow-[0_12px_24px_rgba(0,0,0,0.5)] sm:shadow-[0_15px_35px_rgba(0,0,0,0.6)] sm:group-hover/card:border-[#e0ff4f] sm:group-hover/card:shadow-[0_0_40px_rgba(224,255,79,0.30)] transition-all duration-300 sm:duration-500 relative flex flex-col bg-stone-900">
                    
                    {/* Image Box */}
                    <div className="relative w-full h-[68%] sm:h-[70%] shrink-0 overflow-hidden border-b border-stone-800">
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 to-transparent z-10 pointer-events-none" />
                      <div className="absolute inset-0 bg-[#e0ff4f]/8 mix-blend-multiply pointer-events-none" />
                      <img 
                        src={carouselImageSrc}
                        srcSet={carouselImageSrcSet}
                        sizes="(max-width: 640px) 176px, (max-width: 1024px) 228px, 306px"
                        alt={product.title} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 sm:duration-700 sm:group-hover/card:scale-105"
                        draggable={false}
                        decoding="async"
                        loading={shouldLoadImageSoon ? "eager" : "lazy"}
                        fetchPriority={shouldPrioritizeImage ? "high" : "low"}
                        onError={(event) => {
                          const image = event.currentTarget;
                          if (image.dataset.fallbackApplied === "true") return;
                          image.dataset.fallbackApplied = "true";
                          image.removeAttribute("srcset");
                          image.src = product.imageUrl;
                        }}
                      />
                      {/* Category Badge */}
                      <span className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-stone-300 font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border border-white/10 z-20">
                        {product.category}
                      </span>
                    </div>

                    {/* Metadata Box containing Negotiate Button */}
                    <div className="w-full h-[32%] sm:h-[30%] shrink-0 p-2 sm:p-3 flex items-center justify-center bg-gradient-to-b from-stone-900 to-stone-950">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(product);
                        }}
                        className="w-full min-h-10 sm:min-h-0 py-2 sm:py-2.5 bg-[#e0ff4f] hover:bg-[#c8eb2c] text-[#12100E] font-mono text-[10px] uppercase font-black rounded-lg transition-all border border-[#FAF6EE]/15 shadow-md flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Negotiate</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edge controls leave the center clear for the products */}
      <div className="pointer-events-none absolute inset-x-0 top-[52%] z-30 flex -translate-y-1/2 items-center justify-between px-2 sm:px-5">
        <button
          onClick={handlePrev}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#FAF6EE]/10 bg-stone-950/70 text-stone-400 shadow-lg backdrop-blur-md transition-all hover:-translate-x-0.5 hover:border-[#e0ff4f]/45 hover:text-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#e0ff4f]/60 cursor-pointer"
          title="Previous Item"
          aria-label="Previous item"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={handleNext}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#FAF6EE]/10 bg-stone-950/70 text-stone-400 shadow-lg backdrop-blur-md transition-all hover:translate-x-0.5 hover:border-[#e0ff4f]/45 hover:text-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#e0ff4f]/60 cursor-pointer"
          title="Next Item"
          aria-label="Next item"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-30 sm:bottom-4 sm:right-6">
        <div className="-rotate-2 border border-[#e0ff4f]/25 bg-[#12100E]/75 px-3 py-2 text-right shadow-xl backdrop-blur-md">
          <div className="font-mono text-[8px] font-black uppercase tracking-[0.24em] text-stone-500">
            Item
          </div>
          <div className="font-mono text-sm font-black tracking-widest text-[#FAF6EE]">
            <span className="text-[#e0ff4f]">{(normalizedActiveIndex + 1).toString().padStart(2, "0")}</span>
            <span className="mx-1 text-stone-600">/</span>
            <span>{totalProducts.toString().padStart(2, "0")}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
