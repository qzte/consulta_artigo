// Service Worker — Consulta de Artigos v1.39.0
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
const CACHE_NAME = 'consulta-artigos-v1.60.0';

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
  // Desde a v1.53.0 o Tesseract, o ZXing e o qrcode seguem o mesmo caminho
  // que o xlsx: são ficheiros deste repositório (ver o comentário nas tags
  // <script> do index.html). É isto que faz o scan e a etiqueta funcionarem
  // já na PRIMEIRA abertura sem rede — vindos de CDN, só ficavam em cache
  // depois de uma visita com internet.
  './tesseract.min.js',
  // O worker do Tesseract. Não é carregado pelo index.html: é o próprio
  // Tesseract que lhe vai buscar em runtime, pelo workerPath que
  // abrirScanAoVivo lhe passa.
  './worker.min.js',
  // O motor OCR (com e sem SIMD). Como o worker.min.js acima, não é
  // carregado por nenhum <script src> nem pedido nenhum: vai embutido em
  // base64 no index.html e é servido ao worker via getCoreImportScriptsShim()
  // — está aqui só pela mesma convenção do worker.min.js.
  './tesseract-core-lstm.wasm.js',
  './tesseract-core-simd-lstm.wasm.js',
  './zxing-browser.min.js',
  './qrcode.js',
];

// Ficheiros que a app vai buscar a uma CDN em runtime. Guardados em
// separado e em modo "best-effort": basta um deles estar em baixo, ou
// bloqueado pela rede da instituição, para um cache.addAll único rebentar
// por inteiro — e, com ele, TODO o precache, incluindo os ficheiros locais
// acima. Era assim até à v1.26.0: numa rede que bloqueasse um destes
// domínios, o modo offline nunca chegava a funcionar e não havia nenhum
// sinal disso.
//
// Desde a v1.53.0 esta lista está VAZIA, e isso é de propósito: as três
// bibliotecas que aqui estavam (Tesseract, o seu worker e o ZXing) passaram
// a ser ficheiros deste repositório e subiram para a lista obrigatória.
// Desde a v1.58.0 o motor OCR (tesseract-core[-simd]-lstm.wasm.js) segue o
// mesmo caminho: vai embutido em base64 no index.html (ver VENDOR.md e
// getCoreImportScriptsShim() no index.html), não precisa de estar aqui.
//
// O que AINDA vem de CDN é só os dados de idioma "eng" que o Tesseract
// carrega por sua conta quando o OCR corre pela primeira vez
// (eng.traineddata.gz, ~3 MB). Não está aqui porque isso é ~3 MB que toda a
// gente descarregaria na instalação, incluindo quem nunca usa o OCR.
// Continua a ser guardado pelo handleAsset na primeira utilização COM
// internet, com o SHA-256 verificado (ver TESSERACT_CDN_HASHES) — ou seja,
// os dados de idioma são a única parte do scan que ainda exige ter havido
// rede uma vez. A leitura de códigos de barras e do QR da etiqueta (ZXing)
// e o próprio motor OCR já não exigem nada disso.
const PRECACHE_CDN = [];

// Hash SHA-256 (hex) do ficheiro que o Tesseract.js ainda vai buscar por
// sua conta ao cdn.jsdelivr.net na primeira utilização do OCR: os dados de
// idioma "eng" (modelo "4.0.0_best_int" — é o que se usa em modo
// LSTM_ONLY, o omisso do Tesseract; o "4.0.0" simples, maior, é só para o
// OEM legado — ver worker.min.js). Fixo à versão do Tesseract usada em
// tesseract.min.js/worker.min.js (5.1.1) e obtido a partir do próprio
// pacote npm, tal como o VENDOR.md já faz para as bibliotecas
// vendorizadas:
//   npm pack @tesseract.js-data/eng@1.0.0 && tar -xzf tesseract.js-data-eng-1.0.0.tgz
//   sha256sum package/4.0.0_best_int/eng.traineddata.gz
//
// Sem isto, quem controlasse o CDN — ou um intermediário na rede — no
// preciso momento da primeira utilização do OCR podia servir outro
// ficheiro, que passaria a ficar em cache indefinidamente (handleAsset
// serve sempre da cache depois da primeira vez). É o mesmo raciocínio que
// já levou a vendorizar o resto das bibliotecas e o motor OCR (ver
// VENDOR.md) — este é o único ficheiro que ainda vem de fora, por isso é o
// único que ainda precisa de verificação em runtime.
//
// Atualizar a versão do Tesseract sem atualizar este hash faz o OCR parar
// de funcionar (handleAsset passa a rejeitar o ficheiro novo) — é o
// comportamento certo: falhar de forma visível é preferível a servir um
// ficheiro sem verificação nenhuma.
const TESSERACT_CDN_HASHES = {
  '/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz':
    '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91',
};

// Calcula o SHA-256 (hex) de um ArrayBuffer, para comparar com
// TESSERACT_CDN_HASHES.
async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
    const url = new URL(request.url);
    const hashEsperado = url.hostname === 'cdn.jsdelivr.net' ? TESSERACT_CDN_HASHES[url.pathname] : undefined;

    if (!hashEsperado) {
      const resposta = await fetch(request);
      await guardarNaCache(cache, request, resposta);
      return resposta;
    }

    // Ficheiro do motor/dados do Tesseract vindo do CDN: só se guarda e
    // devolve depois de o hash bater certo. Um ficheiro com hash errado
    // (CDN comprometido, intermediário na rede, ou versão do Tesseract
    // subida sem atualizar TESSERACT_CDN_HASHES) nunca chega a ser
    // executado nem cacheado.
    const resposta = await fetch(request);
    if (!resposta.ok) return resposta;
    const corpo = await resposta.clone().arrayBuffer();
    const hashReal = await sha256Hex(corpo);
    if (hashReal !== hashEsperado) return Response.error();
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
