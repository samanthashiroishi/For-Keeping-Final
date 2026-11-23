/* ---------- LOCATION SEARCH ---------- */

// Uses Photon to find places and stores the selected place with its coordinates.
// A location is saved only after the visitor chooses one of the suggestions.

window.createLocationPicker = function(container, initialLocation = null) {

  const wrapper = document.createElement("div");
  wrapper.className = "location-picker";

  const input = document.createElement("input");
  input.type = "search";
  input.className = "location-search-input";
  input.placeholder = "Search for a place or address";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Search for a location");
  input.setAttribute("aria-autocomplete", "list");

  const suggestions = document.createElement("div");
  suggestions.className = "location-suggestions";
  suggestions.setAttribute("role", "listbox");
  suggestions.hidden = true;

  const controls = document.createElement("div");
  controls.className = "location-picker-controls";

  const selectedLabel = document.createElement("span");
  selectedLabel.className = "selected-location-label";
  selectedLabel.setAttribute("aria-live", "polite");

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "location-clear-button";
  clearButton.textContent = "clear location";

  controls.append(selectedLabel, clearButton);
  wrapper.append(input, suggestions, controls);
  container.appendChild(wrapper);

  let selectedLocation = initialLocation ? { ...initialLocation } : null;
  let debounceTimer = null;
  let activeController = null;

  function updateSelectedDisplay() {
    selectedLabel.textContent = selectedLocation
      ? "selected: " + (selectedLocation.displayName || selectedLocation.name)
      : "no location selected";

    input.value = selectedLocation
      ? (selectedLocation.displayName || selectedLocation.name)
      : "";
  }

  function clearSuggestions() {
    suggestions.innerHTML = "";
    suggestions.hidden = true;
  }

  function getPlaceLabel(properties) {
    const parts = [];

    const street = [properties.housenumber, properties.street]
      .filter(Boolean)
      .join(" ");

    if (street) {
      parts.push(street);
    } else if (properties.name) {
      parts.push(properties.name);
    }

    const locality =
      properties.city ||
      properties.town ||
      properties.village ||
      properties.suburb;

    if (locality && !parts.includes(locality)) {
      parts.push(locality);
    }

    if (properties.state) {
      parts.push(properties.state);
    }

    if (properties.country) {
      parts.push(properties.country);
    }

    return parts.join(", ") || properties.name || "Unnamed location";
  }

  function choosePlace(feature) {
    const properties = feature.properties || {};
    const coordinates = feature.geometry && feature.geometry.coordinates;

    if (!coordinates || coordinates.length < 2) {
      return;
    }

    const displayName = getPlaceLabel(properties);

    selectedLocation = {
      name: properties.name || displayName,
      displayName: displayName,
      lat: Number(coordinates[1]),
      lng: Number(coordinates[0]),
      query: input.value.trim()
    };

    updateSelectedDisplay();
    clearSuggestions();
  }

  async function searchPlaces(query) {
    if (activeController) {
      activeController.abort();
    }

    activeController = new AbortController();

    try {
      const url =
        "https://photon.komoot.io/api/?q=" +
        encodeURIComponent(query) +
        "&limit=5";

      const response = await fetch(url, {
        signal: activeController.signal
      });

      if (!response.ok) {
        throw new Error("Location search failed.");
      }

      const data = await response.json();
      clearSuggestions();

      (data.features || []).forEach(function(feature) {
        const option = document.createElement("button");

        option.type = "button";
        option.className = "location-suggestion";
        option.setAttribute("role", "option");
        option.textContent = getPlaceLabel(feature.properties || {});

        option.addEventListener("click", function() {
          choosePlace(feature);
        });

        suggestions.appendChild(option);
      });

      if (suggestions.childElementCount) {
        suggestions.hidden = false;
      }

    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Location search error:", error);
      }
    }
  }

  input.addEventListener("input", function() {
    selectedLocation = null;
    selectedLabel.textContent = "choose a result to save a location";

    clearSuggestions();

    const query = input.value.trim();

    window.clearTimeout(debounceTimer);

    if (query.length < 3) {
      return;
    }

    debounceTimer = window.setTimeout(function() {
      searchPlaces(query);
    }, 300);
  });

  input.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      clearSuggestions();
    }
  });

  clearButton.addEventListener("click", function() {
    selectedLocation = null;
    input.value = "";
    selectedLabel.textContent = "no location selected";
    clearSuggestions();
  });

  document.addEventListener("click", function(event) {
    if (!wrapper.contains(event.target)) {
      clearSuggestions();
    }
  });

  updateSelectedDisplay();

  return {
    getValue: function() {
      return selectedLocation ? { ...selectedLocation } : null;
    },

    setValue: function(location) {
      selectedLocation = location ? { ...location } : null;
      updateSelectedDisplay();
      clearSuggestions();
    }
  };

};