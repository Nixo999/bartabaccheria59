// ── Modifica il sito del bar: uno strumento locale, non un'area riservata ──
//
// Lo store sono i file del sito, index.html e menu.html: niente database,
// niente JSON di mezzo, niente login. Ogni pezzo modificabile del sito sta
// fra due commenti — <!-- @menu pizze --> … <!-- /@menu --> — e si riscrive
// solo quello che c'e' dentro: il resto del file non lo tocca nessuno, e il
// diff resta leggibile.
//
// La pagina non e' protetta perche' da qui non si scrive da nessuna parte se
// non sul disco di chi la apre. Due strade, decide il browser e non l'utente:
//  · con la File System Access API (Chrome/Edge da computer) scrive da se'
//    nella cartella del sito;
//  · senza (Safari, iPhone) consegna gli stessi file da scaricare.
// In tutti e due i casi va online quando chi ha il repo fa il commit.

const supportata = 'showDirectoryPicker' in window;
const esito = document.getElementById('esito');
const bottoneSalva = document.getElementById('salva');

// `?.`: cosi' il file si carica anche fuori da admin.html — serve alla
// pagina di prova, che verifica la lettura e la riscrittura delle regioni.
document.getElementById('avviso-download')?.toggleAttribute('hidden', supportata);
document.getElementById('nota-cartella')?.toggleAttribute('hidden', !supportata);

// ── Lo stato: il testo dei due file piu' il modello di quello che si modifica ──
const stato = {
  testo: {},        // 'index.html' → il testo come e' stato letto
  scatti: [],       // {file, regione, i, src, alt, w, h, nuova:File|null}
  locandine: [],    // {src, alt, w, h, titolo, testo, prezzo, nuova:File|null}
  liste: [],        // {file, regione, etichetta, rientro, voci:[{nome,desc,prezzo,casa}]}
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
  const righe = voci.map((v) =>
    '      <figure class="locandina svela">\n' +
    '        <img src="' + escA(v.src) + '" alt="' + escA(v.alt) + '" width="' + v.w + '" height="' + v.h + '" loading="lazy">\n' +
    '        <figcaption><b>' + escT(v.titolo) + '</b><small>' + escT(v.testo) + '</small><em>' + escT(v.prezzo) + '</em></figcaption>\n' +
    '      </figure>');
  return '\n' + righe.join('\n') + '\n      ';
}

// Cambia solo l'i-esima <img> della regione: il contenitore, le classi e la
// motion intorno restano quelli tarati a mano.
function scriviScatto(dentro, i, s) {
  let n = -1;
  return dentro.replace(/<img\b[^>]*>/g, (tag) => (++n === i)
    ? '<img src="' + escA(s.src) + '" alt="' + escA(s.alt) + '" width="' + s.w + '" height="' + s.h + '" loading="lazy">'
    : tag);
}

// ── Cartella del sito ───────────────────────────────────────────────────────
// Il picker vuole un gesto dell'utente: va chiamato per primo dentro il click,
// prima di qualunque await, o l'attivazione e' gia' scaduta.
// ponytail: la scelta non si ricorda fra sessioni (servirebbe IndexedDB); `id`
// fa almeno ripartire il dialogo dall'ultima cartella.
let radice = null;

async function cartella() {
  if (radice) return radice;
  if (!supportata) return null;
  let dir;
  try {
    dir = await showDirectoryPicker({ mode: 'readwrite', id: 'bartabaccheria59' });
  } catch {
    return null; // annullato: si passa ai download
  }
  try {
    await dir.getFileHandle('index.html');
  } catch {
    throw new Error('cartella-sbagliata');
  }
  radice = dir;
  return dir;
}

async function scrivi(dir, percorso, dati) {
  const parti = percorso.split('/');
  let d = dir;
  for (const p of parti.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(parti.at(-1), { create: true })).createWritable();
  await w.write(dati);
  await w.close();
}

// Due download di fila: il secondo il browser lo lascia cadere se parte
// nello stesso istante del primo. Si distanziano.
function scarica(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return new Promise((r) => setTimeout(r, 400));
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
  if (err.message === 'cartella-sbagliata') {
    return 'Quella non è la cartella del sito: scegli quella che contiene index.html.';
  }
  if (String(err.message).startsWith('regione-sparita')) {
    return 'Il sito è cambiato da quando hai aperto questa pagina e non ci scrivo sopra alla cieca. Ricarica la pagina e rifai la modifica.';
  }
  if (err.name === 'NotAllowedError') {
    return 'Non mi hai dato il permesso di modificare la cartella. Riprova e scegli «Consenti».';
  }
  return ripiego;
}

