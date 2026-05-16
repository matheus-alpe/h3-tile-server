import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  zoom: 11,
  pitch: 0,
  bearing: 0,
  hash: true, // syncs #zoom/lat/lng to URL, restores on refresh
});

map.on("load", () => {
  navigator.geolocation.getCurrentPosition(
    ({ coords }) =>
      map.jumpTo({ center: [coords.longitude, coords.latitude], zoom: 11 }),
    () => {}, // denied or unavailable — keep default center
  );

  // ==================== ADD H3 VECTOR SOURCE ====================
  map.addSource("h3-hexes", {
    type: "vector",
    tiles: ["http://localhost:3000/tiles/{z}/{x}/{y}.mvt"], // ← your tile server
    minzoom: 5,
    maxzoom: 24,
  });

  // ==================== FILL LAYER (colored hexagons) ====================
  map.addLayer({
    id: "h3-fill",
    type: "fill",
    source: "h3-hexes",
    "source-layer": "h3-layer", // Must match the layer name you used in vtpbf
    paint: {
      "fill-color": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        0,
        "#313695",
        11,
        "#4575b4",
        22,
        "#74add1",
        33,
        "#abd9e9",
        44,
        "#e0f3f8",
        55,
        "#fee090",
        66,
        "#fdae61",
        77,
        "#f46d43",
        88,
        "#d73027",
        100,
        "#a50026",
      ],
      "fill-opacity": 0.35,
    },
  });

  // ==================== BORDER LAYER ====================
  map.addLayer({
    id: "h3-border",
    type: "line",
    source: "h3-hexes",
    "source-layer": "h3-layer",
    paint: {
      "line-color": "#1a1a1a",
      "line-width": 1.5,
      "line-opacity": 0.1,
    },
  });

  // Optional: Hover effect
  map.on("mousemove", "h3-fill", (e) => {
    if (e.features && e.features.length > 0) {
      const h3Index = e.features[0].properties.h3;
      console.log("H3 Cell:", h3Index);
      // You can show popup or highlight here
    }
  });

  // Click handler example
  map.on("click", "h3-fill", (e) => {
    if (!e.features?.length) return;
    const props = e.features[0].properties;

    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `
        <strong>H3 Index:</strong> ${props.h3}<br>
        <strong>Value:</strong> ${props.value}
      `,
      )
      .addTo(map);
  });
});
