// Service worker BL Auto-Fill — TotalEnergies
// Stratégie : network-first sur l'app (HTML/manifest/icônes) pour que la
// dernière version déployée sur GitHub Pages arrive toujours sur le téléphone,
// cache-first sur les librairies CDN (immuables, versionnées par URL),
// secours sur le cache quand il n'y a pas de réseau (tournée hors-ligne).

const VERSION = 'v2';
const CACHE   = 'bl-autofill-' + VERSION;

// Fichiers de l'app à pré-cacher dès l'installation (réseau requis la 1ère fois)
const CORE = [
  'bl_autofill.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
];

// Librairies CDN — mises en cache au premier chargement
const LIBS = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([...CORE, ...LIBS]))
      .then(() => self.skipWaiting())          // prend la main sans attendre
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))  // purge anciens caches
      ))
      .then(() => self.clients.claim())         // contrôle les onglets ouverts tout de suite
  );
});

function isLib(url) {
  return url.startsWith('https://cdn.jsdelivr.net/') ||
         url.startsWith('https://cdnjs.cloudflare.com/');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;            // on ne touche qu'aux GET

  // Librairies CDN immuables → cache-first (rapide, économe en data)
  if (isLib(req.url)) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }))
    );
    return;
  }

  // App (même origine) → network-first : on tente le réseau, on met à jour le
  // cache, et on retombe sur le cache uniquement si pas de réseau.
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() =>
      caches.match(req).then(c => c || caches.match('bl_autofill.html'))
    )
  );
});
