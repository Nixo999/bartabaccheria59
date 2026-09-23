// Prova della funzione che pubblica: `node prova-pubblica.mjs` dalla radice.
// GitHub è finto e sta in memoria; la funzione, le pagine e i controlli sono
// quelli veri. È la parte che, sbagliata, mette online un sito rotto o dà la
// parola d'ordine a chi non ce l'ha: si riprova ogni volta che si tocca
// netlify/functions/pubblica.mjs.

import { readFileSync } from 'node:fs';
import gestore from './netlify/functions/pubblica.mjs';

const PAGINE = { 'index.html': readFileSync('index.html', 'utf8'), 'menu.html': readFileSync('menu.html', 'utf8') };
const BASE = 'a'.repeat(40);
const NUOVO = 'b'.repeat(40);
const TOKEN = 'token-finto';
const PAROLA = 'fiftynine-prova-1234';

// ── GitHub finto ──
let gh;
function azzera() {
  gh = { testa: BASE, blob: [], alberi: [], commit: [], siMuove: false, chiamate: 0 };
}
const json = (stato, corpo) => new Response(JSON.stringify(corpo), { status: stato });

globalThis.fetch = async (url, opz = {}) => {
  gh.chiamate++;
  const u = new URL(url);
  const p = u.pathname.replace(/^\/repos\/Nixo999\/bartabaccheria59/, '');
  if (opz.headers.authorization !== 'Bearer ' + TOKEN) return json(401, { message: 'Bad credentials' });
  const corpo = opz.body ? JSON.parse(opz.body) : null;
  const m = opz.method;
  if (m === 'GET' && p === '/git/ref/heads/main') return json(200, { object: { sha: gh.testa } });
  if (m === 'GET' && p.startsWith('/contents/')) {
    const f = p.slice('/contents/'.length);
    if (u.searchParams.get('ref') !== BASE || !PAGINE[f]) return json(404, {});
    return new Response(PAGINE[f], { status: 200 });
  }
  if (m === 'GET' && p === '/git/commits/' + BASE) return json(200, { tree: { sha: 'albero-base' } });
  if (m === 'POST' && p === '/git/blobs') { gh.blob.push(corpo); return json(201, { sha: 'blob' + gh.blob.length }); }
  if (m === 'POST' && p === '/git/trees') { gh.alberi.push(corpo); return json(201, { sha: 'albero-nuovo' }); }
  if (m === 'POST' && p === '/git/commits') { gh.commit.push(corpo); return json(201, { sha: NUOVO }); }
  if (m === 'PATCH' && p === '/git/refs/heads/main') {
    // fast-forward o niente, come GitHub con force:false
    if (gh.siMuove || corpo.force !== false || gh.commit.at(-1)?.parents[0] !== gh.testa) return json(422, {});
    gh.testa = corpo.sha;
    return json(200, {});
  }
  return json(404, { message: 'non previsto: ' + m + ' ' + p });
};

// ── Chiamate alla funzione ──
function ambiente(extra = {}) {
  for (const k of ['ADMIN_PASSWORD', 'GITHUB_TOKEN', 'GITHUB_REPO', 'REPOSITORY_URL', 'GITHUB_BRANCH']) delete process.env[k];
  Object.assign(process.env, { ADMIN_PASSWORD: PAROLA, GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'Nixo999/bartabaccheria59' }, extra);
}
async function chiama(metodo, corpo, parola = PAROLA) {
  const r = await gestore(new Request('https://bartabacchi59.netlify.app/api/pubblica', {
    method: metodo,
    headers: { authorization: 'Bearer ' + parola, 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }));
  return { stato: r.status, dati: await r.json() };
}

let rotti = 0, fatti = 0;
function prova(nome, condizione, dettaglio = '') {
  fatti++;
  if (condizione) console.log('✓ ' + nome);
  else { rotti++; console.log('✗ ' + nome + (dettaglio ? ' — ' + dettaglio : '')); }
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]).toString('base64');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).toString('base64');
const foto = (nome = 'offerta-nuova-1758620000000') => ({ percorso: 'assets/img/' + nome + '.jpg', dati: JPEG });
const conPrezzo = PAGINE['menu.html'].replace('<b>Fiftynine</b><small>pomodoro, mozzarella, salame piccante, prosciutto cotto, wurstel e salsiccia</small></div><em>12,00</em>',
  '<b>Fiftynine</b><small>pomodoro, mozzarella, salame piccante, prosciutto cotto, wurstel e salsiccia</small></div><em>12,50</em>');

