// ── Pubblica le modifiche fatte da admin.html ──
//
// La pagina di modifica non scrive sul disco di chi la apre: manda qui i testi
// nuovi delle due pagine e le foto, e questa funzione li mette su GitHub in UN
// commit solo. Netlify vede il commit e rimette online il sito da sé, in un
// minuto circa. Il sito resta statico: niente database, niente JS che carica
// il menù — la funzione cambia i file, non il modo in cui vengono serviti.
//
// Si legge dal repo, mai dal sito: Netlify rielabora l'HTML che serve (riscrive
// i link a menu.html in /menu e ci inietta uno script suo), e riscrivere quella
// versione nel repo lo sporcherebbe a ogni salvataggio.
//
// Tre impostazioni su Netlify (Site configuration → Environment variables),
// messe da Nicola e mai scritte nel repo:
//   ADMIN_PASSWORD  la parola d'ordine del proprietario, almeno 12 caratteri
//   GITHUB_TOKEN    token fine-grained su questo repo solo, «Contents: read and write»
//   GITHUB_REPO     il repo collegato a Netlify, nella forma owner/nome
// Ne manca una, o la parola è corta: non si pubblica niente. Si fallisce chiusi.

import { createHash, timingSafeEqual } from 'node:crypto';

const PAGINE = ['index.html', 'menu.html'];
// il nome che admin.js dà alle foto nuove: <slug>-<timestamp>.jpg. Mai il nome
// di una foto che c'è già: assets/img/* è servito immutable, e una foto
// sovrascritta resterebbe vecchia nella cache di chi l'ha già vista.
const FOTO = /^assets\/img\/[a-z0-9-]{1,60}-\d{13}\.jpg$/;
const MAX_FOTO = 12;
const MAX_BYTE_FOTO = 1_500_000;
const MAX_PAGINA = 300_000;

