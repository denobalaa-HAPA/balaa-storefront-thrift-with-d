import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { MapPin, Navigation, Locate, Route, Clock, Compass, Car, RefreshCw } from "lucide-react";

const STORE_COORDS: [number, number] = [-1.2941, 36.7322]; // Dagoretti Kabiria, Nairobi

const NAIROBI_PRESETS = [
  { name: "Nairobi CBD (City Center)", coords: [-1.2833, 36.8219] },
  { name: "Kilimani (Ngong Road)", coords: [-1.2912, 36.7865] },
  { name: "Westlands (Sarit Center)", coords: [-1.2638, 36.8020] },
  { name: "Karen (Hub Mall)", coords: [-1.3200, 36.7135] },
  { name: "Kawangware (Naivasha Road)", coords: [-1.2785, 36.7532] }
];

export default function StoreDirections() {
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [startName, setStartName] = useState<string>("");
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeDetails, setRouteDetails] = useState<{
    distance: number; // in km
    duration: number; // in mins
    summary: string;
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: STORE_COORDS,
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    const storeIcon = L.divIcon({
      html: `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#e0ff4f] border-2 border-white shadow-lg text-lg animate-pulse">🏬</div>`,
      className: "",
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker(STORE_COORDS, { icon: storeIcon })
      .bindPopup("<b>Thrift With D</b><br/>Dagoretti Kabiria")
      .addTo(map)
      .openPopup();

    mapRef.current = map;

    // Map Click Listener to pick custom start coordinates
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setStartCoords([lat, lng]);
      setStartName(`Selected Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Fetch Route from OSRM and Draw on Map
  useEffect(() => {
    if (!startCoords || !mapRef.current) return;

    const fetchRoute = async () => {
      setIsLoadingRoute(true);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${STORE_COORDS[1]},${STORE_COORDS[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to compute route");
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const geometry = route.geometry;
          const distanceKm = route.distance / 1000;
          const durationMins = route.duration / 60;
          const summaryName = route.name || "Main Highway";

          setRouteDetails({
            distance: Number(distanceKm.toFixed(1)),
            duration: Math.round(durationMins),
            summary: summaryName
          });

          // Draw Polyline
          if (routePolylineRef.current) {
            routePolylineRef.current.remove();
          }

          const latLngs = geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
          const polyline = L.polyline(latLngs, {
            color: "#e0ff4f",
            weight: 5,
            opacity: 0.8,
            dashArray: "2, 8",
            lineCap: "round",
            lineJoin: "round"
          }).addTo(mapRef.current);

          routePolylineRef.current = polyline;

          // Place or Move Start Marker
          if (startMarkerRef.current) {
            startMarkerRef.current.setLatLng(startCoords);
          } else {
            const startIcon = L.divIcon({
              html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-lg text-sm">🚗</div>`,
              className: "",
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });
            const marker = L.marker(startCoords, { icon: startIcon }).addTo(mapRef.current);
            startMarkerRef.current = marker;
          }

          // Fit bounds
          const bounds = L.latLngBounds([startCoords, STORE_COORDS]);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchRoute();
  }, [startCoords]);

  // GPS Location Trigger
  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLoadingRoute(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setStartCoords([latitude, longitude]);
        setStartName("Your Current GPS Location");
      },
      (error) => {
        console.error("GPS error:", error);
        alert("Failed to get location. Please select a starting point on the map or use presets.");
        setIsLoadingRoute(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handlePresetSelect = (coords: number[], name: string) => {
    setStartCoords([coords[0], coords[1]]);
    setStartName(name);
  };

  const clearRoute = () => {
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    setStartCoords(null);
    setStartName("");
    setRouteDetails(null);
    if (mapRef.current) {
      mapRef.current.setView(STORE_COORDS, 14);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col lg:flex-row gap-6 flex-grow justify-center relative z-20">
      {/* Physical Directions Map Container */}
      <div className="w-full lg:w-3/5 relative">
        <div 
          ref={mapContainerRef} 
          className="w-full h-80 lg:h-[430px] rounded-3xl border-3 border-stone-850 shadow-2xl z-10"
        />
        {isLoadingRoute && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-3xl flex items-center justify-center z-25">
            <div className="bg-stone-900/90 border border-stone-800 px-4 py-3 rounded-2xl flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-[#e0ff4f] animate-spin" />
              <span className="font-mono text-xs uppercase tracking-wider text-stone-300">Computing route...</span>
            </div>
          </div>
        )}
      </div>

      {/* Control Box & Detail panel */}
      <div className="w-full lg:w-2/5 flex flex-col justify-between glass-panel border border-[#e0ff4f]/20 bg-stone-900/40 rounded-3xl p-5 shadow-2xl">
        <div className="space-y-4">
          <div>
            <span className="text-[9px] font-mono uppercase text-[#e0ff4f] tracking-widest block mb-0.5">
              Interactive GPS Router
            </span>
            <h3 className="font-sans font-black text-lg uppercase tracking-tight mb-2.5 flex items-center gap-1.5 text-[#FAF6EE]">
              <Compass className="w-5 h-5 text-[#e0ff4f]" />
              <span>Get Directions to Store</span>
            </h3>
            <p className="font-serif text-[11px] text-stone-400 leading-relaxed mb-3">
              We are located in <b>Dagoretti Kabiria, Nairobi</b>. Click on the map to set a custom starting point, or use our controls below to route.
            </p>
          </div>

          {/* Route Config Inputs */}
          <div className="space-y-2.5">
            <button
              onClick={handleGPSLocation}
              className="w-full py-2.5 bg-[#e0ff4f]/15 hover:bg-[#e0ff4f] text-[#e0ff4f] hover:text-[#12100E] font-mono text-[10px] uppercase font-black rounded-xl transition-all border border-[#e0ff4f]/35 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <Locate className="w-3.5 h-3.5" />
              <span>Use Current GPS Location</span>
            </button>

            {/* Presets List */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono uppercase text-stone-500 tracking-wider font-bold">
                Select Starting Preset:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {NAIROBI_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetSelect(preset.coords, preset.name)}
                    className="px-2.5 py-1.5 bg-stone-950/60 hover:bg-[#e0ff4f]/10 text-stone-400 hover:text-[#FAF6EE] border border-stone-850 hover:border-[#e0ff4f]/30 rounded-lg text-[9px] font-mono transition-all cursor-pointer"
                  >
                    {preset.name.split(" (")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Route Details Panel */}
          {routeDetails && (
            <div className="p-3.5 bg-stone-950/50 border border-stone-850 rounded-2xl space-y-2.5 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-stone-850">
                <span className="text-[9px] font-mono uppercase text-stone-500 font-black">Route Output:</span>
                <button 
                  onClick={clearRoute}
                  className="text-[8px] font-mono uppercase text-red-400 hover:text-red-300 font-bold border border-red-500/20 hover:border-red-500/40 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                >
                  Clear Route
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-850 flex items-center gap-2">
                  <Route className="w-4 h-4 text-[#e0ff4f]" />
                  <div>
                    <span className="text-[8px] text-stone-500 block uppercase">Distance</span>
                    <span className="text-[#FAF6EE] font-bold block">{routeDetails.distance} km</span>
                  </div>
                </div>
                <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-850 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <div>
                    <span className="text-[8px] text-stone-500 block uppercase">Est. Drive Time</span>
                    <span className="text-[#FAF6EE] font-bold block">{routeDetails.duration} mins</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-stone-400 leading-relaxed font-serif bg-stone-900/30 p-2 rounded-lg border border-stone-850/40">
                🚗 Route calculated via <b>{routeDetails.summary}</b>. Driving west from {startName}.
              </div>
            </div>
          )}
        </div>

        {/* Address Info Footer */}
        <div className="mt-4 pt-4 border-t border-dashed border-stone-850 text-[10px] space-y-2 text-stone-300 font-sans">
          <div className="flex gap-2 items-start">
            <MapPin className="w-3.5 h-3.5 text-[#e0ff4f] shrink-0 mt-0.5" />
            <p>
              <b>Address:</b> Dagoretti Kabiria, Nairobi, Kenya
            </p>
          </div>
          <div className="flex gap-2 items-start text-stone-400 font-serif leading-snug">
            <Car className="w-3.5 h-3.5 text-[#e0ff4f] shrink-0 mt-0.5" />
            <p className="text-[9px]">
              <b>Drive Info:</b> Head towards Kabiria Road from Naivasha Road in Dagoretti, and look for our physical sorting depot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
