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


  /* ---------- GET MEMORY THUMBNAIL ---------- */

  async function getThumbnail(memory) {

    const media = memory.media || [];

    const image = media.find(function(item) {
      return item.type === "image" && item.src;
    });

    if (image) {
      if (image.src.startsWith("data:")) {
        return image.src;
      }

      if (image.src.startsWith("blob:")) {
        return image.src;
      }

      return image.src;
    }

    // If the memory uses uploaded media stored in IndexedDB,
    // retrieve the first available image.
    for (const item of media) {
      if (item.type === "image" && item.id) {
        try {
          const storedMedia = await window.memoryStorage.getMedia(item.id);

          if (storedMedia) {
            return URL.createObjectURL(storedMedia);
          }
        } catch (error) {
          console.error("Could not load memory thumbnail:", error);
        }
      }
    }

    return null;
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

    const thumbnail = await getThumbnail(memory);

    let markerIcon;

    if (thumbnail) {
      markerIcon = L.divIcon({
        className: "memory-thumbnail-marker",
        html: `
          <div class="memory-thumbnail-frame">
            <img src="${thumbnail}" alt="" />
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
        popupAnchor: [0, -28]
      });

    } else {
      markerIcon = L.divIcon({
        className: "memory-thumbnail-marker",
        html: `
          <div class="memory-thumbnail-fallback"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    }

    const marker = L.marker(coordinates, {
      icon: markerIcon
    }).addTo(map);

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