// ── Modifica il sito del bar, e pubblica ──
//
// Lo store sono i file del sito, index.html e menu.html: niente database,
// niente JSON di mezzo. Ogni pezzo modificabile sta fra due commenti —
// <!-- @menu pizze --> … <!-- /@menu --> — e si riscrive solo quello che c'e'
// dentro: il resto del file non lo tocca nessuno, e il diff resta leggibile.
//
// Dal 23 settembre 2026 la pagina pubblica da sola, e subito: manda i pezzi
// cambiati e le foto nuove a netlify/functions/pubblica.mjs, che li salva
// nell'archivio di Netlify (Blobs); la edge function netlify/edge-functions/
// pagine.mjs li rimette nella pagina a ogni visita. Niente chiavi da impostare
// e niente deploy. «Deve andare direttamente online» e «non voglio passare per
// Netlify» (Nicola): via il disco, via i download, via il commit su GitHub.
// Le pagine si leggono dal sito, cosi' come sono online adesso: sono quelle
// con dentro le modifiche gia' fatte.

const esito = document.getElementById('esito');
const bottoneSalva = document.getElementById('salva');
const API = '/api/pubblica';

// ── Lo stato: il testo dei due file piu' il modello di quello che si modifica ──
const stato = {
  base: null,       // la versione pubblicata quando sono state lette le pagine: la funzione rifiuta se nel frattempo e' cambiata
  testo: {},        // 'index.html' → il testo come e' stato letto
  scatti: [],       // {file, regione, i, src, alt, w, h, nuova:File|null}
  locandine: [],    // {src, alt, w, h, titolo, testo, prezzo, nuova:File|null}
  rientroLocandine: '      ',
  liste: [],        // {file, regione, etichetta, rientro, voci:[{nome,desc,prezzo,casa}]}
  orari: null,      // 7 giorni, indice 0 = domenica: {apre:'HH:MM', chiude:'HH:MM'} oppure null se chiuso
  rientroOrari: '        ',
  scritte: [],      // {file, regione, etichetta, valore, meta?}
};

const ETICHETTE = {
  'pizze': 'Pizze (le prime 12)',
  'pizze-altre': 'Pizze (tutte le altre)',
  'calzoni': 'Calzoni',
  'focacce': 'Focacce',
  'sfiziosita': 'Sfiziosità',
  'panini': 'Panini',
  'bevande': 'Bevande',
  'cocktail': 'Cocktail (aperitivo)',
  'frittini': 'Frittini (aperitivo)',
};

const ETICHETTE_SCRITTE = {
  'apertura': 'La frase di apertura, in cima al sito',
  'colazione': 'Colazione',
  'pizzeria': 'Pizzeria',
  'menu': 'Sotto «Dal forno alla sala»',
  'offerte': 'Sotto «I menù del giorno»',
  'formula': 'La formula aperitivo',
  'formula-prezzo': 'Formula aperitivo: il prezzo, solo il numero',
  'birre': 'Sotto i cocktail: le birre',
  'lista-cocktail': 'Sotto i frittini',
  'tabacchi': 'Tabaccheria',
  'menu-intro': 'Pagina del menù: sotto il titolo',
  'pizze-nota': 'Pagina del menù: sotto le pizze',
  'panini-nota': 'Pagina del menù: sotto i panini',
  'allergeni': 'Pagina del menù: in fondo',
};

// Gli orari: indice 0 = domenica come getDay(). SETTIMANA e' l'ordine in cui
// si legge una settimana, da lunedi'.
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const GIORNI_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const SETTIMANA = [1, 2, 3, 4, 5, 6, 0];

// ── Le regioni marcate ──────────────────────────────────────────────────────
// Si cercano per nome dentro il testo, mai per posizione: cosi' una riscrittura
// resta valida anche se il file intorno e' cambiato.

function marcatore(tipo, nome) {
  return new RegExp('(<!--\\s*@' + tipo + '\\s+' + nome + '\\s*-->)([\\s\\S]*?)(<!--\\s*/@' + tipo + '\\s*-->)');
}

function regione(testo, tipo, nome) {
  const m = testo.match(marcatore(tipo, nome));
  if (!m) return null;
  const inizio = m.index + m[1].length;
  return { inizio, fine: inizio + m[2].length, dentro: m[2] };
}

function nomiRegioni(testo, tipo) {
  const re = new RegExp('<!--\\s*@' + tipo + '\\s+([a-z0-9-]+)\\s*-->', 'g');
  return [...testo.matchAll(re)].map((m) => m[1]);
}

// Rimpiazza il contenuto di una regione lasciando intatto tutto il resto.
function riscrivi(testo, tipo, nome, dentro) {
  const r = regione(testo, tipo, nome);
  if (!r) throw new Error('regione-sparita:' + tipo + ' ' + nome);
  return testo.slice(0, r.inizio) + dentro + testo.slice(r.fine);
}

