import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getColor } from "../lib/colors";

export default function Legend({ title = "Kasus" }) {
  const map = useMap();

  useEffect(() => {
    const legendControl = L.control({ position: "bottomright" });

    legendControl.onAdd = function createLegendElement() {
      const containerElement = L.DomUtil.create("div", "legend-control");

      const legendItems = [
        { label: "0", color: getColor(0) },
        { label: "1 – 2", color: getColor(1) },
        { label: "3 >", color: getColor(3) },
      ];

      const titleElement = document.createElement("div");
      titleElement.className = "legend-title";
      titleElement.textContent = title;
      containerElement.appendChild(titleElement);

      legendItems.forEach((legendItem) => {
        const itemElement = document.createElement("div");
        itemElement.className = "legend-item";

        const colorSwatch = document.createElement("span");
        colorSwatch.className = "legend-color";
        colorSwatch.style.background = legendItem.color;

        const labelElement = document.createElement("span");
        labelElement.className = "legend-label";
        labelElement.textContent = legendItem.label;

        itemElement.appendChild(colorSwatch);
        itemElement.appendChild(labelElement);
        containerElement.appendChild(itemElement);
      });

      return containerElement;
    };

    legendControl.addTo(map);

    return () => {
      legendControl.remove();
    };
  }, [map, title]);

  return null;
}
