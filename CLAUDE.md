# Bar Tabacchi Fiftynine — sito vetrina

Sito per il **Bar Tabacchi Fiftynine e Pizzeria**, via Nazionale dei Giovi 59,
Cesano Maderno (MB). Tel. 0362 528451. Nato come bozza non commissionata il
1° settembre 2026; dal 2 settembre il proprietario manda materiale, quindi è
una trattativa aperta. Nota nel vault: `01-Coding/progetti/sito-fiftynine.md`.

## ⚠️ Due repository, una cartella sola

Lo stesso sito sta su **`Nixo999/bartabaccheria59`** (pubblico) e su
**`Nixo999/fiftynine-site`** (privato). Su questo Mac ci sono due cloni,
`~/lavoro/bartabaccheria59` e `~/lavoro/fiftynine-site`: **si lavora nel primo**,
che ha due `pushurl` su `origin` e con un `git push` scrive su tutti e due.
Il secondo si allinea con `git pull` e basta. È già successo una volta che le
copie divergessero: se `git log` dei due non coincide, il primo comanda.

⚠️ **Dal 23 settembre 2026 nel repo scrive anche il proprietario**, dalla pagina
di modifica, con commit «Dalla pagina di modifica: …». Quei commit vanno solo
sul repo collegato a Netlify (`GITHUB_REPO`), non sull'altro. Quindi: **prima di
lavorare in locale, `git pull`**; il push successivo dal Mac riallinea anche il
secondo repo. Il sito online è **https://bartabacchi59.netlify.app**.

## Com'è fatto

Statico puro: `index.html`, `menu.html`, `assets/stile.css`, niente build e
niente dipendenze. In sviluppo: `python3 -m http.server 8791` dalla radice.

- **L'idea**: la giornata del bar. Le ore vere fanno da capitoli (5:30
  colazione, 12:00 pizzeria, 18:00 aperitivo) e una linea del giorno nell'hero
  legge l'ora di Roma e dice se è aperto adesso.
- **Colori** dall'insegna: blu `#1b4aa4`, il 59 rosso `#d9262d`, bianco. Il
  giallo `#f2b429` (il loro piattino) solo sull'indicatore «adesso».
  Syne per i titoli, Yellowtail per lo script «fiftynine», Public Sans per il testo.
- **Motion**: GSAP 3.13 + ScrollTrigger da CDN, **additiva** — senza libreria o
  con `prefers-reduced-motion` la pagina è completa. `?fermo=1` la spegne: serve
  a controllare impaginazione e testi in un pannello che non fa girare rAF.
- **Il menù** sta in `menu.html` (44 pizze, calzoni, focacce, sfiziosità,
  panini, bevande), prezzi in vigore da gennaio 2026, dal PDF del proprietario.
  Il PDF ricompresso da 21 MB a 1 MB è `assets/menu-bar-tabacchi-fiftynine.pdf`.