const risposta = (stato, corpo) => new Response(JSON.stringify(corpo), {
  status: stato,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function impostazioni() {
  const e = process.env;
  const repo = e.GITHUB_REPO || (e.REPOSITORY_URL || '').replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  if (!e.ADMIN_PASSWORD || e.ADMIN_PASSWORD.length < 12) return null;
  if (!e.GITHUB_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { parola: e.ADMIN_PASSWORD, token: e.GITHUB_TOKEN, repo, ramo: e.GITHUB_BRANCH || 'main' };
}

// confronto a tempo costante: sulle impronte, che hanno sempre la stessa lunghezza
const impronta = (s) => createHash('sha256').update(String(s)).digest();
const stessaParola = (a, b) => timingSafeEqual(impronta(a), impronta(b));

async function github(cfg, metodo, percorso, corpo, grezzo) {
  const r = await fetch('https://api.github.com/repos/' + cfg.repo + percorso, {
    method: metodo,
    headers: {
      authorization: 'Bearer ' + cfg.token,
      accept: grezzo ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'bartabacchi59-pubblica',
      ...(corpo ? { 'content-type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) {
    const e = new Error('github ' + metodo + ' ' + percorso + ': ' + r.status);
    e.stato = r.status;
    throw e;
  }
  return grezzo ? r.text() : r.json();
}

const testa = async (cfg) => (await github(cfg, 'GET', '/git/ref/heads/' + cfg.ramo)).object.sha;
const pagina = (cfg, f, sha) => github(cfg, 'GET', '/contents/' + f + '?ref=' + sha, null, true);

// ── Il controllo che rende la parola d'ordine un permesso limitato ──
// Fuori dai pezzi marcati la pagina deve restare identica al byte: da qui si
// cambia solo quello che la pagina di modifica sa cambiare. E dentro non può
// comparire codice: la parola d'ordine serve a cambiare un prezzo, non a
// mettere uno script davanti ai clienti del bar.
const SCHELETRO = [
  [/(<!--\s*@([a-z]+)\s+[a-z0-9-]+\s*-->)[\s\S]*?(<!--\s*\/@\2\s*-->)/g, '$1$3'],
  [/(<meta name="(?:description|versione)" content=")[^"]*(")/g, '$1$2'],
];
const PERICOLI = [/<script\b/gi, /<iframe\b/gi, /<object\b/gi, /<embed\b/gi, /\son[a-z]+\s*=/gi, /javascript:/gi];
const scheletro = (t) => SCHELETRO.reduce((s, [re, sost]) => s.replace(re, sost), t);
const conta = (t, re) => (t.match(re) || []).length;

function controlla(prima, dopo) {
  if (scheletro(prima) !== scheletro(dopo)) return 'cambia fuori dai pezzi modificabili';
  for (const re of PERICOLI) if (conta(dopo, re) > conta(prima, re)) return 'contiene codice';
  return '';
}

// ── GET: le due pagine come stanno nel repo, e il commit da cui partono ──
async function leggi(cfg) {
  const base = await testa(cfg);
  const files = {};
  for (const f of PAGINE) files[f] = await pagina(cfg, f, base);
  return risposta(200, { base, files });
}

// ── POST: un commit solo, testi e foto insieme ──
async function pubblica(cfg, req) {
  let corpo;
  try { corpo = await req.json(); } catch { return risposta(400, { errore: 'richiesta' }); }
  const { base, testi = {}, foto = [], cosa = '' } = corpo || {};
  if (!/^[0-9a-f]{40}$/.test(String(base))) return risposta(400, { errore: 'richiesta' });
  if (typeof testi !== 'object' || !Array.isArray(foto)) return risposta(400, { errore: 'richiesta' });

  const nomi = Object.keys(testi);
  for (const f of nomi) {
    if (!PAGINE.includes(f) || typeof testi[f] !== 'string') return risposta(400, { errore: 'richiesta' });
    if (testi[f].length > MAX_PAGINA) return risposta(413, { errore: 'troppo-grande' });
  }
  if (foto.length > MAX_FOTO) return risposta(413, { errore: 'troppe-foto' });
  for (const f of foto) {
    if (!FOTO.test(String(f?.percorso)) || typeof f.dati !== 'string') return risposta(400, { errore: 'richiesta' });
    const byte = Buffer.from(f.dati, 'base64');
    if (byte.length > MAX_BYTE_FOTO) return risposta(413, { errore: 'troppo-grande' });
    if (byte[0] !== 0xff || byte[1] !== 0xd8 || byte[2] !== 0xff) return risposta(400, { errore: 'non-jpeg' });
  }
  if (!nomi.length && !foto.length) return risposta(400, { errore: 'vuota' });

  // Qualcuno ha pubblicato dopo che la pagina ha letto i file (Nicola dal Mac,
  // un'altra scheda): si ferma tutto invece di scrivere sopra al suo lavoro.
  if (await testa(cfg) !== base) return risposta(409, { errore: 'cambiato' });

  for (const f of nomi) {
    const male = controlla(await pagina(cfg, f, base), testi[f]);
    if (male) return risposta(422, { errore: 'fuori-regione', file: f, dettaglio: male });
  }

  const albero = (await github(cfg, 'GET', '/git/commits/' + base)).tree.sha;
  const voci = [];
  for (const f of nomi) {
    const { sha } = await github(cfg, 'POST', '/git/blobs', { content: testi[f], encoding: 'utf-8' });
    voci.push({ path: f, mode: '100644', type: 'blob', sha });
  }
  for (const f of foto) {
    const { sha } = await github(cfg, 'POST', '/git/blobs', { content: f.dati, encoding: 'base64' });
    voci.push({ path: f.percorso, mode: '100644', type: 'blob', sha });
  }
  const nuovoAlbero = (await github(cfg, 'POST', '/git/trees', { base_tree: albero, tree: voci })).sha;
  const messaggio = 'Dalla pagina di modifica: ' + (String(cosa).replace(/\s+/g, ' ').trim().slice(0, 120) || 'aggiornamento');
  const commit = (await github(cfg, 'POST', '/git/commits', { message: messaggio, tree: nuovoAlbero, parents: [base] })).sha;
  try {
    // force:false — se nel frattempo il ramo si è mosso, GitHub rifiuta con 422
    await github(cfg, 'PATCH', '/git/refs/heads/' + cfg.ramo, { sha: commit, force: false });
  } catch (e) {
    if (e.stato === 422) return risposta(409, { errore: 'cambiato' });
    throw e;
  }
  return risposta(200, { commit });
}

export default async (req) => {
  const cfg = impostazioni();
  if (!cfg) return risposta(503, { errore: 'non-configurato' });
  const data = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!stessaParola(data, cfg.parola)) {
    await new Promise((r) => setTimeout(r, 600)); // rallenta chi prova a indovinare
    return risposta(401, { errore: 'parola' });
  }
  try {
    if (req.method === 'GET') return await leggi(cfg);
    if (req.method === 'POST') return await pubblica(cfg, req);
    return risposta(405, { errore: 'metodo' });
  } catch (e) {
    // 401/403 da GitHub: la chiave è scaduta o non ha i permessi — non la parola del proprietario
    if (e.stato) return risposta(502, { errore: 'github', stato: e.stato });
    return risposta(500, { errore: 'interno' });
  }
};

export const config = { path: '/api/pubblica' };
