/* ---------- MEMORY MAP ---------- */

document.addEventListener("DOMContentLoaded", async function() {

  const mapElement = document.getElementById("memory-map");
  const mapMessage = document.getElementById("map-message");

  const map = L.map(mapElement, {
    scrollWheelZoom: false
  }).setView([39.5, -98.35], 4);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);


  /* ---------- GET SAVED MEMORIES ---------- */

  function getMemories() {
    const overrides = window.memoryStorage.loadOverrides();
    const newMemories = window.memoryStorage.loadNewMemories();
    const allMemories = [...newMemories, ...window.memories];

    return allMemories.map(function(memory) {
      return {
        ...memory,
        ...(overrides[memory.id] || {})
      };
    });
  }


  /* ---------- FORMAT DATE ---------- */

  function formatDate(date) {
    if (!date) {
      return "";
    }

    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }


  /* ---------- FIND LOCATION COORDINATES ---------- */

  async function findCoordinates(location) {

    if (
      Number.isFinite(Number(location.lat)) &&
      Number.isFinite(Number(location.lng)) &&
      location.lat !== null &&
      location.lng !== null
    ) {
      return [Number(location.lat), Number(location.lng)];
    }

    const query =
      location.query ||
      location.displayName ||
      location.name;

    if (!query) {
      return null;
    }

    try {
      const response = await fetch(
        "https://photon.komoot.io/api/?q=" +
        encodeURIComponent(query) +
        "&limit=1"
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const coordinates = data.features?.[0]?.geometry?.coordinates;

      if (!coordinates) {
        return null;
      }

      return [
        Number(coordinates[1]),
        Number(coordinates[0])
      ];

    } catch (error) {
      console.error("Could not locate memory:", error);
      return null;
    }
  }


  /* ---------- CREATE MEMORY MARKERS ---------- */

  const memories = getMemories();
  const bounds = [];
  let markerCount = 0;

  for (const memory of memories) {

    if (!memory.location) {
      continue;
    }

    const coordinates = await findCoordinates(memory.location);

    if (!coordinates) {
      continue;
    }

    const marker = L.marker(coordinates).addTo(map);

    const placeLabel =
      memory.location.displayName ||
      memory.location.name ||
      "";

    const popup = document.createElement("div");
    popup.className = "memory-map-popup";

    const title = document.createElement("strong");
    title.textContent = memory.title;

    const date = document.createElement("span");
    date.textContent = formatDate(memory.date);

    const place = document.createElement("span");
    place.textContent = placeLabel;

    const viewLink = document.createElement("a");
    viewLink.href =
      "index.html#memory=" + encodeURIComponent(memory.id);
    viewLink.textContent = "view memory";

    popup.append(title, date, place, viewLink);

    marker.bindPopup(popup);

    bounds.push(coordinates);
    markerCount++;

  }


  /* ---------- SET MAP VIEW ---------- */

  if (bounds.length === 1) {
    map.setView(bounds[0], 13);

  } else if (bounds.length > 1) {
    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 13
    });
  }


  /* ---------- UPDATE MAP MESSAGE ---------- */

  mapMessage.textContent = markerCount
    ? markerCount +
      (markerCount === 1
        ? " memory on the map"
        : " memories on the map")
    : "No memories have locations yet.";


  // Correct Leaflet's dimensions after the page has finished laying out.
  window.setTimeout(function() {
    map.invalidateSize();
  }, 100);

});