- **Le offerte** (`#offerte`, dall'8 settembre 2026): le locandine esposte nel
  locale, mostrate **intere** — si leggono, quindi non stanno dentro `.foto`
  che ritaglia, ma dentro `.locandina` che non ritaglia e non ha parallasse.
  Il prezzo è scritto anche in testo sotto ogni foto: una locandina fotografata
  non la legge uno screen reader, e su un telefono stretto nemmeno gli altri.

## ⚠️ Gli orari non sono una fascia sola

Dalla locandina del locale (`assets/img/insegna-orari.jpg`):

| | |
|---|---|
| Lunedì | 5:50 – 19:30 |
| Martedì – sabato | 5:30 – 21:30 |
| Domenica | 7:00 – 21:30 |

**Nessun giorno di chiusura.** Prima dell'8 settembre 2026 il sito diceva
«5:30–21:30» tutti i giorni e il giorno di chiusura era dato per ignoto: la
locandina ha chiuso il buco.

**Dal 16 settembre 2026 gli orari stanno scritti in un posto solo**: la lista
`.orari-lista` in `#dove`, dentro `<!-- @orari settimana -->`. Ogni `<li>` porta
`data-giorni` (0 = domenica come `getDay()`) e due `<time datetime="HH:MM">`;
un giorno senza `<time>` è chiuso. Lo script in fondo a `index.html` costruisce
`ORARI` leggendo quella lista — la tabella a mano non c'è più — e riscrive le
due tappe agli estremi della linea del giorno con le ore di oggi; se oggi è
chiuso dice «riapre <giorno> alle …». La nota sotto la lista (`@orari nota`) e
la riga nel footer delle due pagine (`@orari piede`) le rigenera la pagina di
modifica dallo stesso modello a sette giorni. Restano testo libero, fra le
scritte: la frase di apertura nell'hero e la `meta description`. La locandina
è una foto e si cambia dalla sezione «Gli orari» della pagina di modifica.

## La pagina di modifica (`admin.html`)

Dall'8 settembre 2026. `noindex`, non linkata da nessuna pagina pubblica.
Da lì il proprietario cambia **le foto**, **le locandine delle offerte**,
**tutto il menù scritto**, prezzi compresi, e dal 16 settembre 2026 **gli orari**
giorno per giorno e **le scritte**, cioè i paragrafi marcati e le due
descrizioni per Google.

**Non c'è un database.** Lo store sono i file del sito: ogni pezzo
modificabile sta fra due commenti e si riscrive solo quello. **Dal 23 settembre
2026 la pagina pubblica da sola** («le modifiche devono andare direttamente
online», Nicola, bocciando la versione che scriveva sul disco o dava i file da
scaricare): legge i file dal repo e ci rimanda quelli nuovi attraverso
`netlify/functions/pubblica.mjs`, che fa un commit; Netlify lo vede e rimette
online il sito in un minuto circa.

| Marcatore | Cosa contiene | Cosa si può fare |
|---|---|---|
| `<!-- @scatto <nome> -->` | le foto dentro un mosaico tarato a mano | cambiare la foto e la descrizione, **non** aggiungere o togliere |
| `<!-- @galleria offerte -->` | le locandine di `#offerte` | tutto: aggiungere, modificare, togliere |
| `<!-- @menu <nome> -->` | un listino (`<li>` uniformi) | tutto |
| `<!-- @orari settimana -->`, `nota`, `piede` | la lista dei giorni in `#dove`, la nota sotto, la riga nel footer di tutte e due le pagine | si rigenerano dal modello a sette giorni: ore di apertura e chiusura, o chiuso |
| `<!-- @scritta <nome> -->` | un paragrafo, `<strong>` e `<br>` compresi | il testo, con `**grassetto**` al posto di `<strong>` e l'a capo al posto di `<br>`; l'etichetta in italiano sta in `ETICHETTE_SCRITTE` |
| `<!-- @conto pizze -->` | il numero accanto a «Pizze» in `menu.html` | niente: si ricalcola dalle due liste di pizze a ogni salvataggio |

La `meta description` delle due pagine è una scritta anche lei, ma la si trova
con un'espressione (`DESCRIZIONE`), perché dentro un attributo un commento HTML
non ci sta. Nelle scritte le entità diverse da `& < >` non si toccano: nei
paragrafi marcati oggi non ce ne sono, e se qualcuno ne mette una il giro
completo non torna identico e `prova-admin` lo dice.

La forma di una voce di listino è fissa e il codice ci conta:
`<li[ class="casa"]><div><b>Nome</b>[<small>descrizione</small>]</div><em>prezzo</em></li>`.

### Come pubblica (`netlify/functions/pubblica.mjs`, `/api/pubblica`)

- **GET** dà le due pagine come stanno nel repo e il commit da cui partono;
  **POST** riceve le pagine nuove e le foto e fa **un commit solo** (Git Data
  API: blob, albero, commit, ref). Si legge dal repo e **mai dal sito**: Netlify
  rielabora l'HTML che serve — i link a `menu.html` diventano `/menu`, ci
  inietta un commento e uno script suo — e riscrivere quella versione
  sporcherebbe il repo a ogni salvataggio.
- **Tre impostazioni su Netlify**, messe da Nicola e mai nel repo:
  `ADMIN_PASSWORD`, `GITHUB_TOKEN` (fine-grained, solo
  questo repo, «Contents: read and write»), `GITHUB_REPO` (`owner/nome` del repo
  collegato a Netlify; se Netlify espone `REPOSITORY_URL` la funzione usa
  quello). Ne manca una: risponde 503 e non pubblica
  niente. **Si fallisce chiusi.** Cambiate le impostazioni serve un nuovo deploy.
- **La parola d'ordine è un permesso limitato**: fuori dai pezzi marcati (e dalle
  due `meta`, descrizione e versione) la pagina deve restare **identica al
  byte**, e dentro non può comparire codice (`<script`, `on…=`, `javascript:`,
  `iframe`…) che prima non c'era. Pagine ammesse: solo `index.html` e
  `menu.html`; foto: solo `assets/img/<slug>-<13 cifre>.jpg`, jpeg veri, massimo
  12 per volta e 1,5 MB l'una. Tutto il resto: 400, 413 o 422, e nessun commit.