// ── L'elenco delle foto ─────────────────────────────────────────────────────

function mostraScatti() {
  const box = document.getElementById('scatti');
  box.innerHTML = '';
  for (const s of stato.scatti) box.append(rigaScatto(s));
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
  parla('«' + titolo + '» è nell\'elenco. Va nel sito quando premi «Salva tutto».');
});

// ── Salva ───────────────────────────────────────────────────────────────────

bottoneSalva?.addEventListener('click', async () => {
  esito.hidden = true;
  bottoneSalva.disabled = true;
  const etichetta = bottoneSalva.textContent;
  bottoneSalva.textContent = 'Un attimo…';
  try {
    const dir = await cartella(); // per prima: il picker vuole il gesto fresco
    const foto = [];              // {percorso, blob} da scrivere o scaricare
    const testi = Object.fromEntries(Object.entries(stato.testo));

    // 1. le foto nuove: si rimpiccioliscono e prendono un nome che non collide
    for (const s of stato.scatti) {
      if (!s.nuova) continue;
      const { blob, w, h } = await ridimensiona(s.nuova);
      s.src = 'assets/img/' + slug(s.regione) + '-' + Date.now() + '.jpg';
      s.w = w; s.h = h;
      foto.push({ percorso: s.src, blob });
    }
    for (const l of stato.locandine) {
      if (!l.nuova) continue;
      const { blob, w, h } = await ridimensiona(l.nuova);
      l.src = 'assets/img/' + slug(l.titolo) + '-' + Date.now() + '.jpg';
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

    // 4. si scrive: prima le foto, poi le pagine che le nominano
    const cambiate = Object.keys(testi).filter((f) => testi[f] !== stato.testo[f]);
    if (!cambiate.length && !foto.length) { parla('Non hai cambiato niente: non c\'è niente da salvare.'); return; }

    if (dir) {
      for (const f of foto) await scrivi(dir, f.percorso, f.blob);
      for (const f of cambiate) await scrivi(dir, f, testi[f]);
      parla('Salvato nei file del sito' + (foto.length ? ' (' + foto.length + ' foto nuove)' : '') +
            '. Va online quando Nicola manda su le modifiche.');
    } else {
      for (const f of foto) await scarica(f.blob, f.percorso.split('/').pop());
      for (const f of cambiate) await scarica(new Blob([testi[f]], { type: 'text/html' }), f);
      parla('Scaricati ' + (foto.length + cambiate.length) + ' file: le foto vanno in assets/img/, ' +
            'le pagine nella cartella del sito. Mandali a Nicola, li mette lui.');
    }

    // solo a scrittura riuscita: da qui in poi il file di partenza e' questo
    Object.assign(stato.testo, testi);
    for (const s of stato.scatti) s.nuova = null;
    for (const l of stato.locandine) l.nuova = null;
  } catch (err) {
    parla(scusa(err, 'Qualcosa non ha funzionato e non è stato salvato niente. Riprova fra un attimo.'), true);
  } finally {
    bottoneSalva.disabled = false;
    bottoneSalva.textContent = etichetta;
  }
});

// ── Avvio ───────────────────────────────────────────────────────────────────
// `no-cache`: senza, il browser tiene la copia vecchia della pagina e si
// lavorerebbe su un menù di ieri, riscrivendolo sopra a quello buono.

if (bottoneSalva) Promise.all(['index.html', 'menu.html'].map((f) =>
  fetch(f, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(f + ': ' + r.status);
    return r.text().then((t) => [f, t]);
  })
)).then((coppie) => {
  for (const [f, t] of coppie) stato.testo[f] = t;
  stato.scatti = leggiScatti(stato.testo['index.html'], 'index.html');
  stato.locandine = leggiLocandine(stato.testo['index.html']);
  stato.liste = [
    ...leggiListe(stato.testo['menu.html'], 'menu.html'),
    ...leggiListe(stato.testo['index.html'], 'index.html'),
  ];
  mostraScatti();
  mostraLocandine();
  riempiTendina();
  mostraVoci();
  bottoneSalva.disabled = false;
}).catch((err) => {
  document.getElementById('scatti').innerHTML = '';
  parla('Non riesco a leggere le pagine del sito (' + err.message + '). Se hai aperto questo file ' +
        'con un doppio clic, apri invece il sito da un indirizzo che comincia con http.', true);
});
