// Service Worker — Consulta de Artigos v1.18.2
//
// Função: guardar uma cópia local (cache) do ficheiro HTML, dos ícones,
// do manifest e do script da biblioteca xlsx, para a app continuar a abrir
// e a funcionar mesmo sem internet depois da primeira visita.
//
// Importante para quem for atualizar isto no futuro:
// - O nome da CACHE_NAME inclui a versão. Sempre que se sobe uma versão
//   nova da app, muda-se este nome (ex: 'consulta-artigos-v1.18.2') — isso
//   faz o Service Worker apagar a cache antiga e guardar tudo outra vez.
//   Esquecer este passo faz o utilizador ficar preso numa versão antiga.
// - PRECACHE_URLS tem de incluir o nome exato do ficheiro HTML atual. Se o
//   nome do ficheiro mudar (convenção de versionamento), este URL tem de
//   ser atualizado também, senão a app offline abre um ficheiro que já
//   não existe.

const CACHE_NAME = 'consulta-artigos-v1.18.2';

const PRECACHE_URLS = [
  './consulta_artigos_v1.18.2.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://unpkg.com/@zxing/browser@latest'
];

// Instalação: descarrega e guarda todos os ficheiros da lista acima.
// skipWaiting() faz esta versão nova do Service Worker passar a ativa
// imediatamente, sem esperar que todas as abas antigas sejam fechadas.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Ativação: apaga caches de versões antigas (nomes diferentes de
// CACHE_NAME) para não acumular ficheiros desatualizados no dispositivo.
// clients.claim() faz o Service Worker passar a controlar já as páginas
// abertas, sem precisar de um refresh manual.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(nome => nome !== CACHE_NAME).map(nome => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  );
});

// Pedidos de navegação (abrir a página em si): tenta sempre a rede primeiro,
// para quem está online ver logo a versão mais recente; se não houver rede,
// usa a cópia guardada em cache. Isto evita ficar preso numa versão antiga
// da página enquanto houver internet disponível.
async function handleNavigation(request) {
  try {
    const resposta = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, resposta.clone());
    return resposta;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('./consulta_artigos_v1.18.2.html');
    return cached || Response.error();
  }
}

// Outros pedidos (ícones, manifest, script da biblioteca xlsx): usa a
// cache primeiro (mais rápido, funciona offline), e só vai à rede se ainda
// não estiver guardado nada — guardando depois o resultado para a próxima.
// Nota: isto também apanha, sem precisar de estar na lista PRECACHE_URLS,
// os ficheiros que o Tesseract.js pede em runtime (o "worker" e os dados
// de idioma "eng.traineddata") — ficam guardados automaticamente depois da
// primeira vez que o scan por foto for usado com internet.
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resposta = await fetch(request);
    cache.put(request, resposta.clone());
    return resposta;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
  } else {
    event.respondWith(handleAsset(event.request));
  }
});
