import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import "leaflet-control-geocoder";

// Fix Leaflet marker icons in Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export default function SearchControl() {
  const map = useMap();

  useEffect(() => {
    const geocoderControl = L.Control.geocoder({
      defaultMarkGeocode: false,
      position: "topleft",
      placeholder: "Cari lokasi...",
      errorMessage: "Lokasi tidak ditemukan.",
      geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
          viewbox: "116.75,-1.35,116.95,-1.18",
          bounded: 0,
        },
      }),
    })
      .on("markgeocode", function handleGeocodeMark(geocodeEvent) {
        const { center, name } = geocodeEvent.geocode;

        map.flyTo(center, 17, { duration: 1.5 });

        const locationMarker = L.marker(center)
          .addTo(map)
          .bindPopup(`<strong>${name}</strong>`)
          .openPopup();

        setTimeout(() => {
          map.removeLayer(locationMarker);
        }, 30000);
      })
      .addTo(map);

    return () => {
      geocoderControl.remove();
    };
  }, [map]);

  return null;
}
