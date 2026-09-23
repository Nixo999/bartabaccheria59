// Prova della pubblicazione: `node prova-pubblica.mjs` dalla radice (dopo `npm install`).
// L'archivio è BlobsServer, quello che Netlify usa in locale: il protocollo è
// quello vero, non un finto scritto a mano. La funzione, la edge function e le
// pagine del sito sono quelle vere. È la parte che, sbagliata, rompe la home
// o dà la pagina di modifica a chi non ha la parola: si riprova ogni volta che
// si tocca netlify/functions/pubblica.mjs o netlify/edge-functions/pagine.mjs.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import { getStore } from '@netlify/blobs';

const cartella = mkdtempSync(join(tmpdir(), 'blobs-prova-'));
const server = new BlobsServer({ directory: cartella, token: 'prova' });
const { port } = await server.start();
const contesto = (p) => Buffer.from(JSON.stringify({
  edgeURL: 'http://localhost:' + p, uncachedEdgeURL: 'http://localhost:' + p, siteID: 'bartabacchi59-prova', token: 'prova',
})).toString('base64');
process.env.NETLIFY_BLOBS_CONTEXT = contesto(port);

const gestore = (await import('./netlify/functions/pubblica.mjs')).default;
const { default: bordo } = await import('./netlify/edge-functions/pagine.mjs');
const archivio = () => getStore({ name: 'sito', consistency: 'strong' });

const INDEX = readFileSync('index.html', 'utf8');
const MENU = readFileSync('menu.html', 'utf8');
const regione = (t, tipo, nome) => t.match(new RegExp('<!--\\s*@' + tipo + '\\s+' + nome + '\\s*-->([\\s\\S]*?)<!--\\s*/@' + tipo + '\\s*-->'))[1];
const PIZZE = regione(MENU, 'menu', 'pizze');
const PIZZE_NUOVE = PIZZE.replace('</small></div><em>12,00</em>', '</small></div><em>12,50</em>');
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
const FOTO = 'foto/colazione-1790171475276.jpg';

