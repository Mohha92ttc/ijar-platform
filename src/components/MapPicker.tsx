import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons under Vite bundling
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type MapPin = { lat: number; lng: number };

const BAGHDAD: MapPin = { lat: 33.3152, lng: 44.3661 };

export default function MapPicker({
  value,
  onChange,
  height = 220,
}: {
  value: MapPin | null;
  onChange: (pin: MapPin) => void;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start = value || BAGHDAD;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: 13,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    if (!value) {
      onChangeRef.current(start);
    }

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChangeRef.current({ lat: p.lat, lng: p.lng });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // Leaflet needs a tick after modal layout
    setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || !markerRef.current || !mapRef.current) return;
    const cur = markerRef.current.getLatLng();
    if (Math.abs(cur.lat - value.lat) < 1e-7 && Math.abs(cur.lng - value.lng) < 1e-7) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.panTo([value.lat, value.lng]);
  }, [value]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(pin);
        if (markerRef.current) markerRef.current.setLatLng([pin.lat, pin.lng]);
        if (mapRef.current) {
          mapRef.current.setView([pin.lat, pin.lng], 15);
        }
      },
      () => alert('تعذر الحصول على موقعك — حرّك الدبوس يدوياً'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="space-y-2" data-testid="map-picker">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">اضغط على الخريطة أو اسحب الدبوس لتحديد موقع التوصيل</p>
        <button
          type="button"
          data-testid="map-use-my-location"
          onClick={useMyLocation}
          className="text-[11px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 shrink-0"
        >
          موقعي الحالي
        </button>
      </div>
      <div
        ref={containerRef}
        style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }}
        className="border border-slate-200"
      />
      {value && (
        <p className="text-[10px] text-slate-400 font-mono" data-testid="map-coords">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
