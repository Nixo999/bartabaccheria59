/* Avviso cookie, lo stesso su index e menu. La scelta sta in localStorage
   ("accepted" / "rejected") e l'avviso non torna. Oggi il sito non ha cookie
   di analisi: chi ne aggiunge uno lo fa partire solo se qui c'e' "accepted".
   ponytail: niente link per riaprire la scelta ne' pagina dell'informativa;
   servono il giorno che arriva un cookie di analisi vero. */
(function(){
  var CHIAVE = "fiftynine-cookie-consent";
  try { if (localStorage.getItem(CHIAVE)) return; } catch (e) { return; }
  var box = document.createElement("div");
  box.className = "cookie";
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "Cookie");
  box.innerHTML =
    "<p>Questo sito usa cookie tecnici. Quelli di analisi partono solo se accetti.</p>" +
    '<div><button type="button" value="rejected">Rifiuta</button>' +
    '<button type="button" value="accepted">Accetta</button></div>';
  box.addEventListener("click", function(e){
    if (!e.target.value) return;
    localStorage.setItem(CHIAVE, e.target.value);
    box.remove();
  });
  document.body.appendChild(box);
})();
