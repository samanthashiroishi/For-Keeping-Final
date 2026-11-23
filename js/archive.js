
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

  // Stores the categories currently selected.
  let selectedFilters = [];

  // Stores the ID of the memory currently open.
  let currentMemoryId = null;

  // Stores temporary URLs for uploaded media.
  const mediaURLCache = new Map();

  // Stores media currently being edited in the overlay.
  let editingMedia = [];


  /* ---------- GET SAVED MEMORIES ---------- */

  function getMemories() {

    const savedOverrides = window.memoryStorage.loadOverrides();
    const newMemories = window.memoryStorage.loadNewMemories();

    // Put visitor-created memories before the original memories.
    // Reverse the array so the most recently added memory comes first.
    const allMemories = [
      ...newMemories.slice().reverse(),
      ...window.memories
    ];

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

  function arrangeMemories() {

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

    // Clear all previous positions.
    memoryElements.forEach(function(element) {

      element.style.position = "absolute";
      element.style.left = "";
      element.style.top = "";
      element.style.width = "";

    });

    const occupied = [];

    // Increase the density as the archive grows.
    const gap = Math.max(
      5,
      22 - memoryElements.length * 1.2
    );

    // Position memories one at a time.
    memoryElements.forEach(function(element) {

      const width = randomBetween(12, 21);

      element.style.width = width + "%";

      const elementHeight = element.offsetHeight;
      const elementWidth = containerWidth * width / 100;

      const currentBottom = occupied.reduce(function(max, rectangle) {

        return Math.max(max, rectangle.bottom);

      }, 20);

      let chosenPosition = null;

      for (let attempt = 0; attempt < 600; attempt++) {

        const leftPercent = randomBetween(3, 97 - width);

        const top = randomBetween(
          20,
          Math.max(80, currentBottom + 45)
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

      // If no suitable position was found,
      // place the memory below the existing memories.
      if (!chosenPosition) {

        const leftPercent = randomBetween(3, 97 - width);
        const top = currentBottom + gap + 10;

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

      element.style.left = chosenPosition.left + "%";
      element.style.top = chosenPosition.top + "px";

    });

    const archiveBottom = occupied.reduce(function(max, rectangle) {

      return Math.max(max, rectangle.bottom);

    }, 0);

    memoryContainer.style.minHeight =
      Math.max(650, archiveBottom + 150) + "px";

  }


  /* ---------- LOAD MEDIA SOURCE ---------- */

  async function resolveMediaSource(media) {

    if (media.src) {
      return media.src;
    }

    if (media.storageKey) {

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


  /* ---------- CLEAN UP TEMPORARY MEDIA URLS ---------- */

  function cleanUpEditingMedia() {

    editingMedia.forEach(function(media) {

      if (media.previewURL) {
        URL.revokeObjectURL(media.previewURL);
      }

    });

    editingMedia = [];

  }


  /* ---------- DISPLAY MEMORIES ---------- */

  async function displayMemories(memoryList) {

    memoryContainer.innerHTML = "";

    const loadingTasks = [];

    memoryList.forEach(function(memory) {

      const memoryElement = document.createElement("figure");
      memoryElement.classList.add("memory");
      memoryElement.dataset.id = memory.id;

      const firstMedia = (memory.media || [])[0];

      if (!firstMedia) {
        return;
      }

      let thumbnail;

      if (firstMedia.type === "video") {

        thumbnail = document.createElement("video");

        thumbnail.autoplay = true;
        thumbnail.muted = true;
        thumbnail.loop = true;
        thumbnail.playsInline = true;
        thumbnail.controls = false;
        thumbnail.preload = "auto";

      } else {

        thumbnail = document.createElement("img");
        thumbnail.alt = memory.title;

      }

      thumbnail.classList.add("memory-thumbnail");

      const caption = document.createElement("figcaption");
      caption.classList.add("memory-caption");

      const title = document.createElement("span");
      title.classList.add("memory-title");
      title.textContent = memory.title;

      const date = document.createElement("span");
      date.classList.add("memory-date");
      date.textContent = formatDate(memory.date);

      caption.appendChild(title);
      caption.appendChild(date);

      memoryElement.appendChild(thumbnail);
      memoryElement.appendChild(caption);

      memoryContainer.appendChild(memoryElement);

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

    await Promise.all(loadingTasks);

    arrangeMemories();

  }


  /* ---------- RENDER EDITABLE MEDIA ---------- */

  async function renderEditableMedia(mediaList) {

    mediaList.innerHTML = "";

    for (let i = 0; i < editingMedia.length; i++) {

      const media = editingMedia[i];

      const mediaItem = document.createElement("div");
      mediaItem.classList.add("memory-edit-media-item");

      try {

        let source;

        if (media.pendingFile) {
          source = media.previewURL;
        } else {
          source = await resolveMediaSource(media);
        }

        let mediaElement;

        if (media.type === "video") {

          mediaElement = document.createElement("video");
          mediaElement.controls = true;
          mediaElement.classList.add("memory-detail-video");

        } else {

          mediaElement = document.createElement("img");
          mediaElement.alt = "Memory photo";
          mediaElement.classList.add("memory-detail-image");

        }

        mediaElement.src = source;
        mediaItem.appendChild(mediaElement);

      } catch (error) {

        console.error("Could not load memory media:", error);

        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Could not load this file.";
        mediaItem.appendChild(errorMessage);

      }

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.classList.add("memory-media-remove-button");
      removeButton.textContent = "remove";

      removeButton.addEventListener("click", function() {

        const removedMedia = editingMedia[i];

        if (removedMedia.previewURL) {
          URL.revokeObjectURL(removedMedia.previewURL);
        }

        editingMedia.splice(i, 1);

        renderEditableMedia(mediaList);

      });

      mediaItem.appendChild(removeButton);
      mediaList.appendChild(mediaItem);

    }

  }


  /* ---------- OPEN MEMORY OVERLAY ---------- */

  async function openMemory(memoryId) {

    const memory = getMemories().find(function(item) {
      return String(item.id) === String(memoryId);
    });

    if (!memory) {
      return;
    }

    cleanUpEditingMedia();

    currentMemoryId = memoryId;
    memoryDetails.innerHTML = "";

    editingMedia = (memory.media || []).map(function(media) {
      return { ...media };
    });


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

    const mediaHeading = document.createElement("p");
    mediaHeading.classList.add("memory-detail-tags-heading");
    mediaHeading.textContent = "";

    memoryDetails.appendChild(mediaHeading);

    const mediaContainer = document.createElement("div");
    mediaContainer.classList.add("memory-detail-media");

    const mediaList = document.createElement("div");
    mediaList.classList.add("memory-edit-media-list");

    mediaContainer.appendChild(mediaList);

    await renderEditableMedia(mediaList);


    /* Add media */

    const uploadLabel = document.createElement("label");
    uploadLabel.classList.add("memory-add-media-label");
    uploadLabel.textContent = "add photos or videos";

    const uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.accept = "image/*,video/*";
    uploadInput.multiple = true;
    uploadInput.classList.add("memory-add-media-input");

    uploadInput.addEventListener("change", function() {

      const files = Array.from(uploadInput.files);

      files.forEach(function(file) {

        if (
          !file.type.startsWith("image/") &&
          !file.type.startsWith("video/")
        ) {
          return;
        }

        editingMedia.push({
          type: file.type.startsWith("video/") ? "video" : "image",
          pendingFile: file,
          previewURL: URL.createObjectURL(file)
        });

      });

      uploadInput.value = "";

      renderEditableMedia(mediaList);

    });

    uploadLabel.appendChild(uploadInput);
    mediaContainer.appendChild(uploadLabel);

    memoryDetails.appendChild(mediaContainer);


    /* Delete memory */

    const isVisitorMemory = window.memoryStorage
      .loadNewMemories()
      .some(function(item) {
        return String(item.id) === String(memoryId);
      });

    if (isVisitorMemory) {

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.classList.add("memory-delete-button");
      deleteButton.textContent = "delete";

      deleteButton.addEventListener("click", async function() {

        const confirmed = confirm(
          "Are you sure you want to delete this memory?"
        );

        if (!confirmed) {
          return;
        }

        try {

          deleteButton.disabled = true;
          deleteButton.textContent = "deleting...";

          const deletedMemory = await window.memoryStorage.deleteNewMemory(
            memoryId
          );

          if (deletedMemory) {

            memory.media.forEach(function(media) {

              if (
                media.storageKey &&
                mediaURLCache.has(media.storageKey)
              ) {

                URL.revokeObjectURL(
                  mediaURLCache.get(media.storageKey)
                );

                mediaURLCache.delete(media.storageKey);

              }

            });

            closeMemory();
            filterMemories();

          }

        } catch (error) {

          console.error("Could not delete memory:", error);

          deleteButton.disabled = false;
          deleteButton.textContent = "delete";

          alert("Something went wrong. Please try again.");

        }

      });

      memoryDetails.appendChild(deleteButton);

    }

    memoryOverlay.hidden = false;
    document.body.style.overflow = "hidden";

  }


  /* ---------- SAVE MEMORY CHANGES ---------- */

  async function saveMemory() {

    const memory = getMemories().find(function(item) {
      return String(item.id) === String(currentMemoryId);
    });

    if (!memory) {
      return;
    }

    if (editingMedia.length === 0) {
      alert("A memory needs at least one photo or video.");
      return;
    }

    const memoryId = currentMemoryId;

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

    saveButton.disabled = true;
    saveButton.textContent = "saving...";

    try {

      const updatedMedia = [];

      // Save any newly uploaded files.
      for (let i = 0; i < editingMedia.length; i++) {

        const media = editingMedia[i];

        if (media.pendingFile) {

          const storageKey = memoryId + "-media-" +
            Date.now() + "-" +
            Math.random().toString(36).slice(2, 8);

          await window.memoryStorage.saveMedia(
            storageKey,
            media.pendingFile
          );

          updatedMedia.push({
            type: media.type,
            storageKey: storageKey
          });

        } else {

          updatedMedia.push({
            ...media
          });

        }

      }

      // Find uploaded files that were removed.
      const remainingKeys = updatedMedia
        .filter(function(media) {
          return media.storageKey;
        })
        .map(function(media) {
          return media.storageKey;
        });

      const removedKeys = (memory.media || [])
        .filter(function(media) {
          return media.storageKey &&
            !remainingKeys.includes(media.storageKey);
        })
        .map(function(media) {
          return media.storageKey;
        });

      // Save all memory changes.
      window.memoryStorage.saveOverride(memoryId, {
        title: updatedTitle || memory.title,
        date: updatedDate || memory.date,
        description: updatedDescription,
        tags: updatedTags,
        media: updatedMedia
      });

      // Remove files that are no longer attached to the memory.
      if (removedKeys.length > 0) {

        try {

          await window.memoryStorage.deleteMedia(removedKeys);

          removedKeys.forEach(function(key) {

            if (mediaURLCache.has(key)) {

              URL.revokeObjectURL(mediaURLCache.get(key));
              mediaURLCache.delete(key);

            }

          });

        } catch (error) {

          console.error("Could not remove unused media files:", error);

        }

      }

      // Update the archive.
      filterMemories();

      // Reopen the memory using its newly saved information.
      await openMemory(memoryId);

      saveButton.textContent = "saved";

    } catch (error) {

      console.error("Could not save memory:", error);

      alert("Something went wrong while saving. Please try again.");

      saveButton.textContent = "save";

    } finally {

      saveButton.disabled = false;

    }

  }

  saveButton.addEventListener("click", saveMemory);


  /* ---------- CLOSE MEMORY OVERLAY ---------- */

  function closeMemory() {

    cleanUpEditingMedia();

    memoryOverlay.hidden = true;
    document.body.style.overflow = "";

    saveButton.textContent = "save";
    saveButton.disabled = false;

    currentMemoryId = null;

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

      const newMemory = {
        id: memoryId,
        title: title,
        date: date,
        description: description,
        tags: selectedTags,
        location: null,
        media: media
      };

      window.memoryStorage.saveNewMemory(newMemory);

      closeAddMemory();
      filterMemories();

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

  function filterMemories() {

    const allMemories = getMemories();

    if (selectedFilters.length === 0) {
      displayMemories(allMemories);
      return;
    }

    const filteredMemories = allMemories.filter(function(memory) {

      return selectedFilters.some(function(filter) {
        return (memory.tags || []).includes(filter);
      });

    });

    displayMemories(filteredMemories);

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

});