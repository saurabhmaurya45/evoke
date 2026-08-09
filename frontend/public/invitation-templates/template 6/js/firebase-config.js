/**
 * Firebase Configuration
 * Initialize Firebase Storage for the Valentine project
 */

(function () {
  'use strict';

  // Firebase configuration - Replace with your actual config
  // You can find this in Firebase Console > Project Settings > General > Your apps
  var firebaseConfig = {
    apiKey: "AIzaSyAVyJfDItWukFaznTQ8AqRpUwR4DJjmtQY",
    authDomain: "my-bel0ved.firebaseapp.com",
    projectId: "my-bel0ved",
    storageBucket: "my-bel0ved.firebasestorage.app",
    messagingSenderId: "422940196337",
    appId: "1:422940196337:web:e8459d15ae04fecb0f1850",
    measurementId: "G-7TCP8KNWJW"
  };

  // Initialize Firebase (only if not already initialized)
  if (typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
    } catch (e) {
      console.warn('Firebase initialization error:', e);
    }
  }

  // Firebase Storage base URL (define first so FirebaseConfig exists for initStorage)
  var FIREBASE_STORAGE_BASE_URL = 'https://firebasestorage.googleapis.com/v0/b/my-bel0ved.firebasestorage.app/o/';
  var storage = null;

  // Export config early so other scripts can see it; storage filled by initStorage
  window.FirebaseConfig = {
    storage: storage,
    initialized: false,
    storageBaseUrl: FIREBASE_STORAGE_BASE_URL
  };

  function initStorage() {
    if (typeof firebase !== 'undefined' && firebase.storage) {
      try {
        var s = firebase.storage();
        if (s && typeof s.ref === 'function') {
          storage = s;
          window.FirebaseConfig.storage = storage;
          window.FirebaseConfig.initialized = true;
        }
      } catch (e) {
        console.warn('Firebase Storage initialization error:', e);
      }
    }
    return storage;
  }
  initStorage();
  setTimeout(initStorage, 50);
  setTimeout(initStorage, 200);

  // Initialize Firestore (for template order stats / admin)
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    try {
      window.appDb = firebase.firestore();
    } catch (e) {
      console.warn('Firestore initialization error:', e);
    }
  }

  // Resolve favicon from BrandAssets (preferred) or link data-storage-path + data-token
  function resolveFavicon() {
    if (typeof window.applyBrandFavicon === 'function') {
      window.applyBrandFavicon();
      return;
    }
    var baseUrl = window.FirebaseConfig.storageBaseUrl;
    if (!baseUrl) return;
    var link = document.querySelector('link[rel="icon"][data-storage-path]');
    if (!link) return;
    var path = link.getAttribute('data-storage-path');
    var token = link.getAttribute('data-token');
    if (path && token) {
      link.href = baseUrl + path.replace(/^\//, '') + '?alt=media&token=' + token;
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resolveFavicon);
  } else {
    resolveFavicon();
  }
})();
