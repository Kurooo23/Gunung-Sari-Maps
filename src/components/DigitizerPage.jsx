import { useState, useRef, useCallback, useEffect } from "react";
import {
  MapContainer,
  ImageOverlay,
  Polygon,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import mapReference from "../assets/Peta Batas RT_page-0001.jpg";

const imageBounds = [
  [-1.267, 116.835],
  [-1.249, 116.858],
];

function FitMapBounds() {
  const map = useMap();

  useEffect(() => {
    const fitMapToReferenceBounds = () => {
      map.invalidateSize();
      map.fitBounds(imageBounds, { padding: [0, 0], animate: false });
    };

    const animationFrameId = requestAnimationFrame(fitMapToReferenceBounds);
    window.addEventListener("resize", fitMapToReferenceBounds);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", fitMapToReferenceBounds);
    };
  }, [map]);

  return null;
}

function MapClickHandler({ onAddVertex }) {
  useMapEvents({
    click: (mapClickEvent) =>
      onAddVertex([mapClickEvent.latlng.lng, mapClickEvent.latlng.lat]),
    mousemove: (mapMoveEvent) => {
      const coordinateDisplayElement = document.getElementById("coord-display");
      if (coordinateDisplayElement) {
        coordinateDisplayElement.textContent = `${mapMoveEvent.latlng.lat.toFixed(6)}, ${mapMoveEvent.latlng.lng.toFixed(6)}`;
      }
    },
  });
  return null;
}

