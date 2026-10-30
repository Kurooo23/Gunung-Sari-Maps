import { useEffect } from "react";
import { MapContainer, ImageOverlay, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getStyle } from "../lib/colors";
import Legend from "./Legend";

const imageBounds = [
  [-1.267, 116.835],
  [-1.249, 116.858],
];

function FitBounds({ geoJsonData }) {
  const map = useMap();

  useEffect(() => {
    const fitMapToBounds = () => {
      map.invalidateSize();
      map.fitBounds(imageBounds, { padding: [0, 0] });
    };

    fitMapToBounds();
    window.addEventListener("resize", fitMapToBounds);
    return () => window.removeEventListener("resize", fitMapToBounds);
  }, [geoJsonData, map]);

  return null;
}

export default function MapComponent({ geoJsonData, onFeatureClick, diseaseName = "Stunting", mapKey }) {
  const defaultCenter = [-1.2569, 116.8468];
  const defaultZoom = 16;
  const mapReference =
    typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches
      ? "/peta-map-bg-mobile.webp"
      : "/peta-map-bg.webp";

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      className="map-container"
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      dragging={false}
      zoomSnap={0}
      zoomDelta={0.25}
    >
      <ImageOverlay url={mapReference} bounds={imageBounds} opacity={1} zIndex={0} />

      <GeoJSON
        key={mapKey}
        data={geoJsonData}
        style={(feature) => getStyle(feature)}
        onEachFeature={(feature, layer) => {
          const caseCount = Number(
            feature.properties.case_count ?? feature.properties.stunting_count ?? 0
          );

          layer.on({
            mouseover: (mouseEvent) => {
              const targetLayer = mouseEvent.target;
              targetLayer.setStyle({
                weight: 2.5,
                color: "#ffffff",
                dashArray: "",
                fillOpacity: 0.86,
              });
              targetLayer.bringToFront();
            },
            mouseout: () => {
              layer.setStyle(getStyle(feature));
            },
            click: () => {
              if (onFeatureClick) onFeatureClick(feature);
            },
          });

          layer.bindPopup(
            `<div class="rt-popup">
              <h3>RT ${feature.properties.rt_number}</h3>
              <p><strong>Kelurahan:</strong> ${feature.properties.kelurahan}</p>
              <p><strong>${diseaseName}:</strong> ${caseCount}</p>
            </div>`,
            { className: "custom-popup" }
          );

          layer.bindTooltip(`${feature.properties.rt_number}`, {
            permanent: true,
            direction: "center",
            className: "rt-label",
            sticky: false,
          });
        }}
      />

      <FitBounds geoJsonData={geoJsonData} />
      <Legend title={diseaseName} />
    </MapContainer>
  );
}