// 1. si fallisce chiusi
azzera(); ambiente({ ADMIN_PASSWORD: '' });
prova('senza parola d’ordine configurata non pubblica', (await chiama('GET')).stato === 503);
azzera(); ambiente({ ADMIN_PASSWORD: 'corta123' });
prova('con una parola d’ordine corta non pubblica', (await chiama('GET', undefined, 'corta123')).stato === 503);
azzera(); ambiente({ GITHUB_TOKEN: '' });
prova('senza la chiave di GitHub non pubblica', (await chiama('GET')).stato === 503);
azzera(); ambiente({ GITHUB_REPO: '' });
prova('senza sapere il repo non pubblica', (await chiama('GET')).stato === 503);
azzera(); ambiente({ GITHUB_REPO: '', REPOSITORY_URL: 'https://github.com/Nixo999/bartabaccheria59' });
prova('il repo lo prende anche da REPOSITORY_URL di Netlify', (await chiama('GET')).stato === 200);

// 2. la parola d'ordine
azzera(); ambiente();
let r = await chiama('GET', undefined, 'sbagliata-sbagliata');
prova('parola sbagliata: 401, e GitHub non viene nemmeno chiamato', r.stato === 401 && gh.chiamate === 0, r.stato + ' / ' + gh.chiamate + ' chiamate');

// 3. la lettura: i file del repo, non quelli del sito
azzera(); ambiente();
r = await chiama('GET');
prova('legge le due pagine e il commit di partenza', r.stato === 200 && r.dati.base === BASE &&
  r.dati.files['index.html'] === PAGINE['index.html'] && r.dati.files['menu.html'] === PAGINE['menu.html']);

// 4. il caso buono: un prezzo e una foto, in UN commit
azzera(); ambiente();
r = await chiama('POST', { base: BASE, testi: { 'menu.html': conPrezzo }, foto: [foto()], cosa: 'menù, 1 foto' });
prova('pubblica un prezzo e una foto', r.stato === 200 && r.dati.commit === NUOVO, JSON.stringify(r));
prova('un commit solo', gh.commit.length === 1);
prova('il commit parte da quello letto', gh.commit[0]?.parents[0] === BASE);
prova('nell’albero ci sono la pagina e la foto, e basta', gh.alberi[0]?.tree.map((v) => v.path).join() === 'menu.html,assets/img/offerta-nuova-1758620000000.jpg');
prova('la foto va su come base64, la pagina come testo', gh.blob[0]?.encoding === 'utf-8' && gh.blob[1]?.encoding === 'base64');
prova('il ramo si è spostato sul commit nuovo', gh.testa === NUOVO);
prova('il messaggio dice da dove viene', gh.commit[0]?.message === 'Dalla pagina di modifica: menù, 1 foto');

