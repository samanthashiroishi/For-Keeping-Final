/* ---------- MEMORY ARCHIVE DATA ---------- */

// Each memory is stored as an object inside the memories array.
// Locations include coordinates so the map can place each memory.

window.memories = [

  {
    id: 1,
    title: "Sunset at the Arroyo",
    date: "2026-03-20",
    description: "",
    tags: ["comfort"],
    location: {
      name: "Arroyo Seco Gorge",
      displayName: "near La Loma Road and California Avenue, Pasadena, California",
      lat: 34.1351,
      lng: -118.16269
    },
    media: [
      {
        type: "image",
        src: "img/sunset.jpeg"
      }
    ]
  },

  {
    id: 2,
    title: "Fluffy McCloud's Banana Split",
    date: "2026-08-10",
    description: "",
    tags: ["comfort", "savor"],
    location: {
      name: "Fluffy McCloud's",
      displayName: "1814 W Sunset Blvd, Los Angeles, CA 90026",
      query: "1814 W Sunset Blvd, Los Angeles, CA 90026",
      lat: null,
      lng: null
    },
    media: [
      {
        type: "image",
        src: "img/bananaSplit.jpeg"
      }
    ]
  },

  {
    id: 3,
    title: "Home-cooked Pasta Dinner",
    date: "2026-10-03",
    description: "",
    tags: ["comfort", "savor"],
    // The public map label is intentionally general and does not reveal the home address.
    location: {
      name: "East Village",
      displayName: "East Village, New York",
      lat: 40.7265,
      lng: -73.9835
    },
    media: [
      {
        type: "image",
        src: "img/dinnerTable.jpg"
      }
    ]
  }

];