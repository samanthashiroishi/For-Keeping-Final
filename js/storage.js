
/* ---------- MEMORY STORAGE ---------- */

// This file saves each visitor's changes in their own browser.
// It does not change the original memories.js file.

// localStorage stores memory information.
// IndexedDB stores uploaded photos and videos.

window.memoryStorage = {


  /* ---------- EXISTING MEMORY EDITS ---------- */

  // Retrieve all saved memory changes.
  loadOverrides: function() {

    const savedData = localStorage.getItem("forKeepingMemoryEdits");

    return savedData ? JSON.parse(savedData) : {};

  },


  // Save changes to a particular memory.
  saveOverride: function(memoryId, changes) {

    const overrides = this.loadOverrides();

    overrides[memoryId] = {
      ...overrides[memoryId],
      ...changes
    };

    localStorage.setItem(
      "forKeepingMemoryEdits",
      JSON.stringify(overrides)
    );

  },


  /* ---------- NEW MEMORIES ---------- */

  // Retrieve memories that a visitor has created.
  loadNewMemories: function() {

    const savedData = localStorage.getItem("forKeepingNewMemories");

    return savedData ? JSON.parse(savedData) : [];

  },


  // Save a newly created memory.
  saveNewMemory: function(memory) {

    const newMemories = this.loadNewMemories();

    newMemories.push(memory);

    localStorage.setItem(
      "forKeepingNewMemories",
      JSON.stringify(newMemories)
    );

  },


  // Delete a visitor-created memory and all its uploaded media.
  deleteNewMemory: async function(memoryId) {

    const newMemories = this.loadNewMemories();

    const memory = newMemories.find(function(item) {
      return String(item.id) === String(memoryId);
    });

    // Only visitor-created memories can be deleted.
    if (!memory) {
      return false;
    }

    // Include media added through later edits.
    const overrides = this.loadOverrides();
    const updatedMemory = overrides[memoryId] || memory;

    const mediaKeys = (updatedMemory.media || [])
      .filter(function(media) {
        return media.storageKey;
      })
      .map(function(media) {
        return media.storageKey;
      });

    // Remove uploaded media from IndexedDB.
    await this.deleteMedia(mediaKeys);

    // Remove the memory from localStorage.
    const updatedMemories = newMemories.filter(function(item) {
      return String(item.id) !== String(memoryId);
    });

    localStorage.setItem(
      "forKeepingNewMemories",
      JSON.stringify(updatedMemories)
    );

    // Remove saved edits associated with this memory.
    delete overrides[memoryId];

    localStorage.setItem(
      "forKeepingMemoryEdits",
      JSON.stringify(overrides)
    );

    return true;

  },


  /* ---------- INDEXEDDB DATABASE ---------- */

  // Open the database used to store uploaded media.
  openDatabase: function() {

    return new Promise(function(resolve, reject) {

      const request = indexedDB.open("forKeepingMedia", 1);

      request.onupgradeneeded = function(event) {

        const database = event.target.result;

        if (!database.objectStoreNames.contains("media")) {
          database.createObjectStore("media");
        }

      };

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };

      request.onerror = function() {
        reject(request.error);
      };

    });

  },


  // Save an uploaded photo or video.
  saveMedia: async function(key, file) {

    const database = await this.openDatabase();

    return new Promise(function(resolve, reject) {

      const transaction = database.transaction("media", "readwrite");
      const store = transaction.objectStore("media");

      store.put(file, key);

      transaction.oncomplete = function() {
        database.close();
        resolve();
      };

      transaction.onerror = function() {
        database.close();
        reject(transaction.error);
      };

      transaction.onabort = function() {
        database.close();
        reject(transaction.error);
      };

    });

  },


  // Retrieve a previously uploaded photo or video.
  getMedia: async function(key) {

    const database = await this.openDatabase();

    return new Promise(function(resolve, reject) {

      const transaction = database.transaction("media", "readonly");
      const store = transaction.objectStore("media");
      const request = store.get(key);

      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };

      transaction.oncomplete = function() {
        database.close();
      };

      transaction.onerror = function() {
        database.close();
        reject(transaction.error);
      };

    });

  },


  // Delete one or more uploaded photos or videos.
  deleteMedia: async function(keys) {

    if (!keys || keys.length === 0) {
      return;
    }

    const database = await this.openDatabase();

    return new Promise(function(resolve, reject) {

      const transaction = database.transaction("media", "readwrite");
      const store = transaction.objectStore("media");

      keys.forEach(function(key) {
        store.delete(key);
      });

      transaction.oncomplete = function() {
        database.close();
        resolve();
      };

      transaction.onerror = function() {
        database.close();
        reject(transaction.error);
      };

      transaction.onabort = function() {
        database.close();
        reject(transaction.error);
      };

    });

  }

};