// 5. descrizione per Google e versione cambiano: sono permessi
azzera(); ambiente();
const conDescrizione = PAGINE['index.html']
  .replace(/(<meta name="description" content=")[^"]*(")/, '$1Nuova descrizione del bar$2')
  .replace(/(<meta name="versione" content=")[^"]*(")/, '$12026-09-23T10:00:00.000Z$2');
r = await chiama('POST', { base: BASE, testi: { 'index.html': conDescrizione } });
prova('la descrizione per Google e la versione si possono cambiare', r.stato === 200, JSON.stringify(r));

// 6. qualcuno ha pubblicato nel frattempo
azzera(); ambiente(); gh.testa = 'c'.repeat(40);
r = await chiama('POST', { base: BASE, testi: { 'menu.html': conPrezzo } });
prova('se il sito è cambiato dopo la lettura: 409, e niente commit', r.stato === 409 && gh.commit.length === 0, JSON.stringify(r));
azzera(); ambiente(); gh.siMuove = true;
r = await chiama('POST', { base: BASE, testi: { 'menu.html': conPrezzo } });
prova('se cambia proprio mentre pubblica: 409, il ramo resta dov’era', r.stato === 409 && gh.testa === BASE, JSON.stringify(r));

// 7. la parola d'ordine non dà il permesso di cambiare tutto
azzera(); ambiente();
r = await chiama('POST', { base: BASE, testi: { 'index.html': PAGINE['index.html'].replace('<title>', '<title>Hackerato — ') } });
prova('fuori dai pezzi modificabili: 422', r.stato === 422 && r.dati.errore === 'fuori-regione', JSON.stringify(r));
r = await chiama('POST', { base: BASE, testi: { 'menu.html': conPrezzo.replace('<em>12,50</em>', '<em>12,50<script>alert(1)</script></em>') } });
prova('uno script dentro un pezzo modificabile: 422', r.stato === 422 && r.dati.dettaglio === 'contiene codice', JSON.stringify(r));
r = await chiama('POST', { base: BASE, testi: { 'menu.html': conPrezzo.replace('<em>12,50</em>', '<em onclick="x()">12,50</em>') } });
prova('un attributo onclick dentro un pezzo modificabile: 422', r.stato === 422, JSON.stringify(r));
prova('e in nessuno di questi casi c’è stato un commit', gh.commit.length === 0);

// 8. file e foto: solo quelli previsti
azzera(); ambiente();
r = await chiama('POST', { base: BASE, testi: { 'netlify.toml': 'x' } });
prova('un file diverso dalle due pagine: 400', r.stato === 400);
r = await chiama('POST', { base: BASE, foto: [{ percorso: '../admin.js', dati: JPEG }] });
prova('una foto fuori da assets/img: 400', r.stato === 400);
r = await chiama('POST', { base: BASE, foto: [{ percorso: 'assets/img/insegna-orari.jpg', dati: JPEG }] });
prova('una foto col nome di una che c’è già: 400', r.stato === 400);
r = await chiama('POST', { base: BASE, foto: [{ ...foto(), dati: PNG }] });
prova('una foto che non è un jpeg: 400', r.stato === 400 && r.dati.errore === 'non-jpeg');
r = await chiama('POST', { base: BASE, foto: Array.from({ length: 13 }, (_, i) => foto('f-17586200000' + String(i).padStart(2, '0'))) });
prova('tredici foto insieme: 413', r.stato === 413);
r = await chiama('POST', { base: BASE });
prova('niente da pubblicare: 400', r.stato === 400 && r.dati.errore === 'vuota');
r = await chiama('POST', { base: 'ciao', testi: { 'menu.html': conPrezzo } });
prova('un commit di partenza che non è uno sha: 400', r.stato === 400);
prova('e anche qui nessun commit', gh.commit.length === 0);

// 9. la chiave di GitHub scaduta: un errore diverso dalla parola sbagliata
azzera(); ambiente({ GITHUB_TOKEN: 'scaduto' });
r = await chiama('GET');
prova('chiave di GitHub rifiutata: 502, non 401', r.stato === 502 && r.dati.stato === 401, JSON.stringify(r));

console.log('\n' + (rotti ? rotti + ' controlli falliti su ' + fatti : 'Tutti a posto: ' + fatti + ' controlli'));
process.exit(rotti ? 1 : 0);
