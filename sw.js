// Service Worker — Consulta de Artigos v1.33.0
//
// Função: guardar uma cópia local (cache) do ficheiro HTML, dos ícones,
// do manifest e dos scripts das bibliotecas, para a app continuar a abrir
// e a funcionar mesmo sem internet depois da primeira visita.
//
// Importante para quem for atualizar isto no futuro:
// - O nome da CACHE_NAME inclui a versão. Sempre que se sobe uma versão
//   nova da app, muda-se este nome (ex: 'consulta-artigos-v1.27.0') — isso
//   faz o Service Worker apagar a cache antiga e guardar tudo outra vez.
//   Esquecer este passo faz o utilizador ficar preso numa versão antiga.
// - Desde a v1.27.0 este ficheiro deixou de depender do nome VERSIONADO
//   do HTML: usa './' e './index.html', que não mudam de versão para
//   versão. Antes, cada subida de versão obrigava a editar aqui o nome
//   exato do ficheiro, e esquecer-se disso fazia a app offline tentar
//   abrir um ficheiro que já não existia.
// - Nota: esta cache do Service Worker guarda os FICHEIROS DA APLICAÇÃO
//   (HTML, ícones, bibliotecas). É diferente e independente do IndexedDB
//   usado para guardar os DOIS FICHEIROS EXCEL carregados pela pessoa
//   (T_supermercados / Consumo) — esse é gerido diretamente pelo HTML
//   (ver "Persistência local (IndexedDB)" no script), não por aqui.

// ATENÇÃO: subir este nome é o que faz uma versão nova chegar a quem já tem
// a app instalada. handleAsset serve sempre da cache primeiro — sem mudar
// de nome, um dispositivo já instalado continuaria a carregar os ficheiros
// antigos indefinidamente, mesmo com o index.html novo. O activate apaga as
// caches com nome diferente deste, e é aí que as cópias antigas
// desaparecem do dispositivo.
const CACHE_NAME = 'consulta-artigos-v1.33.0';

// Página a servir offline quando a rede falha numa navegação.
const OFFLINE_URL = './index.html';

// Ficheiros da própria app: têm mesmo de ficar em cache, senão não há modo
// offline nenhum. Se algum destes falhar, a instalação falha (e volta a ser
// tentada mais tarde), o que é o comportamento certo — é um erro real.
const PRECACHE_LOCAL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  // Desde a v1.27.1 o xlsx é um ficheiro DESTE repositório, não de uma CDN
  // (ver o comentário na tag <script> do index.html: a versão do cdnjs tinha
  // vulnerabilidades conhecidas e não existe versão corrigida em CDN pública).
  // Está aqui, na lista obrigatória, e não na best-effort de baixo, de
  // propósito: sem esta biblioteca a app abre mas não lê ficheiro nenhum, por
  // isso é mesmo um erro de instalação e não uma degradação aceitável.
  './xlsx.full.min.js',
];

// Bibliotecas externas (CDN). Guardadas em separado e em modo
// "best-effort": basta uma delas estar em baixo, bloqueada pela rede da
// instituição, ou responder com um redirecionamento, para um cache.addAll
// único rebentar por inteiro — e, com ele, TODO o precache, incluindo os
// ficheiros locais acima. Era assim até à v1.26.0: numa rede que
// bloqueasse um destes domínios, o modo offline nunca chegava a funcionar
// e não havia nenhum sinal disso.
//
// Versões fixadas de propósito: o ZXing vinha de "@latest", que além de
// ser um alvo em movimento (uma versão nova podia partir a app sem nada
// ter mudado aqui) responde com um redirecionamento do unpkg para a
// versão concreta — e respostas redirecionadas não podem ser guardadas
// diretamente em cache.
const PRECACHE_CDN = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  // O Tesseract carrega este segundo ficheiro em runtime, quando o scan é
  // aberto pela primeira vez. Fica aqui para o scan também funcionar da
  // primeira vez já sem rede. Os restantes (motor wasm e dados de idioma)
  // vêm de outros domínios e continuam a ser guardados pelo handleAsset na
  // primeira utilização com internet — ver a nota lá em baixo.
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  'https://unpkg.com/@zxing/browser@0.2.1/umd/zxing-browser.min.js',
];

// Guarda uma resposta em cache. cache.put() recusa respostas
// redirecionadas (response.redirected), por isso nesse caso guarda-se o
// corpo dentro de uma Response nova, já "limpa".
async function guardarNaCache(cache, request, resposta) {
  if (!resposta || !resposta.ok) return;
  if (resposta.redirected) {
    const corpo = await resposta.clone().blob();
    await cache.put(request, new Response(corpo, {
      status: resposta.status,
      statusText: resposta.statusText,
      headers: resposta.headers,
    }));
    return;
  }
  await cache.put(request, resposta.clone());
}

// Instalação: descarrega e guarda os ficheiros das listas acima.
// skipWaiting() faz esta versão nova do Service Worker passar a ativa
// imediatamente, sem esperar que todas as abas antigas sejam fechadas.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_LOCAL);
    // allSettled: uma CDN indisponível não impede a app de ficar offline —
    // fica só sem essa biblioteca até haver rede outra vez.
    await Promise.allSettled(PRECACHE_CDN.map(async url => {
      const resposta = await fetch(url, { mode: 'cors' });
      await guardarNaCache(cache, url, resposta);
    }));
    await self.skipWaiting();
  })());
});

// Ativação: apaga caches de versões antigas (nomes diferentes de
// CACHE_NAME) para não acumular ficheiros desatualizados no dispositivo.
// clients.claim() faz o Service Worker passar a controlar já as páginas
// abertas, sem precisar de um refresh manual.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(nome => nome !== CACHE_NAME).map(nome => caches.delete(nome)));
    await self.clients.claim();
  })());
});

// Pedidos de navegação (abrir a página em si): tenta sempre a rede primeiro,
// para quem está online ver logo a versão mais recente; se não houver rede,
// usa a cópia guardada em cache. Isto evita ficar preso numa versão antiga
// da página enquanto houver internet disponível.
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const resposta = await fetch(request);
    // Só se guarda uma resposta boa. Sem esta verificação, uma página de
    // erro do servidor (404/500) era guardada por cima da cópia boa e
    // passava a ser o que a app mostrava offline dali em diante.
    await guardarNaCache(cache, request, resposta);
    return resposta;
  } catch (err) {
    const cached = await cache.match(request) || await cache.match(OFFLINE_URL);
    return cached || Response.error();
  }
}

// Outros pedidos (ícones, manifest, scripts das bibliotecas): usa a cache
// primeiro (mais rápido, funciona offline), e só vai à rede se ainda não
// estiver guardado nada — guardando depois o resultado para a próxima.
// Nota: isto também apanha, sem precisar de estar na lista PRECACHE_CDN,
// os ficheiros que o Tesseract.js pede em runtime (o "worker" e os dados
// de idioma "eng.traineddata") — ficam guardados automaticamente depois da
// primeira vez que o scan for usado com internet.
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resposta = await fetch(request);
    await guardarNaCache(cache, request, resposta);
    return resposta;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;

  // A Cache API só sabe lidar com pedidos GET em http/https. Um POST, ou um
  // pedido de esquema "chrome-extension:", faz cache.put() atirar exceção —
  // por isso deixam-se passar para a rede sem tocar na cache.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  } else {
    event.respondWith(handleAsset(request));
  }
});