// ── Lettura ─────────────────────────────────────────────────────────────────

const dom = (html) => new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html').body.firstElementChild;

function leggiScatti(testo, file) {
  const fuori = [];
  for (const nome of nomiRegioni(testo, 'scatto')) {
    const r = regione(testo, 'scatto', nome);
    [...dom(r.dentro).querySelectorAll('img')].forEach((img, i) => {
      fuori.push({
        file, regione: nome, i,
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        w: +img.getAttribute('width') || 0,
        h: +img.getAttribute('height') || 0,
        nuova: null,
      });
    });
  }
  return fuori;
}

function leggiLocandine(testo) {
  const r = regione(testo, 'galleria', 'offerte');
  if (!r) return [];
  // il rientro vero del file: se la galleria cambia posto nel markup, la
  // riscrittura segue senza che nessuno si ricordi di aggiornare un numero
  stato.rientroLocandine = (r.dentro.match(/\n( *)<figure/) || [null, '      '])[1];
  return [...dom(r.dentro).querySelectorAll('figure')].map((f) => {
    const img = f.querySelector('img');
    const q = (s) => f.querySelector('figcaption ' + s)?.textContent.trim() || '';
    return {
      src: img.getAttribute('src'),
      alt: img.getAttribute('alt') || '',
      w: +img.getAttribute('width') || 0,
      h: +img.getAttribute('height') || 0,
      titolo: q('b'), testo: q('small'), prezzo: q('em'),
      nuova: null,
    };
  });
}

function leggiListe(testo, file) {
  return nomiRegioni(testo, 'menu').map((nome) => {
    const r = regione(testo, 'menu', nome);
    const voci = [...dom(r.dentro).querySelectorAll('li')].map((li) => ({
      nome: li.querySelector('b')?.textContent.trim() || '',
      desc: li.querySelector('small')?.textContent.trim() || '',
      prezzo: li.querySelector('em')?.textContent.trim() || '',
      casa: li.classList.contains('casa'),
    }));
    // il rientro vero del file: cosi' la riscrittura non sfalsa l'indentazione
    const rientro = (r.dentro.match(/\n( *)<li/) || [null, '          '])[1];
    return { file, regione: nome, etichetta: ETICHETTE[nome] || nome, rientro, voci };
  });
}

// Gli orari stanno in un posto solo, la lista in #dove: la pagina pubblica
// legge da li' anche la linea del giorno. Ogni <li> porta i suoi giorni
// (data-giorni) e due <time>; senza <time> quel giorno e' chiuso.
function leggiOrari(testo) {
  const r = regione(testo, 'orari', 'settimana');
  if (!r) return null;
  stato.rientroOrari = (r.dentro.match(/\n( *)<li/) || [null, '        '])[1];
  const orari = Array(7).fill(null);
  for (const li of dom(r.dentro).querySelectorAll('li')) {
    const t = li.querySelectorAll('time');
    const fascia = t.length === 2 ? { apre: t[0].getAttribute('datetime'), chiude: t[1].getAttribute('datetime') } : null;
    for (const g of (li.dataset.giorni || '').split(',')) if (g !== '') orari[+g] = fascia;
  }
  return orari;
}

