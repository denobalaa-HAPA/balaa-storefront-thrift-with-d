import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  isTemp?: boolean; // For burst particles
  life?: number;     // Remaining frames for temp particles
  maxLife?: number;
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isTouchPhone = window.matchMedia("(pointer: coarse) and (max-width: 640px)").matches;
    if (isTouchPhone) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number | undefined;
    let particles: Particle[] = [];
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shouldAnimate = !prefersReducedMotion;

    // Screen-size based particle density
    const getTargetParticleCount = (width: number, height: number) => {
      const area = width * height;
      const isMobile = width < 640;
      if (isMobile) {
        // Very low count on mobile to maximize phone browser rendering performance
        return Math.min(25, Math.max(8, Math.floor(area / 32000)));
      }
      return Math.min(120, Math.max(15, Math.floor(area / 15000)));
    };

    const resizeCanvas = () => {
      if (!canvas) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      // Adjust particle count to new screen dimensions
      const targetCount = getTargetParticleCount(width, height);
      
      // If we need more particles, spawn them
      if (particles.length < targetCount) {
        const toAdd = targetCount - particles.length;
        for (let i = 0; i < toAdd; i++) {
          particles.push(createRandomParticle(width, height));
        }
      } else if (particles.length > targetCount) {
        // Keep permanent particles, discard extra
        particles = particles.filter(p => !p.isTemp).slice(0, targetCount);
      }
    };

    const createRandomParticle = (w: number, h: number): Particle => {
      const baseRadius = Math.random() * 1.5 + 0.8;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, // Even slower drift for better aesthetic
        vy: (Math.random() - 0.5) * 0.3,
        radius: baseRadius,
        baseRadius,
        opacity: Math.random() * 0.4 + 0.1, // Softer glow
      };
    };

    // Initialize
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const initialCount = getTargetParticleCount(width, height);
    for (let i = 0; i < initialCount; i++) {
      particles.push(createRandomParticle(width, height));
    }

    const drawParticles = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        ctx.fillStyle = `rgba(224, 255, 79, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // Interaction Settings
    const mouseRadius = 160; // Slightly smaller influence radius for performance

    // Particle updater & drawer
    const tick = () => {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const mouse = mouseRef.current;

      // Filter out dead temporary particles
      particles = particles.filter((p) => {
        if (p.isTemp && p.life !== undefined) {
          p.life--;
          return p.life > 0;
        }
        return true;
      });

      // Update particles
      particles.forEach((p) => {
        // Mouse interaction (only if mouse is active)
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);

          if (dist < mouseRadius) {
            // Gentle gravitational pull
            const force = (mouseRadius - dist) / mouseRadius;
            const pullStrength = p.isTemp ? 0.03 : 0.015;
            p.vx += (dx / dist) * force * pullStrength;
            p.vy += (dy / dist) * force * pullStrength;
            
            // Slightly enlarge particles near the cursor
            p.radius = p.baseRadius + force * 1.2;
          } else {
            // Return to base size
            p.radius = p.radius * 0.9 + p.baseRadius * 0.1;
          }
        } else {
          p.radius = p.radius * 0.9 + p.baseRadius * 0.1;
        }

        // Apply friction to prevent infinite speed buildup from mouse pulls
        p.vx *= 0.97;
        p.vy *= 0.97;

        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries for permanent particles
        if (!p.isTemp) {
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h;
          if (p.y > h) p.y = 0;
        }
      });

      // Draw Particles (Connection lines logic removed for maximum mobile rendering performance)
      particles.forEach((p) => {
        let opacity = p.opacity;
        
        // Fade out temporary explosion particles as they age
        if (p.isTemp && p.life !== undefined && p.maxLife !== undefined) {
          opacity = (p.life / p.maxLife) * 0.7;
        }

        ctx.fillStyle = `rgba(224, 255, 79, ${opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    // Mouse events tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    // Spawn a burst of particles on click
    const handleMouseClick = (e: MouseEvent) => {
      const clickX = e.clientX;
      const clickY = e.clientY;
      const count = 10; // Number of particles in explosion

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1; // Faster speed for explosions
        const maxLife = Math.floor(Math.random() * 40) + 40; // 40-80 frames of life
        
        particles.push({
          x: clickX,
          y: clickY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 2 + 1,
          baseRadius: 1,
          opacity: 0.8,
          isTemp: true,
          life: maxLife,
          maxLife: maxLife,
        });
      }
    };

    const handleWindowResize = () => {
      resizeCanvas();
      if (!shouldAnimate) drawParticles();
    };

    // Attach listeners
    window.addEventListener("resize", handleWindowResize);
    if (shouldAnimate) {
      window.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseleave", handleMouseLeave);
      window.addEventListener("click", handleMouseClick);
    }

    // Start rendering loop only where it will not compete with touch scrolling.
    if (shouldAnimate) {
      animationFrameId = requestAnimationFrame(tick);
    } else {
      drawParticles();
    }

    // Cleanup
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleWindowResize);
      if (shouldAnimate) {
        window.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseleave", handleMouseLeave);
        window.removeEventListener("click", handleMouseClick);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full opacity-60 sm:block"
    />
  );
}
