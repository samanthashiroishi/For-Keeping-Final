document.addEventListener("DOMContentLoaded", function() {

  /* ---------- ELEMENTS ---------- */

  const memoryContainer = document.getElementById("memory-container");
  const filterButtons = document.querySelectorAll(".filter-button");

  const memoryOverlay = document.getElementById("memory-overlay");
  const memoryDetails = document.getElementById("memory-details");
  const closeOverlayButton = document.querySelector(".close-overlay");
  const saveButton = document.getElementById("save-memory-button");

  const addMemoryButton = document.getElementById("add-memory-button");
  const addMemoryOverlay = document.getElementById("add-memory-overlay");
  const closeAddMemoryButton = document.getElementById("close-add-memory");
  const addMemoryForm = document.getElementById("add-memory-form");
  const addMemoryMessage = document.getElementById("add-memory-message");

  // Location pickers for new and existing memories.
  let addLocationPicker = null;
  let editLocationPicker = null;

  // Stores the categories currently selected.
  let selectedFilters = [];

  // Stores the ID of the memory currently open.
  let currentMemoryId = null;

  // Stores temporary URLs for uploaded media.
  const mediaURLCache = new Map();

  // Stores the layout positions of memories.
  const LAYOUT_KEY = "forKeepingMemoryLayout";
  const LAYOUT_IDS_KEY = "forKeepingMemoryLayoutIds";


  /* ---------- LOCATION PICKERS ---------- */

  // Add the location search to the existing add-memory form.
  const mediaLabel = addMemoryForm.querySelector('label[for="new-memory-media"]');

  const addLocationLabel = document.createElement("label");
  addLocationLabel.textContent = "location";
  addLocationLabel.htmlFor = "new-memory-location";

  const addLocationContainer = document.createElement("div");
  addLocationContainer.id = "new-memory-location";

  addMemoryForm.insertBefore(addLocationLabel, mediaLabel);
  addMemoryForm.insertBefore(addLocationContainer, mediaLabel);

  addLocationPicker = window.createLocationPicker(addLocationContainer);


  /* ---------- GET SAVED MEMORIES ---------- */

  function getMemories() {

    const savedOverrides = window.memoryStorage.loadOverrides();
    const newMemories = window.memoryStorage.loadNewMemories();

    // Combine original memories and visitor-created memories.
    const allMemories = [...window.memories, ...newMemories];

    // Apply any saved edits to each memory.
    return allMemories.map(function(memory) {

      const changes = savedOverrides[memory.id] || {};

      return {
        ...memory,
        ...changes
      };

    });

  }


  /* ---------- DATE FORMATTING ---------- */

  function formatDate(date) {

    const dateObject = new Date(date + "T12:00:00");

    return dateObject.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

  }


  /* ---------- LOAD AND SAVE LAYOUT ---------- */

  function loadLayout() {

    const savedLayout = localStorage.getItem(LAYOUT_KEY);

    return savedLayout ? JSON.parse(savedLayout) : {};

  }


  function saveLayout(layout) {

    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify(layout)
    );

  }


  /* ---------- RANDOM NUMBER ---------- */

  function randomBetween(min, max) {

    return Math.random() * (max - min) + min;

  }


  /* ---------- CHECK FOR OVERLAPPING MEMORIES ---------- */

  function overlaps(rectangle, existingRectangles, gap) {

    return existingRectangles.some(function(existing) {

      return !(
        rectangle.right + gap <= existing.left ||
        rectangle.left >= existing.right + gap ||
        rectangle.bottom + gap <= existing.top ||
        rectangle.top >= existing.bottom + gap
      );

    });

  }


  /* ---------- MEMORY LAYOUT ---------- */

  function arrangeMemories(forceReflow = false) {

    const memoryElements = Array.from(
      memoryContainer.querySelectorAll(".memory")
    );

    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    // Mobile uses the regular vertical layout.
    if (isMobile) {

      memoryElements.forEach(function(element) {

        element.style.position = "";
        element.style.left = "";
        element.style.top = "";
        element.style.width = "";

      });

      memoryContainer.style.minHeight = "";
      return;

    }

    const containerWidth = memoryContainer.clientWidth;
    const layout = loadLayout();

    // When the collection changes, calculate positions for every memory again.
    // Otherwise, keep the previously saved arrangement.
    if (!forceReflow) {

      let allPositionsExist = memoryElements.every(function(element) {
        return Boolean(layout[element.dataset.id]);
      });

      if (allPositionsExist) {

        let occupied = [];

        memoryElements.forEach(function(element) {

          const savedPosition = layout[element.dataset.id];

          element.style.position = "absolute";
          element.style.left = savedPosition.left + "%";
          element.style.top = savedPosition.top + "px";
          element.style.width = savedPosition.width + "%";

          const left = containerWidth * savedPosition.left / 100;
          const width = containerWidth * savedPosition.width / 100;
          const height = element.offsetHeight;

          occupied.push({
            left: left,
            top: savedPosition.top,
            right: left + width,
            bottom: savedPosition.top + height
          });

        });

        const archiveBottom = occupied.reduce(function(max, rectangle) {
          return Math.max(max, rectangle.bottom);
        }, 0);

        memoryContainer.style.minHeight =
          Math.max(650, archiveBottom + 150) + "px";

        localStorage.setItem(
          LAYOUT_IDS_KEY,
          JSON.stringify(getMemories().map(function(memory) {
            return String(memory.id);
          }))
        );

        return;

      }

    }

    // Place newly created memories first so they enter near the top.
    // The remaining memories are then fitted around them.
    const orderedElements = memoryElements.slice().sort(function(a, b) {

      const aIsNew = String(a.dataset.id).startsWith("new-");
      const bIsNew = String(b.dataset.id).startsWith("new-");

      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return 0;

    });

    const occupied = [];

    // As the archive grows, reduce the gap between memories slightly.
    // This makes a larger collection feel more densely arranged.
    const gap = Math.max(12, 35 - memoryElements.length * 0.7);

    orderedElements.forEach(function(element) {

      const memoryId = element.dataset.id;

      // Give each memory a varied thumbnail width whenever the layout is rebuilt.
      const width = randomBetween(12, 21);

      element.style.position = "absolute";
      element.style.width = width + "%";

      // Measure the thumbnail and caption after setting its width.
      const elementHeight = element.offsetHeight;
      const elementWidth = containerWidth * width / 100;

      const currentBottom = occupied.reduce(function(max, rectangle) {
        return Math.max(max, rectangle.bottom);
      }, 20);

      let chosenPosition = null;

      // Try many positions, including spaces between memories already placed.
      for (let attempt = 0; attempt < 800; attempt++) {

        const leftPercent = randomBetween(3, 97 - width);

        // The search area expands as the archive gets longer.
        const top = randomBetween(
          20,
          Math.max(120, currentBottom + 220)
        );

        const left = containerWidth * leftPercent / 100;

        const rectangle = {
          left: left,
          top: top,
          right: left + elementWidth,
          bottom: top + elementHeight
        };

        if (!overlaps(rectangle, occupied, gap)) {

          chosenPosition = {
            left: leftPercent,
            top: top,
            width: width
          };

          occupied.push(rectangle);
          break;

        }

      }

      // If the available spaces are full, continue below the current collection.
      if (!chosenPosition) {

        const leftPercent = randomBetween(3, 97 - width);
        const top = currentBottom + gap + 20;
        const left = containerWidth * leftPercent / 100;

        chosenPosition = {
          left: leftPercent,
          top: top,
          width: width
        };

        occupied.push({
          left: left,
          top: top,
          right: left + elementWidth,
          bottom: top + elementHeight
        });

      }

      // Apply and save the new position.
      element.style.left = chosenPosition.left + "%";
      element.style.top = chosenPosition.top + "px";

      layout[memoryId] = {
        left: chosenPosition.left,
        top: chosenPosition.top,
        width: chosenPosition.width,
        height: elementHeight
      };

    });

    // Save the complete new arrangement and the IDs in the full collection.
    saveLayout(layout);

    localStorage.setItem(
      LAYOUT_IDS_KEY,
      JSON.stringify(getMemories().map(function(memory) {
        return String(memory.id);
      }))
    );

    const archiveBottom = occupied.reduce(function(max, rectangle) {
      return Math.max(max, rectangle.bottom);
    }, 0);

    memoryContainer.style.minHeight =
      Math.max(650, archiveBottom + 150) + "px";

  }


  /* ---------- LOAD MEDIA SOURCE ---------- */

  async function resolveMediaSource(media) {

    // Original photos and videos use their existing file paths.
    if (media.src) {
      return media.src;
    }

    // Uploaded media is retrieved from IndexedDB.
    if (media.storageKey) {

      // Reuse an existing temporary URL if one exists.
      if (mediaURLCache.has(media.storageKey)) {
        return mediaURLCache.get(media.storageKey);
      }

      const file = await window.memoryStorage.getMedia(media.storageKey);

      if (!file) {
        throw new Error("Media file could not be found.");
      }

      const source = URL.createObjectURL(file);

      mediaURLCache.set(media.storageKey, source);

      return source;

    }

    throw new Error("No media source was found.");

  }


  /* ---------- DISPLAY MEMORIES ---------- */

  async function displayMemories(memoryList, reflowLayout = false) {

    memoryContainer.innerHTML = "";

    const loadingTasks = [];

    memoryList.forEach(function(memory) {

      // Create the memory container.
      const memoryElement = document.createElement("figure");
      memoryElement.classList.add("memory");
      memoryElement.dataset.id = memory.id;

      const firstMedia = memory.media[0];

      let thumbnail;

      // Create a video thumbnail.
      if (firstMedia.type === "video") {

        thumbnail = document.createElement("video");

        thumbnail.autoplay = true;
        thumbnail.muted = true;
        thumbnail.loop = true;
        thumbnail.playsInline = true;
        thumbnail.controls = false;
        thumbnail.preload = "auto";

      } else {

        // Create an image thumbnail.
        thumbnail = document.createElement("img");
        thumbnail.alt = memory.title;

      }

      thumbnail.classList.add("memory-thumbnail");


      // Create the caption.
      const caption = document.createElement("figcaption");
      caption.classList.add("memory-caption");

      // Add the title.
      const title = document.createElement("span");
      title.classList.add("memory-title");
      title.textContent = memory.title;

      // Add the date.
      const date = document.createElement("span");
      date.classList.add("memory-date");
      date.textContent = formatDate(memory.date);

      caption.appendChild(title);
      caption.appendChild(date);

      memoryElement.appendChild(thumbnail);
      memoryElement.appendChild(caption);

      memoryContainer.appendChild(memoryElement);


      // Load the media before arranging the archive.
      const loadingTask = resolveMediaSource(firstMedia)
        .then(function(source) {

          return new Promise(function(resolve) {

            if (firstMedia.type === "video") {

              thumbnail.addEventListener("loadedmetadata", function() {
                thumbnail.play().catch(function(error) {
                  console.log("Video thumbnail could not autoplay:", error);
                });
                resolve();
              }, { once: true });

              thumbnail.addEventListener("error", resolve, { once: true });

            } else {

              thumbnail.addEventListener("load", resolve, { once: true });
              thumbnail.addEventListener("error", resolve, { once: true });

            }

            thumbnail.src = source;

            // Handle media that is already cached.
            if (
              firstMedia.type === "image" &&
              thumbnail.complete
            ) {
              resolve();
            }

          });

        })
        .catch(function(error) {
          console.error("Could not load memory thumbnail:", error);
        });

      loadingTasks.push(loadingTask);

    });


    // Wait for thumbnails to load before calculating positions.
    await Promise.all(loadingTasks);

    arrangeMemories(reflowLayout);

  }


  /* ---------- OPEN MEMORY OVERLAY ---------- */

  async function openMemory(memoryId) {

    const memory = getMemories().find(function(item) {
      return String(item.id) === String(memoryId);
    });

    if (!memory) {
      return;
    }

    currentMemoryId = memoryId;
    memoryDetails.innerHTML = "";


    /* Memory title */

    const title = document.createElement("h2");
    title.classList.add("memory-detail-title");
    title.contentEditable = "true";
    title.spellcheck = false;
    title.setAttribute("aria-label", "Edit memory title");
    title.textContent = memory.title;

    memoryDetails.appendChild(title);


    /* Memory date */

    const date = document.createElement("input");
    date.classList.add("memory-detail-date");
    date.type = "date";
    date.value = memory.date;
    date.setAttribute("aria-label", "Edit memory date");

    memoryDetails.appendChild(date);


    /* Memory description */

    const description = document.createElement("p");
    description.classList.add("memory-detail-description");
    description.contentEditable = "true";
    description.spellcheck = false;
    description.setAttribute("aria-label", "Edit memory description");
    description.setAttribute("data-placeholder", "Add a description...");
    description.textContent = memory.description || "";

    memoryDetails.appendChild(description);


    /* Memory location */

    const locationHeading = document.createElement("p");
    locationHeading.classList.add("memory-detail-tags-heading");
    locationHeading.textContent = "location";

    memoryDetails.appendChild(locationHeading);

    const editLocationContainer = document.createElement("div");
    editLocationContainer.className = "memory-detail-location";

    memoryDetails.appendChild(editLocationContainer);

    editLocationPicker = window.createLocationPicker(
      editLocationContainer,
      memory.location || null
    );


    /* Memory tags */

    const tagsHeading = document.createElement("p");
    tagsHeading.classList.add("memory-detail-tags-heading");
    tagsHeading.textContent = "tags";

    memoryDetails.appendChild(tagsHeading);

    const tagsContainer = document.createElement("div");
    tagsContainer.classList.add("memory-detail-tags");

    const availableTags = ["comfort", "wonder", "savor"];

    availableTags.forEach(function(tag) {

      const tagButton = document.createElement("button");
      tagButton.type = "button";
      tagButton.classList.add("memory-detail-tag");

      tagButton.classList.toggle(
        "selected",
        (memory.tags || []).includes(tag)
      );

      tagButton.textContent = tag;

      tagButton.addEventListener("click", function() {
        tagButton.classList.toggle("selected");
      });

      tagsContainer.appendChild(tagButton);

    });

    memoryDetails.appendChild(tagsContainer);


    /* Memory photos and videos */

    const mediaContainer = document.createElement("div");
    mediaContainer.classList.add("memory-detail-media");

    for (const media of memory.media) {

      try {

        const source = await resolveMediaSource(media);

        let mediaElement;

        if (media.type === "video") {

          mediaElement = document.createElement("video");
          mediaElement.controls = true;
          mediaElement.classList.add("memory-detail-video");

        } else {

          mediaElement = document.createElement("img");
          mediaElement.alt = memory.title;
          mediaElement.classList.add("memory-detail-image");

        }

        mediaElement.src = source;
        mediaContainer.appendChild(mediaElement);

      } catch (error) {

        console.error("Could not load memory media:", error);

      }

    }

    memoryDetails.appendChild(mediaContainer);

    memoryOverlay.hidden = false;
    document.body.style.overflow = "hidden";

  }


  /* ---------- SAVE MEMORY CHANGES ---------- */

  function saveMemory() {

    const memory = getMemories().find(function(item) {
      return String(item.id) === String(currentMemoryId);
    });

    if (!memory) {
      return;
    }

    const updatedTitle = memoryDetails.querySelector(
      ".memory-detail-title"
    ).textContent.trim();

    const updatedDate = memoryDetails.querySelector(
      ".memory-detail-date"
    ).value;

    const updatedDescription = memoryDetails.querySelector(
      ".memory-detail-description"
    ).textContent.trim();

    const updatedTags = Array.from(
      memoryDetails.querySelectorAll(".memory-detail-tag.selected")
    ).map(function(button) {
      return button.textContent;
    });

    window.memoryStorage.saveOverride(currentMemoryId, {
      title: updatedTitle || memory.title,
      date: updatedDate || memory.date,
      description: updatedDescription,
      tags: updatedTags,
      location: editLocationPicker
        ? editLocationPicker.getValue()
        : memory.location || null
    });

    filterMemories();

    saveButton.textContent = "saved";

  }

  saveButton.addEventListener("click", saveMemory);


  /* ---------- CLOSE MEMORY OVERLAY ---------- */

  function closeMemory() {

    memoryOverlay.hidden = true;
    document.body.style.overflow = "";

    saveButton.textContent = "save";
    currentMemoryId = null;
    editLocationPicker = null;

  }

  closeOverlayButton.addEventListener("click", closeMemory);

  memoryOverlay.addEventListener("click", function(event) {

    if (event.target === memoryOverlay) {
      closeMemory();
    }

  });


  /* ---------- ADD MEMORY OVERLAY ---------- */

  function openAddMemory() {

    addMemoryForm.reset();
    addMemoryMessage.textContent = "";
    addLocationPicker.setValue(null);

    addMemoryOverlay.hidden = false;
    document.body.style.overflow = "hidden";

  }


  function closeAddMemory() {

    addMemoryOverlay.hidden = true;
    document.body.style.overflow = "";

  }

  addMemoryButton.addEventListener("click", openAddMemory);

  closeAddMemoryButton.addEventListener("click", closeAddMemory);

  addMemoryOverlay.addEventListener("click", function(event) {

    if (event.target === addMemoryOverlay) {
      closeAddMemory();
    }

  });


  /* ---------- SAVE NEW MEMORY ---------- */

  addMemoryForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const title = document.getElementById("new-memory-title").value.trim();
    const date = document.getElementById("new-memory-date").value;
    const description = document.getElementById("new-memory-description").value.trim();

    const selectedTags = Array.from(
      addMemoryForm.querySelectorAll('input[name="tags"]:checked')
    ).map(function(input) {
      return input.value;
    });

    const files = Array.from(
      document.getElementById("new-memory-media").files
    );

    if (!title || !date || files.length === 0) {
      addMemoryMessage.textContent = "Please add a title, date, and at least one photo or video.";
      return;
    }

    try {

      addMemoryMessage.textContent = "Saving memory...";

      const memoryId = "new-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 8);

      const media = [];

      // Save each uploaded file in IndexedDB.
      for (let i = 0; i < files.length; i++) {

        const file = files[i];

        const storageKey = memoryId + "-media-" + i;

        await window.memoryStorage.saveMedia(storageKey, file);

        media.push({
          type: file.type.startsWith("video/") ? "video" : "image",
          storageKey: storageKey
        });

      }

      // Create the new memory.
      const newMemory = {
        id: memoryId,
        title: title,
        date: date,
        description: description,
        tags: selectedTags,
        location: addLocationPicker.getValue(),
        media: media
      };

      // Save the memory in this visitor's browser.
      window.memoryStorage.saveNewMemory(newMemory);

      // Show the updated archive.
      closeAddMemory();
      filterMemories(true);

    } catch (error) {

      console.error("Could not save memory:", error);
      addMemoryMessage.textContent = "Something went wrong while saving. Please try again.";

    }

  });


  /* ---------- CLOSE OVERLAYS WITH ESCAPE ---------- */

  document.addEventListener("keydown", function(event) {

    if (event.key === "Escape") {

      if (!memoryOverlay.hidden) {
        closeMemory();
      }

      if (!addMemoryOverlay.hidden) {
        closeAddMemory();
      }

    }

  });


  /* ---------- MEMORY CLICK INTERACTION ---------- */

  memoryContainer.addEventListener("click", function(event) {

    const memoryElement = event.target.closest(".memory");

    if (memoryElement) {
      openMemory(memoryElement.dataset.id);
    }

  });


  /* ---------- FILTER MEMORIES ---------- */

  function filterMemories(reflowLayout = false) {

    const allMemories = getMemories();

    // If a memory was added or deleted, rebuild the layout for the collection.
    const savedIds = localStorage.getItem(LAYOUT_IDS_KEY);

    const currentIds = allMemories.map(function(memory) {
      return String(memory.id);
    });

    if (savedIds && JSON.stringify(currentIds) !== savedIds) {
      reflowLayout = true;
    }

    if (selectedFilters.length === 0) {
      displayMemories(allMemories, reflowLayout);
      return;
    }

    const filteredMemories = allMemories.filter(function(memory) {

      return selectedFilters.some(function(filter) {
        return (memory.tags || []).includes(filter);
      });

    });

    displayMemories(filteredMemories, reflowLayout);

  }


  /* ---------- FILTER BUTTON INTERACTIONS ---------- */

  filterButtons.forEach(function(button) {

    button.addEventListener("click", function() {

      const selectedFilter = button.dataset.filter;

      if (selectedFilter === "all") {

        selectedFilters = [];

      } else {

        const allButton = document.querySelector('[data-filter="all"]');
        allButton.classList.remove("active");

        if (selectedFilters.includes(selectedFilter)) {

          selectedFilters = selectedFilters.filter(function(filter) {
            return filter !== selectedFilter;
          });

        } else {

          selectedFilters.push(selectedFilter);

        }

      }

      // Update the filter button appearances.
      filterButtons.forEach(function(filterButton) {

        const filter = filterButton.dataset.filter;

        if (filter === "all") {
          filterButton.classList.toggle("active", selectedFilters.length === 0);
        } else {
          filterButton.classList.toggle("active", selectedFilters.includes(filter));
        }

      });

      filterMemories();

    });

  });


  /* ---------- RESIZE ---------- */

  window.addEventListener("resize", arrangeMemories);


  /* ---------- INITIAL DISPLAY ---------- */

  document.querySelector('[data-filter="all"]').classList.add("active");

  filterMemories();

  // Open a memory directly when arriving from its map marker.
  const memoryHash = new URLSearchParams(window.location.hash.slice(1));
  const linkedMemoryId = memoryHash.get("memory");

  if (linkedMemoryId) {
    openMemory(linkedMemoryId);
  }

});