// La descrizione per Google e' un attributo, e in un attributo un commento
// HTML non ci sta: la si trova con la sua espressione.
const DESCRIZIONE = /(<meta name="description" content=")([^"]*)(")/;
// Quello che la pagina manda alla funzione: solo i pezzi marcati che sono
// cambiati rispetto a come li ha letti, e la descrizione se e' cambiata. Il
// resto della pagina resta quello del repo.
const TUTTE_LE_REGIONI = /<!--\s*@([a-z]+)\s+([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*\/@\1\s*-->/g;

function cambiamenti(prima, dopo) {
  const pagine = {};
  for (const f of Object.keys(dopo)) {
    const vecchie = {};
    for (const m of prima[f].matchAll(TUTTE_LE_REGIONI)) vecchie[m[1] + ' ' + m[2]] = m[3];
    const regioni = {};
    for (const m of dopo[f].matchAll(TUTTE_LE_REGIONI)) {
      if (vecchie[m[1] + ' ' + m[2]] !== m[3]) regioni[m[1] + ' ' + m[2]] = m[3];
    }
    const p = {};
    if (Object.keys(regioni).length) p.regioni = regioni;
    const d0 = prima[f].match(DESCRIZIONE)?.[2], d1 = dopo[f].match(DESCRIZIONE)?.[2];
    if (d1 !== undefined && d1 !== d0) p.descrizione = d1;
    if (Object.keys(p).length) pagine[f] = p;
  }
  return pagine;
}

function leggiScritte(testo, file) {
  const scritte = nomiRegioni(testo, 'scritta').map((nome) => ({
    file, regione: nome, etichetta: ETICHETTE_SCRITTE[nome] || nome,
    valore: daHtml(regione(testo, 'scritta', nome).dentro),
  }));
  const m = testo.match(DESCRIZIONE);
  if (m) scritte.push({
    file, regione: 'descrizione', meta: true,
    etichetta: (file === 'menu.html' ? 'Pagina del menù: la' : 'La') + ' descrizione per Google, sotto il titolo nei risultati',
    valore: daHtml(m[2].replace(/&quot;/g, '"').replace(/&#39;/g, "'")),
  });
  return scritte;
}

// ── Scrittura del markup ────────────────────────────────────────────────────
// Due scappamenti, non uno: nel testo l'apice dritto va lasciato com'e' —
// «'nduja» e «d'oliva» stanno nel menù — o ogni salvataggio riscriverebbe
// quarantaquattro righe di pizze per niente. Dentro un attributo invece
// vanno chiusi tutti e due, apice e virgolette.
const escT = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escA = (s) => escT(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function scriviVoci(lista) {
  const r = lista.rientro;
  const righe = lista.voci.map((v) =>
    r + '<li' + (v.casa ? ' class="casa"' : '') + '><div><b>' + escT(v.nome) + '</b>' +
    (v.desc ? '<small>' + escT(v.desc) + '</small>' : '') +
    '</div><em>' + escT(v.prezzo) + '</em></li>');
  return '\n' + righe.join('\n') + '\n' + r;
}

function scriviLocandine(voci) {
  const r = stato.rientroLocandine || '      ';
  const righe = voci.map((v) =>
    r + '<figure class="locandina svela">\n' +
    r + '  <img src="' + escA(v.src) + '" alt="' + escA(v.alt) + '" width="' + v.w + '" height="' + v.h + '" loading="lazy">\n' +
    r + '  <figcaption><b>' + escT(v.titolo) + '</b><small>' + escT(v.testo) + '</small><em>' + escT(v.prezzo) + '</em></figcaption>\n' +
    r + '</figure>');
  return '\n' + righe.join('\n') + '\n' + r;
}

// Cambia solo l'i-esima <img> della regione: il contenitore, le classi e la
// motion intorno restano quelli tarati a mano.
function scriviScatto(dentro, i, s) {
  let n = -1;
  return dentro.replace(/<img\b[^>]*>/g, (tag) => (++n === i)
    ? '<img src="' + escA(s.src) + '" alt="' + escA(s.alt) + '" width="' + s.w + '" height="' + s.h + '" loading="lazy">'
    : tag);
}

// ── Gli orari: dal modello alle tre regioni ─────────────────────────────────
// "05:50" → "5:50", come sull'insegna
const oraBreve = (hhmm) => String(+hhmm.slice(0, 2)) + ':' + hhmm.slice(3, 5);
const maiuscola = (s) => s[0].toUpperCase() + s.slice(1);

// I giorni di fila con lo stesso orario stanno su una riga: «Martedì – sabato».
function gruppiOrari(orari) {
  const chiave = (f) => (f ? f.apre + '-' + f.chiude : 'chiuso');
  const gruppi = [];
  for (const g of SETTIMANA) {
    const u = gruppi.at(-1);
    if (u && chiave(u.fascia) === chiave(orari[g])) u.giorni.push(g);
    else gruppi.push({ giorni: [g], fascia: orari[g] });
  }
  return gruppi;
}

function scriviOrariLista(orari) {
  const r = stato.rientroOrari;
  const righe = gruppiOrari(orari).map(({ giorni, fascia }) =>
    r + '<li data-giorni="' + giorni.join(',') + '"><b>' + maiuscola(GIORNI[giorni[0]]) +
    (giorni.length > 1 ? ' &ndash; ' + GIORNI[giorni.at(-1)] : '') + '</b><em>' +
    (fascia
      ? '<time datetime="' + fascia.apre + '">' + oraBreve(fascia.apre) + '</time> &ndash; <time datetime="' + fascia.chiude + '">' + oraBreve(fascia.chiude) + '</time>'
      : 'chiuso') +
    '</em></li>');
  return '\n' + righe.join('\n') + '\n' + r;
}

function scriviOrariPiede(orari) {
  return gruppiOrari(orari).map(({ giorni, fascia }) =>
    GIORNI_BREVI[giorni[0]] + (giorni.length > 1 ? '&ndash;' + GIORNI_BREVI[giorni.at(-1)] : '') + ' ' +
    (fascia ? oraBreve(fascia.apre) + '&ndash;' + oraBreve(fascia.chiude) : 'chiuso')).join(' · ');
}

function scriviOrariNota(orari) {
  const chiusi = SETTIMANA.filter((g) => !orari[g]).map((g) => (g === 0 ? 'la ' : 'il ') + GIORNI[g]);
  if (!chiusi.length) return 'Nessun giorno di chiusura.';
  if (chiusi.length === 7) return 'Chiuso tutta la settimana.';
  return 'Chiuso ' + (chiusi.length === 1 ? chiusi[0] : chiusi.slice(0, -1).join(', ') + ' e ' + chiusi.at(-1)) + '.';
}

// La settimana e la nota stanno solo in index.html, il piede in tutte e due
// le pagine. Una regione che manca ferma tutto (riscrivi alza l'errore).
function riscriviOrari(testi, orari) {
  const fuori = { ...testi };
  fuori['index.html'] = riscrivi(fuori['index.html'], 'orari', 'settimana', scriviOrariLista(orari));
  fuori['index.html'] = riscrivi(fuori['index.html'], 'orari', 'nota', scriviOrariNota(orari));
  for (const f of ['index.html', 'menu.html']) fuori[f] = riscrivi(fuori[f], 'orari', 'piede', scriviOrariPiede(orari));
  return fuori;
}

// ── Le scritte: si modificano come si scrivono, non come HTML ────────────────
// **due asterischi** per il grassetto, un a capo per <br>. Le entita' HTML
// diverse da & < > non si toccano: nei testi marcati oggi non ce ne sono, e
// la pagina di prova pretende il giro completo identico al byte.
const daHtml = (h) => h.replace(/<\/?strong>/g, '**').replace(/<br>/g, '\n')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const aHtml = (t) => escT(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

function riscriviScritte(testi, scritte) {
  const fuori = { ...testi };
  for (const s of scritte) {
    if (s.meta) {
      if (!DESCRIZIONE.test(fuori[s.file])) throw new Error('regione-sparita:descrizione ' + s.file);
      fuori[s.file] = fuori[s.file].replace(DESCRIZIONE, (_, a, __, z) => a + escA(s.valore) + z);
    } else {
      fuori[s.file] = riscrivi(fuori[s.file], 'scritta', s.regione, aHtml(s.valore));
    }
  }
  return fuori;
}

// Il numero accanto a «Pizze» segue le liste: non si scrive a mano.
const contoPizze = (liste) => liste.filter((l) => l.regione === 'pizze' || l.regione === 'pizze-altre')
  .reduce((n, l) => n + l.voci.length, 0);

// ── La funzione che pubblica ────────────────────────────────────────────────
// La parola d'ordine sta in sessionStorage, non in localStorage: vale finche'
// la scheda e' aperta, e nessuna altra scheda dello stesso sito la puo' leggere
// — index.html carica GSAP da un CDN, e quello e' codice di altri.
const CHIAVE = 'bartabacchi59-parola';
const parolaSalvata = () => { try { return sessionStorage.getItem(CHIAVE) || ''; } catch { return ''; } };
const ricordaParola = (p) => { try { if (p) sessionStorage.setItem(CHIAVE, p); else sessionStorage.removeItem(CHIAVE); } catch {} };

async function chiama(metodo, corpo) {
  const r = await fetch(API, {
    method: metodo,
    cache: 'no-store',
    headers: { authorization: 'Bearer ' + parolaSalvata(), ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dati = {};
  try { dati = await r.json(); } catch {}
  if (!r.ok) {
    const e = new Error(dati.errore || 'http ' + r.status);
    e.stato = r.status;
    throw e;
  }
  return dati;
}

const base64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = () => ko(r.error);
  r.readAsDataURL(blob);
});

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// La edge function mette le modifiche nella pagina dalla visita dopo. Si
// guarda il sito vero finche' non porta la versione appena scritta: tre
// minuti al massimo, poi si dice la verita' invece di «fatto».
async function aspettaOnline(versione) {
  for (let i = 0; i < 45; i++) {
    await pausa(4000);
    try {
      const t = await (await fetch('index.html?v=' + Date.now(), { cache: 'no-store' })).text();
      if (t.includes(versione)) return true;
    } catch {}
  }
  return false;
}

// ── Foto: si rimpiccioliscono qui ───────────────────────────────────────────
// Dal telefono arrivano da 4 MB. Lato lungo 1100px, jpeg 0.8 — come le foto
// che sono gia' nel sito. imageOrientation esplicito: senza, le foto verticali
// del telefono arrivano coricate.
async function ridimensiona(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scala = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scala);
  canvas.height = Math.round(bmp.height * scala);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
  if (!blob) throw new Error('canvas: niente blob');
  return { blob, w: canvas.width, h: canvas.height };
}

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';

// ── Messaggi ────────────────────────────────────────────────────────────────

function parla(testo, male) {
  esito.textContent = testo;
  esito.classList.toggle('ko', Boolean(male));
  esito.hidden = false;
  esito.scrollIntoView({ block: 'nearest' });
}

function scusa(err, ripiego) {
  if (String(err.message).startsWith('regione-sparita')) {
    return 'Il sito è cambiato da quando hai aperto questa pagina e non ci scrivo sopra alla cieca. Ricarica la pagina e rifai la modifica.';
  }
  if (err instanceof TypeError) return 'Niente connessione: controlla internet e riprova.';
  switch (err.stato) {
    case 401: return 'Parola d’ordine sbagliata.';
    case 404: return 'Da questo indirizzo non si pubblica: apri la pagina dal sito online.';
    case 409: return 'Il sito è stato cambiato da un’altra parte mentre lavoravi — da un’altra finestra o da un altro telefono. Ricarica la pagina: le modifiche di adesso vanno rifatte.';
    case 413: return 'Troppe foto insieme, o troppo grandi: pubblicane una parte, poi il resto.';
    case 422: return 'Non pubblico: nel testo c’è del codice, e da qui si pubblicano solo testi, prezzi e foto.';
    case 500: case 503: return 'L’archivio del sito non risponde. Riprova fra un minuto; se continua, scrivi a Nicola.';
  }
  return ripiego;
}

// ── L'elenco delle foto ─────────────────────────────────────────────────────

function mostraScatti() {
  const box = document.getElementById('scatti');
  box.innerHTML = '';
  // la locandina degli orari sta nella sezione degli orari, non qui
  for (const s of stato.scatti) if (s.regione !== 'orari') box.append(rigaScatto(s));
}

function rigaScatto(s) {
  const div = document.createElement('div');
  div.className = 'admin-riga';
  div.innerHTML =
    '<img alt="">' +
    '<div class="admin-campi">' +
      '<p class="admin-dove"></p>' +
      '<label>Descrizione della foto<input type="text"></label>' +
      '<label class="admin-file">Cambia la foto<input type="file" accept="image/*"></label>' +
    '</div>';
  const img = div.querySelector('img');
  img.src = s.src;
  img.addEventListener('error', () => { img.hidden = true; });
  div.querySelector('.admin-dove').textContent = 'Nella sezione «' + s.regione + '»';
  const alt = div.querySelector('input[type=text]');
  alt.value = s.alt;
  alt.addEventListener('input', () => { s.alt = alt.value; });
  const file = div.querySelector('input[type=file]');
  file.addEventListener('change', () => {
    s.nuova = file.files[0] || null;
    if (s.nuova) {
      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      img.src = URL.createObjectURL(s.nuova);
      img.hidden = false;
    }
  });
  return div;
}

// ── L'elenco delle locandine ────────────────────────────────────────────────

function mostraLocandine() {
  const box = document.getElementById('locandine');
  box.innerHTML = '';
  if (!stato.locandine.length) {
    box.innerHTML = '<p class="admin-sub">Nessuna offerta in questo momento.</p>';
    return;
  }
  stato.locandine.forEach((l) => box.append(rigaLocandina(l)));
}

function rigaLocandina(l) {
  const div = document.createElement('div');
  div.className = 'admin-riga';
  div.innerHTML =
    '<img alt="">' +
    '<div class="admin-campi">' +
      '<label>Nome<input type="text" data-c="titolo"></label>' +
      '<label>Cosa comprende<textarea rows="2" data-c="testo"></textarea></label>' +
      '<label>Prezzo<input type="text" data-c="prezzo"></label>' +
      '<label>Descrizione della foto<input type="text" data-c="alt"></label>' +
      '<label class="admin-file">Cambia la foto<input type="file" accept="image/*"></label>' +
      '<button class="link-line" type="button">Togli dal sito</button>' +
    '</div>';
  const img = div.querySelector('img');
  img.src = l.src;
  img.addEventListener('error', () => { img.hidden = true; });
  for (const campo of div.querySelectorAll('[data-c]')) {
    campo.value = l[campo.dataset.c];
    campo.addEventListener('input', () => { l[campo.dataset.c] = campo.value; });
  }
  const file = div.querySelector('input[type=file]');
  file.addEventListener('change', () => {
    l.nuova = file.files[0] || null;
    if (l.nuova) {
      if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
      img.src = URL.createObjectURL(l.nuova);
      img.hidden = false;
    }
  });
  div.querySelector('button').addEventListener('click', () => {
    if (!confirm('Vuoi togliere «' + (l.titolo || 'questa offerta') + '» dal sito?')) return;
    stato.locandine.splice(stato.locandine.indexOf(l), 1);
    mostraLocandine();
  });
  return div;
}

// ── Il menù scritto ─────────────────────────────────────────────────────────

function riempiTendina() {
  const sel = document.getElementById('quale-lista');
  sel.innerHTML = '';
  stato.liste.forEach((l, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = l.etichetta;
    sel.append(o);
  });
  sel.addEventListener('change', mostraVoci);
}

function listaCorrente() {
  return stato.liste[+document.getElementById('quale-lista').value] || stato.liste[0];
}

function mostraVoci() {
  const box = document.getElementById('voci');
  box.innerHTML = '';
  const lista = listaCorrente();
  if (!lista) return;
  lista.voci.forEach((v) => box.append(rigaVoce(lista, v)));
}

function rigaVoce(lista, v) {
  const div = document.createElement('div');
  div.className = 'admin-voce';
  div.innerHTML =
    '<label class="v-nome">Nome<input type="text" data-c="nome"></label>' +
    '<label class="v-desc">Descrizione<input type="text" data-c="desc"></label>' +
    '<label class="v-prezzo">Prezzo<input type="text" data-c="prezzo"></label>' +
    '<button class="link-line" type="button" aria-label="Togli questa voce">Togli</button>';
  for (const campo of div.querySelectorAll('[data-c]')) {
    campo.value = v[campo.dataset.c];
    campo.addEventListener('input', () => { v[campo.dataset.c] = campo.value; });
  }
  div.querySelector('button').addEventListener('click', () => {
    if (!confirm('Vuoi togliere «' + (v.nome || 'questa voce') + '» dal menù?')) return;
    lista.voci.splice(lista.voci.indexOf(v), 1);
    mostraVoci();
  });
  return div;
}

document.getElementById('aggiungi-voce')?.addEventListener('click', () => {
  const lista = listaCorrente();
  if (!lista) return;
  lista.voci.push({ nome: '', desc: '', prezzo: '', casa: false });
  mostraVoci();
  document.querySelector('#voci .admin-voce:last-child input')?.focus();
});

// ── Gli orari, giorno per giorno ────────────────────────────────────────────

function mostraOrari() {
  const box = document.getElementById('orari');
  box.innerHTML = '';
  if (!stato.orari) { box.innerHTML = '<p class="admin-sub">Non trovo gli orari nel sito.</p>'; return; }
  for (const g of SETTIMANA) box.append(rigaGiorno(g));
  // la locandina con gli orari sta qui: se cambiano loro deve cambiare anche lei
  const l = document.getElementById('locandina-orari');
  l.innerHTML = '';
  for (const s of stato.scatti) if (s.regione === 'orari') l.append(rigaScatto(s));
}

function rigaGiorno(g) {
  const div = document.createElement('div');
  div.className = 'admin-giorno';
  div.innerHTML =
    '<b></b>' +
    '<label>Apre<input type="time" data-c="apre"></label>' +
    '<label>Chiude<input type="time" data-c="chiude"></label>' +
    '<label class="admin-chiuso"><input type="checkbox">Chiuso</label>';
  div.querySelector('b').textContent = maiuscola(GIORNI[g]);
  const chiuso = div.querySelector('input[type=checkbox]');
  const ore = [...div.querySelectorAll('input[type=time]')];
  // un giorno chiuso tiene i campi compilati con un orario di comodo: togliendo
  // la spunta si riparte da qualcosa, non da vuoto
  const fascia = stato.orari[g] || { apre: '05:30', chiude: '21:30' };
  const aggiorna = () => {
    div.classList.toggle('chiuso', chiuso.checked);
    for (const i of ore) i.disabled = chiuso.checked;
    stato.orari[g] = chiuso.checked ? null : { apre: ore[0].value, chiude: ore[1].value };
  };
  chiuso.checked = !stato.orari[g];
  for (const i of ore) { i.value = fascia[i.dataset.c]; i.addEventListener('input', aggiorna); }
  chiuso.addEventListener('change', aggiorna);
  aggiorna();
  return div;
}

// Prima di scrivere: un giorno aperto ha tutte e due le ore, e chiude dopo
// che apre. "HH:MM" si confronta come testo, e' gia' ordinato.
function controllaOrari() {
  if (!stato.orari) return '';
  for (const g of SETTIMANA) {
    const f = stato.orari[g], nome = (g === 0 ? 'La ' : 'Il ') + GIORNI[g];
    if (!f) continue;
    if (!f.apre || !f.chiude) return nome + ' è aperto ma manca un orario. Se quel giorno è chiuso, metti la spunta.';
    if (f.apre >= f.chiude) return nome + ' apre alle ' + oraBreve(f.apre) + ' e chiude alle ' + oraBreve(f.chiude) + ': la chiusura deve venire dopo l\'apertura.';
  }
  return '';
}

// ── Le scritte ──────────────────────────────────────────────────────────────

function mostraScritte() {
  const box = document.getElementById('scritte');
  box.innerHTML = '';
  for (const s of stato.scritte) {
    const label = document.createElement('label');
    label.className = 'admin-scritta';
    label.textContent = s.etichetta;
    const area = document.createElement('textarea');
    area.value = s.valore;
    area.rows = Math.min(6, 1 + Math.floor(s.valore.length / 70) + (s.valore.match(/\n/g) || []).length);
    area.addEventListener('input', () => { s.valore = area.value; });
    label.append(area);
    box.append(label);
  }
}

// ── Aggiungi una locandina ──────────────────────────────────────────────────

const formLocandina = document.getElementById('form-locandina');
const anteprima = document.getElementById('n-preview');

document.getElementById('n-foto')?.addEventListener('change', (e) => {
  if (anteprima.src.startsWith('blob:')) URL.revokeObjectURL(anteprima.src);
  const file = e.target.files[0];
  anteprima.hidden = !file;
  if (file) anteprima.src = URL.createObjectURL(file);
});

// Stessa validazione inline del resto del sito: .field + .field-error.
function valida(form) {
  let ok = true;
  for (const field of form.querySelectorAll('.field')) {
    const input = field.querySelector('input, select, textarea');
    const errore = field.querySelector('.field-error');
    if (!input || !errore) continue;
    const buono = input.checkValidity();
    field.classList.toggle('invalid', !buono);
    errore.hidden = buono;
    if (!buono && ok) { input.focus(); ok = false; }
  }
  return ok;
}

formLocandina?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!valida(formLocandina)) return;
  const val = (id) => document.getElementById(id).value.trim();
  const titolo = val('n-titolo');
  stato.locandine.push({
    src: '', alt: titolo + ' — ' + val('n-testo'), w: 0, h: 0,
    titolo, testo: val('n-testo'), prezzo: val('n-prezzo'),
    nuova: document.getElementById('n-foto').files[0],
  });
  formLocandina.reset();
  anteprima.hidden = true;
  mostraLocandine();
  parla('«' + titolo + '» è nell\'elenco. Va online quando premi «Pubblica».');
});

// ── Pubblica ────────────────────────────────────────────────────────────────

let ultimaAttesa = 0;

bottoneSalva?.addEventListener('click', async () => {
  esito.hidden = true;
  bottoneSalva.disabled = true;
  const etichetta = bottoneSalva.textContent;
  bottoneSalva.textContent = 'Un attimo…';
  try {
    const male = controllaOrari();
    if (male) { parla(male, true); return; }
    const foto = [];              // {percorso, blob}: vanno nell'archivio prima dei pezzi che le nominano
    let testi = Object.fromEntries(Object.entries(stato.testo));

    // 1. le foto nuove: si rimpiccioliscono e prendono un nome che non collide
    for (const s of stato.scatti) {
      if (!s.nuova) continue;
      const { blob, w, h } = await ridimensiona(s.nuova);
      s.src = 'foto/' + slug(s.regione) + '-' + Date.now() + '.jpg';
      s.w = w; s.h = h;
      foto.push({ percorso: s.src, blob });
    }
    for (const l of stato.locandine) {
      if (!l.nuova) continue;
      const { blob, w, h } = await ridimensiona(l.nuova);
      l.src = 'foto/' + slug(l.titolo) + '-' + Date.now() + '.jpg';
      l.w = w; l.h = h;
      foto.push({ percorso: l.src, blob });
    }

    // 2. gli scatti, uno alla volta dentro la loro regione
    for (const s of stato.scatti) {
      const r = regione(testi[s.file], 'scatto', s.regione);
      if (!r) throw new Error('regione-sparita:scatto ' + s.regione);
      testi[s.file] = riscrivi(testi[s.file], 'scatto', s.regione, scriviScatto(r.dentro, s.i, s));
    }

    // 3. le locandine e i listini: la regione si rigenera intera dal modello
    if (regione(testi['index.html'], 'galleria', 'offerte')) {
      testi['index.html'] = riscrivi(testi['index.html'], 'galleria', 'offerte', scriviLocandine(stato.locandine));
    }
    for (const lista of stato.liste) {
      testi[lista.file] = riscrivi(testi[lista.file], 'menu', lista.regione, scriviVoci(lista));
    }
    if (regione(testi['menu.html'], 'conto', 'pizze')) {
      testi['menu.html'] = riscrivi(testi['menu.html'], 'conto', 'pizze', String(contoPizze(stato.liste)));
    }

    // 3-bis. gli orari nelle loro tre regioni, e le scritte
    if (stato.orari) testi = riscriviOrari(testi, stato.orari);
    testi = riscriviScritte(testi, stato.scritte);

    const pagine = cambiamenti(stato.testo, testi);
    if (!Object.keys(pagine).length && !foto.length) { parla('Non hai cambiato niente: non c\'è niente da pubblicare.'); return; }

    const corpo = {
      azione: 'pubblica',
      base: stato.base,
      pagine,
      foto: await Promise.all(foto.map(async (f) => ({ percorso: f.percorso, dati: await base64(f.blob) }))),
    };
    // ponytail: una richiesta sola, e Netlify ne accetta 6 MB; con le foto gia'
    // rimpicciolite sono una decina. Oltre, si dice di pubblicare in due volte.
    if (JSON.stringify(corpo).length > 5_500_000) { const e = new Error('troppo'); e.stato = 413; throw e; }

    bottoneSalva.textContent = 'Pubblico…';
    const { versione } = await chiama('POST', corpo);

    // solo a pubblicazione riuscita: da qui in poi il punto di partenza e' questo
    stato.base = versione;
    Object.assign(stato.testo, testi);
    for (const s of stato.scatti) s.nuova = null;
    for (const l of stato.locandine) l.nuova = null;

    parla('Pubblicato. Controllo che si veda sul sito…');
    const mia = ++ultimaAttesa;
    aspettaOnline(versione).then((online) => {
      if (mia !== ultimaAttesa) return; // nel frattempo e' partita un'altra pubblicazione: parla lei
      parla(online
        ? 'È online: le modifiche si vedono sul sito.'
        : 'Pubblicato, ma il sito non si è ancora aggiornato. Guardalo di nuovo fra qualche minuto; se non cambia, scrivi a Nicola.');
    });
  } catch (err) {
    if (err.stato === 401) esci();
    parla(scusa(err, 'Qualcosa non ha funzionato e non è stato pubblicato niente. Riprova fra un attimo.'), true);
  } finally {
    bottoneSalva.disabled = false;
    bottoneSalva.textContent = etichetta;
  }
});

// ── Avvio: prima la parola d'ordine, poi le pagine come sono online ─────────
// Le pagine si leggono dal sito: Netlify ci rielabora un paio di link e ci
// mette uno script suo, ma fuori dai pezzi marcati, e alla funzione arrivano
// solo i pezzi marcati.

const formEntra = document.getElementById('entra');
const editor = document.getElementById('editor');

function esci() {
  ricordaParola('');
  editor.hidden = true;
  bottoneSalva.hidden = true;
  bottoneSalva.disabled = true;
  formEntra.hidden = false;
  document.getElementById('parola').value = '';
}

async function leggiPagina(f) {
  const r = await fetch(f + '?v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) { const e = new Error(f); e.stato = r.status; throw e; }
  return r.text();
}

async function carica() {
  const { versione } = await chiama('GET'); // controlla anche la parola d'ordine
  stato.base = versione;
  stato.testo = { 'index.html': await leggiPagina('index.html'), 'menu.html': await leggiPagina('menu.html') };
  stato.scatti = leggiScatti(stato.testo['index.html'], 'index.html');
  stato.locandine = leggiLocandine(stato.testo['index.html']);
  stato.liste = [
    ...leggiListe(stato.testo['menu.html'], 'menu.html'),
    ...leggiListe(stato.testo['index.html'], 'index.html'),
  ];
  stato.orari = leggiOrari(stato.testo['index.html']);
  stato.scritte = [
    ...leggiScritte(stato.testo['index.html'], 'index.html'),
    ...leggiScritte(stato.testo['menu.html'], 'menu.html'),
  ];
  mostraScatti();
  mostraLocandine();
  riempiTendina();
  mostraVoci();
  mostraOrari();
  mostraScritte();
  formEntra.hidden = true;
  editor.hidden = false;
  bottoneSalva.hidden = false;
  bottoneSalva.disabled = false;
}

function nonEntra(err) {
  if (err.stato === 401) esci();
  else formEntra.hidden = false;
  parla(scusa(err, 'Non riesco a leggere il sito. Riprova fra un attimo.'), true);
}

// Cambiare la parola d'ordine: da quel momento quella di prima non vale piu'.
// Si fa qui, non su Netlify: e' il giorno in cui la pagina passa al proprietario.
document.getElementById('form-parola')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const campo = document.getElementById('parola-nuova');
  const nuova = campo.value;
  if (!nuova.trim()) { parla('Scrivi la parola d’ordine nuova.', true); return; }
  try {
    await chiama('POST', { azione: 'parola', nuova });
    ricordaParola(nuova);
    campo.value = '';
    parla('Parola d’ordine cambiata: da adesso si entra solo con quella nuova.');
  } catch (err) {
    if (err.stato === 401) esci();
    parla(scusa(err, 'La parola d’ordine non è cambiata. Riprova fra un attimo.'), true);
  }
});

formEntra?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tasto = formEntra.querySelector('button');
  tasto.disabled = true;
  esito.hidden = true;
  ricordaParola(document.getElementById('parola').value);
  try { await carica(); } catch (err) { nonEntra(err); } finally { tasto.disabled = false; }
});

if (bottoneSalva) {
  if (parolaSalvata()) carica().catch(nonEntra);
  else formEntra.hidden = false;
}