export default function DigitizerPage() {
  const [rtNumber, setRtNumber] = useState(1);
  const [vertices, setVertices] = useState([]);
  const [completedRTs, setCompletedRTs] = useState({});
  const [overlayOpacity, setOverlayOpacity] = useState(0.6);
  const [exportText, setExportText] = useState("");
  const textareaRef = useRef(null);

  const formattedRTNumber = String(rtNumber).padStart(2, "0");

  const addVertex = useCallback((coordinate) => {
    setVertices((previousVertices) => [...previousVertices, coordinate]);
  }, []);

  const undoVertex = useCallback(() => {
    setVertices((previousVertices) => previousVertices.slice(0, -1));
  }, []);

  const completePolygon = useCallback(() => {
    if (vertices.length < 3) return;
    const closedRingCoordinates = [...vertices, vertices[0]];
    setCompletedRTs((previousCompletedRTs) => ({
      ...previousCompletedRTs,
      [formattedRTNumber]: {
        type: "Feature",
        properties: {
          rt_number: formattedRTNumber,
          stunting_count: 0,
          kelurahan: "Gunung Sari Ulu",
        },
        geometry: { type: "Polygon", coordinates: [closedRingCoordinates] },
      },
    }));
    setVertices([]);
    setRtNumber((previousRTNumber) =>
      previousRTNumber >= 41 ? 1 : previousRTNumber + 1
    );
  }, [vertices, formattedRTNumber]);

  const clearVertices = useCallback(() => setVertices([]), []);

  const editRT = useCallback(
    (targetRTNumber) => {
      const rtKey = String(targetRTNumber).padStart(2, "0");
      const existingFeature = completedRTs[rtKey];
      if (!existingFeature) return;

      setRtNumber(parseInt(targetRTNumber, 10));
      setVertices(existingFeature.geometry.coordinates[0].slice(0, -1));
      setCompletedRTs((previousCompletedRTs) => {
        const nextCompletedRTs = { ...previousCompletedRTs };
        delete nextCompletedRTs[rtKey];
        return nextCompletedRTs;
      });
    },
    [completedRTs]
  );

  const deleteRT = useCallback((targetRTNumber) => {
    const rtKey = String(targetRTNumber).padStart(2, "0");
    setCompletedRTs((previousCompletedRTs) => {
      const nextCompletedRTs = { ...previousCompletedRTs };
      delete nextCompletedRTs[rtKey];
      return nextCompletedRTs;
    });
  }, []);

  const exportGeoJson = useCallback(() => {
    const sortedRTKeys = Object.keys(completedRTs).sort(
      (firstRT, secondRT) => parseInt(firstRT, 10) - parseInt(secondRT, 10)
    );
    const geoJsonFeatureCollection = {
      type: "FeatureCollection",
      features: sortedRTKeys.map((rtKey) => completedRTs[rtKey]),
    };
    const formattedOutput = `const rtGeoJson = ${JSON.stringify(geoJsonFeatureCollection, null, 2)};\n\nexport default rtGeoJson;\n`;
    setExportText(formattedOutput);
  }, [completedRTs]);

  const copyToClipboard = useCallback(() => {
    if (!exportText) exportGeoJson();
    navigator.clipboard
      .writeText(exportText || "")
      .then(() => alert("Copied!"));
  }, [exportText, exportGeoJson]);

  const completedCount = Object.keys(completedRTs).length;
  const completedList = Object.keys(completedRTs).sort(
    (firstRT, secondRT) => parseInt(firstRT, 10) - parseInt(secondRT, 10)
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (keyboardEvent) => {
      if (
        keyboardEvent.key === "Enter" &&
        !keyboardEvent.target.closest("textarea, input")
      ) {
        keyboardEvent.preventDefault();
        completePolygon();
      }
      if (keyboardEvent.key === "z" && keyboardEvent.ctrlKey) {
        keyboardEvent.preventDefault();
        undoVertex();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completePolygon, undoVertex]);

  return (
    <div style={{ display: "flex", flex: 1, width: "100%", overflow: "hidden" }}>
      {/* Panel */}
      <div
        style={{
          width: 340,
          background: "#1a1a2e",
          color: "#eee",
          padding: 16,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: "1rem", color: "#7fdbca", margin: 0 }}>
          RT Digitizer — Gunung Sari Ulu
        </h2>
        <p style={{ fontSize: "0.8rem", color: "#888", lineHeight: 1.4, margin: 0 }}>
          Klik di peta untuk menambah vertex. Trace batas RT sesuai garis putih di peta referensi.
          Enter = selesai, Ctrl+Z = undo.
        </p>

        {/* RT Number */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", minWidth: 50 }}>RT #:</span>
          <input
            type="number"
            min={1}
            max={41}
            value={rtNumber}
            onChange={(event) =>
              setRtNumber(
                Math.max(1, Math.min(41, parseInt(event.target.value, 10) || 1))
              )
            }
            style={{
              width: 70,
              background: "#16213e",
              color: "#eee",
              border: "1px solid #333",
              padding: "6px 10px",
              borderRadius: 4,
            }}
          />
          <button
            onClick={() =>
              setRtNumber((previousRTNumber) =>
                previousRTNumber <= 1 ? 41 : previousRTNumber - 1
              )
            }
            style={primaryButtonStyle}
          >
            ◄
          </button>
          <button
            onClick={() =>
              setRtNumber((previousRTNumber) =>
                previousRTNumber >= 41 ? 1 : previousRTNumber + 1
              )
            }
            style={primaryButtonStyle}
          >
            ►
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={completePolygon}
            disabled={vertices.length < 3}
            style={{
              ...primaryButtonStyle,
              background: vertices.length >= 3 ? "#18aa3b" : "#444",
            }}
          >
            Selesai ({vertices.length} vtx)
          </button>
          <button onClick={undoVertex} style={primaryButtonStyle}>
            Undo
          </button>
          <button onClick={clearVertices} style={primaryButtonStyle}>
            Clear
          </button>
        </div>

        {/* Opacity */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", minWidth: 60 }}>Opacity:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={overlayOpacity * 100}
            onChange={(event) => setOverlayOpacity(event.target.value / 100)}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: "0.8rem" }}>{Math.round(overlayOpacity * 100)}%</span>
        </div>

        {/* Cursor coords */}
        <div style={{ borderTop: "1px solid #333", paddingTop: 10 }}>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.8rem",
              color: "#7fdbca",
              background: "#16213e",
              padding: 6,
              borderRadius: 4,
            }}
          >
            <span id="coord-display">Hover di peta...</span>
          </div>
        </div>

        {/* Completed list */}
        <div style={{ borderTop: "1px solid #333", paddingTop: 10 }}>
          <h3 style={{ fontSize: "0.9rem", color: "#7fdbca", margin: "0 0 6px 0" }}>
            Selesai: {completedCount}/41
          </h3>
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              fontSize: "0.8rem",
              background: "#16213e",
              borderRadius: 4,
              padding: 8,
            }}
          >
            {completedList.length === 0 ? (
              <span style={{ color: "#666" }}>Belum ada RT.</span>
            ) : (
              completedList.map((rtKey) => (
                <div
                  key={rtKey}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    borderBottom: "1px solid #222",
                    alignItems: "center",
                  }}
                >
                  <span>
                    RT {rtKey} ({completedRTs[rtKey].geometry.coordinates[0].length - 1} vtx)
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => editRT(rtKey)}
                      style={{ ...smallButtonStyle, background: "#0f3460" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteRT(rtKey)}
                      style={{ ...smallButtonStyle, background: "#8b0000" }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Export */}
        <div style={{ borderTop: "1px solid #333", paddingTop: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button
              onClick={exportGeoJson}
              style={{ ...primaryButtonStyle, background: "#e94560" }}
            >
              Export
            </button>
            <button onClick={copyToClipboard} style={primaryButtonStyle}>
              Copy
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={exportText}
            readOnly
            placeholder="Klik Export..."
            style={{
              width: "100%",
              height: 140,
              background: "#16213e",
              color: "#7fdbca",
              border: "1px solid #333",
              borderRadius: 4,
              padding: 8,
              fontFamily: "monospace",
              fontSize: "0.7rem",
              resize: "vertical",
            }}
          />
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[-1.2569, 116.8468]}
        zoom={17}
        style={{ flex: 1, minWidth: 0, minHeight: 0, zIndex: 1 }}
        zoomControl={true}
      >
        <ImageOverlay
          url={mapReference}
          bounds={imageBounds}
          opacity={overlayOpacity}
          zIndex={0}
        />
        <MapClickHandler onAddVertex={addVertex} />

        {/* Completed polygons */}
        {completedList.map((rtKey) => {
          const ringCoordinates = completedRTs[rtKey].geometry.coordinates[0].slice(0, -1);
          const polygonPositions = ringCoordinates.map(([longitude, latitude]) => [
            latitude,
            longitude,
          ]);
          return (
            <Polygon
              key={rtKey}
              positions={polygonPositions}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: "#18aa3b",
                fillOpacity: 0.35,
              }}
            >
              <Tooltip permanent direction="center" className="rt-label">
                {rtKey}
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Current vertices */}
        {vertices.map(([longitude, latitude], vertexIndex) => (
          <CircleMarker
            key={vertexIndex}
            center={[latitude, longitude]}
            radius={5}
            pathOptions={{
              color: "#fff",
              fillColor: "#e94560",
              weight: 1,
              fillOpacity: 1,
            }}
          />
        ))}

        {/* Current polyline */}
        {vertices.length > 1 && (
          <Polyline
            positions={vertices.map(([longitude, latitude]) => [latitude, longitude])}
            pathOptions={{ color: "#e94560", weight: 2, dashArray: "6,4" }}
          />
        )}

        <FitMapBounds />
      </MapContainer>
    </div>
  );
}

const primaryButtonStyle = {
  background: "#0f3460",
  color: "#eee",
  border: "none",
  padding: "8px 14px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.85rem",
};

const smallButtonStyle = {
  color: "#eee",
  border: "none",
  padding: "2px 8px",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: "0.75rem",
};
