'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357]; // Cairo — used only as the map's initial view, never as a guess at the customer's location.

const PIN_SVG = `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#d6421d"/>
  <circle cx="16" cy="16" r="6" fill="#fff"/>
</svg>`;

type Mode = 'choose' | 'requesting' | 'map' | 'manual' | 'confirmed';

type Coords = { lat: number; lng: number };

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.display_name === 'string' ? data.display_name : null;
  } catch {
    return null;
  }
}

export function DeliveryLocationPicker() {
  const [mode, setMode] = useState<Mode>('choose');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);

  async function placeMarker(lat: number, lng: number, recenter: boolean) {
    setCoords({ lat, lng });
    setAddress(null);
    setGeocoding(true);

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      if (recenter) mapRef.current.setView([lat, lng], 16);
    }

    const result = await reverseGeocode(lat, lng);
    setAddress(result);
    setGeocoding(false);
  }

  // Initializes the Leaflet map once, whenever we enter 'map' mode. Never
  // runs on load — only after the customer clicks a location action.
  useEffect(() => {
    if (mode !== 'map' || !mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !mapContainerRef.current) return;

      const start = coords ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
      const map = L.map(mapContainerRef.current).setView([start.lat, start.lng], coords ? 16 : 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({ className: '', html: PIN_SVG, iconSize: [32, 42], iconAnchor: [16, 42] });
      const marker = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        placeMarker(pos.lat, pos.lng, false);
      });
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        placeMarker(e.latlng.lat, e.latlng.lng, false);
      });

      mapRef.current = map;
      markerRef.current = marker;

      if (coords) {
        void reverseGeocode(coords.lat, coords.lng).then((result) => {
          if (!cancelled) {
            setAddress(result);
            setGeocoding(false);
          }
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Tears the map instance down whenever we leave 'map' mode, so re-entering
  // it (e.g. after "Change location") builds a fresh one instead of reusing
  // a stale, already-removed Leaflet instance.
  useEffect(() => {
    if (mode !== 'map' && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
  }, [mode]);

  function useCurrentLocation() {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser does not support location detection.');
      return;
    }
    setMode('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMode('map');
        void placeMarker(position.coords.latitude, position.coords.longitude, true);
      },
      () => {
        setLocationError('Unable to detect your location. Please enter your address manually, or select it on the map.');
        setMode('choose');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function selectOnMap() {
    setLocationError(null);
    setMode('map');
  }

  function confirmLocation() {
    if (coords) setMode('confirmed');
  }

  function changeLocation() {
    setMode('choose');
    setCoords(null);
    setAddress(null);
  }

  return (
    <fieldset style={{ border: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <legend style={{ fontFamily: 'var(--display)', fontSize: 22, marginBottom: 4 }}>Delivery Location</legend>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>
        Use your location to make delivery easier and more accurate — or enter your address manually below.
      </p>

      {mode === 'choose' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={useCurrentLocation}>
            📍 Use My Current Location
          </button>
          <button type="button" className="btn btn-outline" onClick={selectOnMap}>
            Select Location on Map
          </button>
        </div>
      )}

      {mode === 'requesting' && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Detecting your location…</p>}

      {locationError && mode === 'choose' && <p className="field-error">{locationError}</p>}

      {mode === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: 320, border: '1px solid var(--line)', background: 'var(--cream-2)' }}
          />
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>
            Tap the map or drag the pin to fine-tune your delivery point.
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            {geocoding ? 'Looking up address…' : address ?? (coords ? 'Location selected.' : 'Choose a point on the map.')}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={!coords} onClick={confirmLocation}>
              Confirm This Location
            </button>
            <button type="button" className="btn btn-outline" onClick={changeLocation}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'confirmed' && coords && (
        <div style={{ border: '1px solid var(--line)', padding: 14, background: 'var(--cream-2)' }}>
          <p style={{ fontWeight: 700, margin: 0, color: 'var(--accent)' }}>✓ Delivery location confirmed</p>
          {address && <p style={{ fontSize: 13, margin: '6px 0 0' }}>{address}</p>}
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 10, minHeight: 36, padding: '0 14px' }}
            onClick={changeLocation}
          >
            Change Location
          </button>
          <input type="hidden" name="deliveryLat" value={coords.lat} />
          <input type="hidden" name="deliveryLng" value={coords.lng} />
          <input type="hidden" name="deliveryAddress" value={address ?? ''} />
        </div>
      )}

      {mode === 'choose' && (
        <button
          type="button"
          onClick={() => setMode('manual')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--ink-soft)',
            textDecoration: 'underline',
            fontSize: 12,
            cursor: 'pointer',
            textAlign: 'left',
            width: 'fit-content',
          }}
        >
          Enter address manually instead
        </button>
      )}

      {mode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label htmlFor="shippingArea">Area</label>
            <input id="shippingArea" name="shippingArea" required />
          </div>
          <div className="field">
            <label htmlFor="shippingStreet">Street</label>
            <input id="shippingStreet" name="shippingStreet" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label htmlFor="shippingBuilding">Building</label>
              <input id="shippingBuilding" name="shippingBuilding" required />
            </div>
            <div className="field">
              <label htmlFor="shippingApartment">Apartment (optional)</label>
              <input id="shippingApartment" name="shippingApartment" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMode('choose')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--ink-soft)',
              textDecoration: 'underline',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
              width: 'fit-content',
            }}
          >
            Use my location or the map instead
          </button>
        </div>
      )}
    </fieldset>
  );
}
