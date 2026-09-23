// ── Le modifiche del proprietario, dentro la pagina a ogni visita ──
//
// La pagina che parte è quella del repo, così come Netlify la serve; qui si
// sostituisce il contenuto dei pezzi marcati che il proprietario ha cambiato
// dalla pagina di modifica (netlify/functions/pubblica.mjs li salva in Netlify
// Blobs). Il sito resta HTML servito già completo: niente JS che carica il menù.
//
// Qualunque cosa vada storta — archivio che non risponde, dato rovinato — si
// serve la pagina del repo così com'è. Una modifica che non arriva è meglio di
// una home che non si apre.

import { getStore } from '@netlify/blobs';

const REGIONE = /^([a-z]+) ([a-z0-9-]{1,40})$/;
const FOTO = /^foto\/[a-z0-9-]{1,60}-\d{13}\.jpg$/;

// Il contenuto si mette con una funzione, non con una stringa di sostituzione:
// in un testo del proprietario «$1» o «$&» devono restare quello che sono.
export function applica(html, dati, pagina) {
  const p = dati?.pagine?.[pagina];
  if (p) {
    for (const [chiave, contenuto] of Object.entries(p.regioni || {})) {
      const m = REGIONE.exec(chiave);
      if (!m || typeof contenuto !== 'string') continue;
      const re = new RegExp('(<!--\\s*@' + m[1] + '\\s+' + m[2] + '\\s*-->)[\\s\\S]*?(<!--\\s*/@' + m[1] + '\\s*-->)');
      html = html.replace(re, (_, apre, chiude) => apre + contenuto + chiude);
    }
    if (typeof p.descrizione === 'string') {
      html = html.replace(/(<meta name="description" content=")[^"]*(")/, (_, a, z) => a + p.descrizione + z);
    }
  }
  // la versione dice alla pagina di modifica che la pubblicazione è arrivata
  if (pagina === 'index.html' && dati?.versione) {
    html = html.replace(/(<meta name="versione" content=")[^"]*(")/, (_, a, z) => a + dati.versione + z);
  }
  return html;
}

const nessuna = () => new Response('', { status: 404, headers: { 'cache-control': 'no-store' } });

async function foto(percorso) {
  if (!FOTO.test(percorso)) return nessuna();
  const dati = await getStore({ name: 'sito', consistency: 'strong' }).get(percorso, { type: 'arrayBuffer' });
  if (!dati) return nessuna();
  // il nome porta il timestamp: la stessa foto non cambia mai
  return new Response(dati, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
}

export default async (request, context) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/foto/')) {
    try { return await foto(url.pathname.slice(1)); } catch { return new Response('', { status: 503 }); }
  }
  const originale = await context.next();
  try {
    if (!(originale.headers.get('content-type') || '').includes('text/html')) return originale;
    const dati = await getStore({ name: 'sito', consistency: 'strong' }).get('regioni', { type: 'json' });
    if (!dati) return originale;
    const pagina = /^\/menu(\.html)?$/.test(url.pathname) ? 'menu.html' : 'index.html';
    const html = applica(await originale.clone().text(), dati, pagina);
    const intestazioni = new Headers(originale.headers);
    intestazioni.delete('content-length');
    intestazioni.delete('etag');
    intestazioni.set('cache-control', 'public, max-age=0, must-revalidate');
    return new Response(html, { status: originale.status, headers: intestazioni });
  } catch {
    return originale;
  }
};

export const config = { path: ['/', '/index.html', '/menu', '/menu.html', '/foto/*'] };
