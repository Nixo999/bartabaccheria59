// ── Pubblica le modifiche fatte da admin.html ──
//
// Le modifiche non vanno su GitHub: vanno in Netlify Blobs, l'archivio che
// Netlify dà alle sue funzioni senza chiavi e senza impostazioni. «Non voglio
// passare per Netlify» (Nicola, 23 settembre 2026): la strada col commit su
// GitHub chiedeva una chiave da creare e da incollare su Netlify, ed è stata
// bocciata. Qui non c'è niente da configurare.
//
// Cosa si salva: solo il contenuto dei pezzi marcati che il proprietario ha
// cambiato (<!-- @menu pizze --> … <!-- /@menu -->), la descrizione per Google
// e le foto nuove. La edge function netlify/edge-functions/pagine.mjs li rimette
// nella pagina a ogni visita: la struttura resta quella del repo, il contenuto
// modificato arriva dall'archivio. Online vuol dire subito, senza deploy.
//
// ⚠️ Il repo non vede le modifiche del proprietario: stanno nell'archivio. Un
// pezzo che il proprietario ha cambiato, se Nicola lo cambia nel repo, sul sito
// resta com'è nell'archivio.

import { getStore } from '@netlify/blobs';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// La parola d'ordine iniziale, scelta da Nicola il 23 settembre 2026: «per
// adesso la password è admin, e poi la cambiamo quando daremo davvero tutto in
// mano al cliente». Il repo è pubblico e lei con lui: si cambia dalla pagina di
// modifica, sezione «Parola d'ordine», e da quel momento questa non vale più.
// Se la parola nuova si perde, si cambia AZZERA_PAROLA e si pubblica: torna
// valida questa.
const PAROLA_INIZIALE = 'admin';
const AZZERA_PAROLA = 1;

const PAGINE = ['index.html', 'menu.html'];
const TIPI = ['scatto', 'galleria', 'menu', 'orari', 'scritta', 'conto'];
const REGIONE = /^([a-z]+) ([a-z0-9-]{1,40})$/;
// il nome che admin.js dà alle foto nuove: foto/<slug>-<timestamp>.jpg, mai uno
// che c'è già — la edge function le serve come immutabili
const FOTO = /^foto\/[a-z0-9-]{1,60}-\d{13}\.jpg$/;
const MAX_FOTO = 12;
const MAX_BYTE_FOTO = 1_500_000;
const MAX_REGIONE = 100_000;
// La parola d'ordine permette di cambiare un prezzo, non di mettere codice
// davanti ai clienti del bar. `<!--` perché un contenuto non deve poter chiudere
// il suo marcatore e mangiarsi il resto della pagina.
const PERICOLI = [/<script\b/i, /<iframe\b/i, /<object\b/i, /<embed\b/i, /\son[a-z]+\s*=/i, /javascript:/i, /<!--/];

