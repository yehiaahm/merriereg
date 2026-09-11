'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

const PIN_SVG = `<svg width="28" height="37" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#d6421d"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

export function DeliveryLocationMap({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: import('leaflet').Map | undefined;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { dragging: false, scrollWheelZoom: false, zoomControl: true }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({ className: '', html: PIN_SVG, iconSize: [28, 37], iconAnchor: [14, 37] });
      L.marker([lat, lng], { icon }).addTo(map);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: 260, border: '1px solid var(--line)' }} />;
}