- **Nessuno scrive sopra al lavoro di un altro**: la pagina manda il commit da
  cui è partita; se nel frattempo il ramo si è mosso (Nicola ha pushato, un'altra
  scheda ha pubblicato) risponde 409 e il proprietario ricarica. Il ref si
  aggiorna con `force: false`, seconda linea di difesa se il ramo si muove
  proprio durante la pubblicazione.
- La parola d'ordine sta in `sessionStorage`, non in `localStorage`: vale finché
  la scheda è aperta e nessun'altra scheda dello stesso sito la legge —
  `index.html` carica GSAP da un CDN, cioè codice di altri sulla stessa origine.
- **«È online» è misurato, non promesso**: a ogni pubblicazione la pagina
  riscrive `<meta name="versione">` in `index.html` e guarda il sito vero ogni
  4 secondi finché non la porta. Dopo tre minuti dice che non si è ancora
  aggiornato, invece di dire «fatto».
- **`prova-pubblica.mjs`** è il controllo della funzione: `node
  prova-pubblica.mjs` dalla radice, GitHub finto in memoria, 30 asserzioni —
  parola sbagliata, impostazioni mancanti, conflitti, scritture fuori dai pezzi
  marcati, script, foto sbagliate. Si rilancia ogni volta che si tocca la
  funzione. Provata anche contro sé stessa: togliendo ciascun controllo, la
  prova lo nota.
- **Scappamento doppio**: nel testo l'apice dritto resta com'è (`'nduja`,
  `d'oliva` stanno nel menù), negli attributi si chiude. Senza questa
  distinzione ogni salvataggio riscriveva quarantaquattro righe di pizze
  per niente, e il diff diventava illeggibile.
- Le foto si rimpiccioliscono in canvas prima di essere scritte: lato lungo
  1100px, **jpeg** 0.8 — non webp, che su Safari il canvas non codifica in modo
  affidabile. Nome `<slug>-<timestamp>.jpg`: mai due volte lo stesso, perché
  `assets/img/*` è servito `immutable`.

**`prova-admin.html`** è il controllo: 42 asserzioni sulla lettura e la
riscrittura delle regioni, fra cui il giro completo che deve lasciare i file
**identici al byte**. Si apre da `http://`, non con un doppio clic. Se si tocca
`admin.js`, si riapre quella pagina prima di committare.

## ⚠️ Cose aperte

0. **La parola d'ordine è provvisoria e debole**, per scelta di Nicola il 23
   settembre 2026: «per adesso [...] e poi la cambiamo quando daremo davvero
   tutto in mano al cliente». Il valore non sta qui (il repo è pubblico): sta
   in `ADMIN_PASSWORD` su Netlify. **Prima di dare la pagina al proprietario si
   cambia lì, poi un nuovo deploy.** Finché resta così, chi indovina la parola
   può cambiare testi, prezzi e foto del sito — non script né altre parti: i
   controlli della funzione restano quelli.

1. **La pubblicazione vera non è ancora stata fatta**: la funzione è provata
   con GitHub finto, e il corpo che produce il browser è passato dalla funzione
   vera con esito 200 — ma finché su Netlify non ci sono le tre impostazioni
   risponde 503. Il primo giro vero va fatto da Nicola, con un prezzo di prova.
2. **Safari su iPhone mai provato**: orientamento EXIF delle foto e la
   codifica jpeg del canvas.
3. **La locandina degli orari si cambia dalla sezione «Gli orari»**, non fra
   le foto, con l'avviso che se cambiano le ore deve cambiare anche lei. Il
   rischio resta: chi cambia gli orari e non la foto, o non rilegge la frase di
   apertura e la descrizione per Google, pubblica una pagina che si contraddice.
   La pagina di modifica lo scrive, non lo impedisce.
4. **Le foto della colazione, i frittini e i gyoza restano quelle di Instagram
   a 640px**: sulla chiavetta del proprietario non c'era niente per quelle
   sezioni. Vanno chieste a lui.
5. **Il sito è `noindex` su tre livelli** (`meta robots`, `X-Robots-Tag` in
   `netlify.toml`, `robots.txt`): è una bozza col marchio di un'azienda che non
   è ancora cliente. Quando diventa loro si tolgono i primi tre sbarramenti —
   **`admin.html` resta `noindex`**, ha una sua regola apposta in `netlify.toml`.

## Regole di lavoro

Come gli altri siti vetrina: **si misura, non si guarda** (`getBoundingClientRect`,
`getComputedStyle` su viewport emulati), commit col perché in italiano, e
`01-Coding/trappole.md` del vault si legge prima di scrivere, non dopo.
Il pannello del browser dipinge solo il primo frame dopo il load: uno screenshot
dopo lo scroll fotografa il nulla.
