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

**Non c'è un database e non c'è un login.** Lo store sono i file del sito:
ogni pezzo modificabile sta fra due commenti e si riscrive solo quello.

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

- La pagina **non è un'area riservata** perché da lì non si scrive sul server:
  si scrive solo sul disco di chi la apre. Due strade, decide il browser e non
  l'utente: con la File System Access API (Chrome/Edge da computer) scrive da sé
  nella cartella del sito; senza (Safari, iPhone) consegna gli stessi file da
  scaricare. In tutti e due i casi **va online solo con un commit**.
- `showDirectoryPicker` va chiamato **per primo** dentro il gestore del click,
  prima di qualunque `await`: dopo, l'attivazione utente è scaduta.
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

1. **La cartella del picker non è mai stata provata davvero.** Serve un gesto e
   un permesso veri; nel pannello del browser parte sempre il ramo dei download.
   Va provato a mano su Chrome da computer prima di dirlo al proprietario.
2. **Safari su iPhone mai provato**: orientamento EXIF delle foto e i download
   di fila.
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
