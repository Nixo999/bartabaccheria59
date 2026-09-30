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

Il sito online è **https://bartabacchi59.netlify.app**, collegato a GitHub: ogni
push si vede in una decina di secondi.

⚠️ **Le modifiche del proprietario non stanno nel repo**: stanno nell'archivio di
Netlify (Blobs) e le rimette nella pagina una edge function a ogni visita (vedi
«Come pubblica»). Il repo resta la struttura; il contenuto dei pezzi che il
proprietario ha toccato sul sito è il suo, anche se nel repo è diverso.

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

- **Avviso cookie** (dal 30 settembre 2026, chiesto da Nicola per tutti i siti su
  un dominio loro): `assets/cookie.js`, incluso in fondo a `index.html` e
  `menu.html` fuori dai pezzi marcati, stile `.cookie` in coda a `stile.css`.
  Accetta o Rifiuta, la scelta sta in `localStorage` come
  `fiftynine-cookie-consent` (`accepted` / `rejected`). Il sito non ha cookie di
  analisi: oggi la scelta non accende niente, e Google Fonts e jsDelivr partono
  comunque da remoto. Chi aggiunge un'analisi la fa partire solo con `accepted`, e
  allora servono anche la pagina dell'informativa e un link per riaprire la
  scelta, che oggi non ci sono.

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
scaricare) e, dopo un giro col commit su GitHub bocciato lo stesso giorno,
senza chiavi: i pezzi cambiati vanno nell'archivio di Netlify e sono online
subito. Il dettaglio sta in «Come pubblica», qui sotto.

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

### Come pubblica — Netlify Blobs, senza chiavi (dal 23 settembre 2026)

«Non voglio passare per Netlify» (Nicola): la strada col commit su GitHub
chiedeva una chiave da creare e incollare su Netlify, ed è stata bocciata.
Adesso non c'è **niente da configurare**: Netlify dà l'archivio (Blobs) alle sue
funzioni da solo.

- **`netlify/functions/pubblica.mjs`** (`/api/pubblica`): `GET` con la parola
  d'ordine dà la versione pubblicata; `POST {azione:'pubblica', base, pagine,
  foto}` salva **solo i pezzi marcati cambiati** (`pagine['menu.html'].regioni
  ['menu pizze']`), la descrizione se è cambiata, e le foto nuove come
  `foto/<slug>-<13 cifre>.jpg`; `POST {azione:'parola', nuova}` cambia la parola.
- **`netlify/edge-functions/pagine.mjs`** su `/`, `/index.html`, `/menu`,
  `/menu.html`: prende la pagina del repo così come Netlify la serve e ci mette
  dentro i pezzi dell'archivio; su `/foto/*` serve le foto dell'archivio.
  **Qualunque errore, si serve la pagina del repo com'è**: una modifica che non
  arriva è meglio di una home che non si apre. Online vuol dire subito, senza
  deploy: la pagina di modifica guarda il sito finché non porta la versione
  nuova in `<meta name="versione">`.
- La pagina di modifica **legge le pagine dal sito**, non dal repo: sono quelle
  con dentro le modifiche già fatte. Netlify ci rielabora un paio di link e ci
  inietta uno script, ma fuori dai pezzi marcati, e alla funzione arrivano solo
  i pezzi.
- **La parola d'ordine**: all'inizio è `PAROLA_INIZIALE` nel codice (scelta di
  Nicola, provvisoria). Si cambia dalla pagina di modifica, sezione «La parola
  d'ordine»: la nuova si salva come impronta scrypt, mai in chiaro, e da lì
  quella iniziale non vale più. Persa la nuova: si cambia `AZZERA_PAROLA` nel
  codice e si pubblica, e torna valida quella iniziale.
- **La parola d'ordine è un permesso limitato**: nei pezzi non passano
  `<script`, `on…=`, `javascript:`, `iframe`/`object`/`embed`, né `<!--` (un
  pezzo non deve poter chiudere il suo marcatore); si scrivono solo i sei tipi
  di pezzo e le due pagine; foto solo jpeg veri, massimo 12 per volta e 1,5 MB
  l'una; la descrizione senza virgolette né tag. Se la versione è cambiata dopo
  la lettura risponde 409: non si scrive sopra al lavoro di un altro.
- **`prova-pubblica.mjs`**: `npm install`, poi `node prova-pubblica.mjs`. Usa
  `BlobsServer`, l'archivio che Netlify usa in locale, quindi il protocollo è
  quello vero; funzione, edge function e pagine sono quelle vere. 43
  asserzioni, e togliendo a turno ogni protezione la prova lo nota. Si
  rilancia ogni volta che si toccano le due funzioni.

## ⚠️ Cose aperte

0. **La parola d'ordine iniziale è debole e sta nel codice pubblico**
   (`PAROLA_INIZIALE`), per scelta di Nicola il 23 settembre 2026: «per adesso
   [...] e poi la cambiamo quando daremo davvero tutto in mano al cliente».
   Chiunque legge il repo la conosce. **Prima di dare la pagina al proprietario
   la si cambia dalla pagina stessa.** Finché resta così, chi la usa può
   cambiare testi, prezzi e foto — non script né altre parti.
1. **La pubblicazione vera sul sito online non è ancora stata fatta**: provata
   con `BlobsServer` e con il corpo prodotto dal browser passato dalla funzione e
   dalla edge function vere. Il primo giro vero lo fa Nicola entrando con la
   parola iniziale.
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