const risposta = (stato, corpo) => new Response(JSON.stringify(corpo), {
  status: stato,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const archivio = () => getStore({ name: 'sito', consistency: 'strong' });

// ── La parola d'ordine ──
// Quella cambiata dalla pagina si salva come impronta scrypt col suo sale, mai
// in chiaro. Finché non c'è, vale la parola iniziale. Confronti a tempo costante.
const impronta = (parola, sale) => scryptSync(String(parola), Buffer.from(sale, 'hex'), 32);
const sha = (s) => createHash('sha256').update(String(s)).digest();

async function parolaGiusta(a, parola) {
  if (!parola) return false;
  const r = await a.get('parola', { type: 'json' });
  if (r && r.azzera === AZZERA_PAROLA) {
    return timingSafeEqual(impronta(parola, r.sale), Buffer.from(r.impronta, 'hex'));
  }
  return timingSafeEqual(sha(parola), sha(PAROLA_INIZIALE));
}

async function salvaParola(a, parola) {
  const sale = randomBytes(16).toString('hex');
  await a.setJSON('parola', { sale, impronta: impronta(parola, sale).toString('hex'), azzera: AZZERA_PAROLA });
}

// ── Il controllo di quello che arriva ──
function controllaPagine(pagine) {
  if (!pagine || typeof pagine !== 'object') return 'richiesta';
  for (const [f, p] of Object.entries(pagine)) {
    if (!PAGINE.includes(f) || !p || typeof p !== 'object') return 'richiesta';
    const regioni = p.regioni || {};
    if (typeof regioni !== 'object' || Object.keys(regioni).length > 100) return 'richiesta';
    for (const [chiave, contenuto] of Object.entries(regioni)) {
      const m = REGIONE.exec(chiave);
      if (!m || !TIPI.includes(m[1]) || typeof contenuto !== 'string') return 'richiesta';
      if (contenuto.length > MAX_REGIONE) return 'troppo-grande';
      if (PERICOLI.some((re) => re.test(contenuto))) return 'codice';
    }
    // la descrizione finisce dentro un attributo: niente virgolette, niente tag
    if (p.descrizione !== undefined && (typeof p.descrizione !== 'string' || p.descrizione.length > 500 || /["<>]/.test(p.descrizione))) return 'richiesta';
  }
  return '';
}

async function pubblica(a, corpo) {
  const { base = null, pagine = {}, foto = [] } = corpo;
  const male = controllaPagine(pagine);
  if (male === 'codice') return risposta(422, { errore: 'codice' });
  if (male === 'troppo-grande') return risposta(413, { errore: 'troppo-grande' });
  if (male) return risposta(400, { errore: male });
  if (!Array.isArray(foto)) return risposta(400, { errore: 'richiesta' });
  if (foto.length > MAX_FOTO) return risposta(413, { errore: 'troppe-foto' });
  const byteFoto = [];
  for (const f of foto) {
    if (!FOTO.test(String(f?.percorso)) || typeof f.dati !== 'string') return risposta(400, { errore: 'richiesta' });
    const byte = Buffer.from(f.dati, 'base64');
    if (byte.length > MAX_BYTE_FOTO) return risposta(413, { errore: 'troppo-grande' });
    if (byte[0] !== 0xff || byte[1] !== 0xd8 || byte[2] !== 0xff) return risposta(400, { errore: 'non-jpeg' });
    byteFoto.push({ percorso: f.percorso, byte });
  }
  if (!Object.keys(pagine).length && !byteFoto.length) return risposta(400, { errore: 'vuota' });

  const ora = (await a.get('regioni', { type: 'json' })) || { versione: null, pagine: {} };
  // qualcuno ha pubblicato dopo che la pagina ha letto (un'altra scheda, un
  // altro telefono): si ferma tutto invece di scrivere sopra al suo lavoro.
  // ponytail: confronto e scrittura non sono atomici (questa versione di Blobs
  // non ha scritture condizionate); con un proprietario solo basta.
  if ((ora.versione ?? null) !== (base ?? null)) return risposta(409, { errore: 'cambiato' });

  // prima le foto, poi le pagine che le nominano
  for (const f of byteFoto) await a.set(f.percorso, f.byte, { metadata: { tipo: 'image/jpeg' } });
  for (const [f, p] of Object.entries(pagine)) {
    const prima = ora.pagine[f] || { regioni: {} };
    ora.pagine[f] = {
      ...prima,
      regioni: { ...prima.regioni, ...(p.regioni || {}) },
      ...(p.descrizione !== undefined ? { descrizione: p.descrizione } : {}),
    };
  }
  ora.versione = new Date().toISOString() + '-' + randomBytes(3).toString('hex');
  await a.setJSON('regioni', ora);
  return risposta(200, { versione: ora.versione });
}

export default async (req) => {
  let a;
  try { a = archivio(); } catch { return risposta(503, { errore: 'archivio' }); }
  try {
    const data = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!(await parolaGiusta(a, data))) {
      await new Promise((r) => setTimeout(r, 600)); // rallenta chi prova a indovinare
      return risposta(401, { errore: 'parola' });
    }
    if (req.method === 'GET') {
      const ora = await a.get('regioni', { type: 'json' });
      return risposta(200, { versione: ora?.versione ?? null });
    }
    if (req.method !== 'POST') return risposta(405, { errore: 'metodo' });
    let corpo;
    try { corpo = await req.json(); } catch { return risposta(400, { errore: 'richiesta' }); }
    if (corpo?.azione === 'pubblica') return await pubblica(a, corpo);
    if (corpo?.azione === 'parola') {
      const nuova = String(corpo.nuova ?? '');
      if (!nuova.trim() || nuova.length > 200) return risposta(400, { errore: 'parola-vuota' });
      await salvaParola(a, nuova);
      return risposta(200, { ok: true });
    }
    return risposta(400, { errore: 'richiesta' });
  } catch {
    return risposta(500, { errore: 'interno' });
  }
};

export const config = { path: '/api/pubblica' };