async function azzera() {
  const a = archivio();
  for (const k of ['regioni', 'parola', FOTO]) await a.delete(k);
}
async function chiama(metodo, corpo, parola = 'admin') {
  const r = await gestore(new Request('https://bartabacchi59.netlify.app/api/pubblica', {
    method: metodo,
    headers: { ...(parola ? { authorization: 'Bearer ' + parola } : {}), 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }));
  return { stato: r.status, dati: await r.json() };
}
const pubblica = (pagine, extra = {}) => chiama('POST', { azione: 'pubblica', base: null, pagine, foto: [], ...extra });
async function visita(percorso, html, intestazioni = { 'content-type': 'text/html; charset=utf-8' }) {
  const next = async () => new Response(html, { headers: { 'x-robots-tag': 'noindex, nofollow', etag: '"statico"', 'content-length': String(Buffer.byteLength(html ?? '')), ...intestazioni } });
  return bordo(new Request('https://bartabacchi59.netlify.app' + percorso), { next });
}

let rotti = 0, fatti = 0;
function prova(nome, condizione, dettaglio = '') {
  fatti++;
  if (condizione) console.log('✓ ' + nome);
  else { rotti++; console.log('✗ ' + nome + (dettaglio ? ' — ' + dettaglio : '')); }
}

// 1. la parola d'ordine
await azzera();
prova('«admin» entra', (await chiama('GET')).stato === 200);
prova('una parola sbagliata no', (await chiama('GET', undefined, 'sbagliata')).stato === 401);
prova('senza parola no', (await chiama('GET', undefined, '')).stato === 401);
prova('all’inizio non c’è niente di pubblicato', (await chiama('GET')).dati.versione === null);

// 2. prima di qualunque modifica la home passa com'è, al byte
let r = await visita('/', INDEX);
prova('senza modifiche la home è identica a quella del repo', (await r.text()) === INDEX);

// 3. un prezzo e una foto
r = await pubblica({ 'menu.html': { regioni: { 'menu pizze': PIZZE_NUOVE } } }, { foto: [{ percorso: FOTO, dati: JPEG.toString('base64') }] });
prova('pubblica un prezzo e una foto', r.stato === 200 && typeof r.dati.versione === 'string', JSON.stringify(r));
const v1 = r.dati.versione;
let menu = await (await visita('/menu.html', MENU)).text();
const FIFTYNINE = '<b>Fiftynine</b><small>pomodoro, mozzarella, salame piccante, prosciutto cotto, wurstel e salsiccia</small></div>';
prova('il menù mostra il prezzo nuovo della Fiftynine', menu.includes(FIFTYNINE + '<em>12,50</em>') && !menu.includes(FIFTYNINE + '<em>12,00</em>'));
prova('e solo quello: il resto del menù è quello del repo', menu === MENU.replace(PIZZE, PIZZE_NUOVE));
prova('anche da /menu, senza .html', (await (await visita('/menu', MENU)).text()) === menu);
r = await visita('/menu.html', MENU);
prova('le intestazioni del sito restano (noindex), la vecchia etag no', r.headers.get('x-robots-tag') === 'noindex, nofollow' && !r.headers.get('etag') && !r.headers.get('content-length'));
const home = await (await visita('/', INDEX)).text();
prova('la home porta la versione nuova, per il «è online»', home.includes('<meta name="versione" content="' + v1 + '">'));
prova('e fuori dalla versione è identica a quella del repo', home.replace(v1, '2026-09-23') === INDEX);
r = await visita('/' + FOTO);
prova('la foto nuova si vede', r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && Buffer.from(await r.arrayBuffer()).equals(JPEG));
prova('una foto che non c’è: 404', (await visita('/foto/niente-1790171475276.jpg')).status === 404);
// le altre chiavi dell'archivio (la parola, le regioni) da /foto/ non escono:
// le protegge il prefisso. E sotto foto/ esce solo quello che ha il nome di una foto.
prova('fuori dalle foto non si legge l’archivio', (await visita('/foto/parola')).status === 404 && (await visita('/foto/regioni')).status === 404);
await archivio().set('foto/appunti', 'non è una foto');
prova('sotto foto/ esce solo quello che ha il nome di una foto', (await visita('/foto/appunti')).status === 404);
await archivio().delete('foto/appunti');

// 4. due pubblicazioni si sommano, e chi parte da una versione vecchia si ferma
const CALZONI = regione(MENU, 'menu', 'calzoni');
r = await pubblica({ 'menu.html': { regioni: { 'menu calzoni': CALZONI.replace('<em>8,50</em>', '<em>9,00</em>') } } }, { base: v1 });
prova('una seconda pubblicazione passa', r.stato === 200, JSON.stringify(r));
menu = await (await visita('/menu.html', MENU)).text();
prova('e il prezzo di prima resta', menu.includes('<em>12,50</em>') && menu.includes('<b>Liscio</b><small>pomodoro, mozzarella e prosciutto cotto</small></div><em>9,00</em>'));
r = await pubblica({ 'menu.html': { regioni: { 'menu pizze': PIZZE } } }, { base: v1 });
prova('partire da una versione vecchia: 409, e niente cambia', r.stato === 409 && (await (await visita('/menu.html', MENU)).text()) === menu);

// 5. la parola d'ordine non dà il permesso di mettere codice o di uscire dai pezzi
await azzera();
const rifiuta = async (nome, pagine, stato, extra) => {
  const x = await pubblica(pagine, extra);
  prova(nome + ': ' + stato, x.stato === stato, JSON.stringify(x));
};
await rifiuta('uno script', { 'menu.html': { regioni: { 'menu pizze': PIZZE + '<script>alert(1)</script>' } } }, 422);
await rifiuta('un onclick', { 'menu.html': { regioni: { 'menu pizze': PIZZE.replace('<em>', '<em onclick="x()">') } } }, 422);
await rifiuta('un commento che chiude il marcatore', { 'menu.html': { regioni: { 'menu pizze': '<!-- /@menu --><h1>preso</h1>' } } }, 422);
await rifiuta('un tipo di pezzo che non esiste', { 'menu.html': { regioni: { 'titolo tutto': 'x' } } }, 400);
await rifiuta('un nome di pezzo con dentro altro', { 'menu.html': { regioni: { 'menu pizze -->': 'x' } } }, 400);
await rifiuta('una pagina che non è delle due', { 'admin.html': { regioni: { 'menu pizze': 'x' } } }, 400);
await rifiuta('una descrizione con le virgolette', { 'index.html': { descrizione: 'ciao" onload="x' } }, 400);
await rifiuta('niente da pubblicare', {}, 400);
await rifiuta('una foto fuori da foto/', {}, 400, { foto: [{ percorso: 'parola', dati: JPEG.toString('base64') }] });
await rifiuta('una foto che non è un jpeg', {}, 400, { foto: [{ percorso: FOTO, dati: PNG.toString('base64') }] });
await rifiuta('tredici foto insieme', {}, 413, { foto: Array.from({ length: 13 }, (_, i) => ({ percorso: 'foto/f-17901714752' + String(i).padStart(2, '0') + '.jpg', dati: JPEG.toString('base64') })) });
prova('e dopo tutti questi rifiuti l’archivio è vuoto', (await chiama('GET')).dati.versione === null && !(await archivio().get('parola')));

// 6. i testi del proprietario restano i suoi, anche con dentro $1 e $&
r = await pubblica({ 'index.html': { regioni: { 'scritta formula': 'Spritz a 6$ e $1 e $& e $$' }, descrizione: 'Il bar di via Nazionale &amp; dintorni' } });
const casa = await (await visita('/', INDEX)).text();
prova('«$1» e «$&» restano lettere', casa.includes('<!-- @scritta formula -->Spritz a 6$ e $1 e $& e $$<!-- /@scritta -->'), JSON.stringify(r));
prova('la descrizione per Google cambia', casa.includes('<meta name="description" content="Il bar di via Nazionale &amp; dintorni">'));

// 7. cambiare la parola d'ordine dalla pagina
r = await chiama('POST', { azione: 'parola', nuova: 'la-parola-del-bar' });
prova('si cambia la parola d’ordine', r.stato === 200);
prova('da lì «admin» non entra più', (await chiama('GET')).stato === 401);
prova('entra quella nuova', (await chiama('GET', undefined, 'la-parola-del-bar')).stato === 200);
prova('la parola non sta in chiaro nell’archivio', !JSON.stringify(await archivio().get('parola', { type: 'json' })).includes('la-parola-del-bar'));
prova('una parola vuota non si mette', (await chiama('POST', { azione: 'parola', nuova: '  ' }, 'la-parola-del-bar')).stato === 400);
await archivio().setJSON('parola', { ...(await archivio().get('parola', { type: 'json' })), azzera: 0 });
prova('con AZZERA_PAROLA cambiato torna «admin»', (await chiama('GET')).stato === 200 && (await chiama('GET', undefined, 'la-parola-del-bar')).stato === 401);

// 8. se l'archivio non risponde, la home si apre lo stesso
await azzera();
await pubblica({ 'menu.html': { regioni: { 'menu pizze': PIZZE_NUOVE } } });
process.env.NETLIFY_BLOBS_CONTEXT = contesto(1); // una porta dove non risponde nessuno
prova('archivio giù: la home è quella del repo', (await (await visita('/', INDEX)).text()) === INDEX);
prova('archivio giù: il menù è quello del repo', (await (await visita('/menu.html', MENU)).text()) === MENU);
prova('archivio giù: la pagina di modifica lo dice, non pubblica', (await chiama('GET')).stato === 500);
process.env.NETLIFY_BLOBS_CONTEXT = contesto(port);
r = await visita('/menu.html', null, { 'content-type': '' });
prova('una risposta che non è una pagina passa com’è', r.headers.get('etag') === '"statico"');

await server.stop();
rmSync(cartella, { recursive: true, force: true });
console.log('\n' + (rotti ? rotti + ' controlli falliti su ' + fatti : 'Tutti a posto: ' + fatti + ' controlli'));
process.exit(rotti ? 1 : 0);
