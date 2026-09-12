/* PDP upsell carousel: arrow paging + arrow visibility. One handler per
   carousel so several can live on the same page. */
(function () {
  function init(root) {
    var track = root.querySelector("[data-upsell-track]");
    var prev = root.querySelector("[data-upsell-prev]");
    var next = root.querySelector("[data-upsell-next]");
    if (!track || !prev || !next) return;

    function page(dir) {
      var card = track.querySelector(".pdp-upsell-card");
      var step = card ? card.offsetWidth + 16 : track.clientWidth * 0.8;
      track.scrollBy({ left: dir * step * 2, behavior: "smooth" });
    }

    function sync() {
      var max = track.scrollWidth - track.clientWidth;
      // 2px slack so sub-pixel scroll widths don't leave a dead arrow showing.
      prev.hidden = track.scrollLeft <= 2;
      next.hidden = max <= 2 || track.scrollLeft >= max - 2;
    }

    prev.addEventListener("click", function () { page(-1); });
    next.addEventListener("click", function () { page(1); });
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  function boot() {
    document.querySelectorAll("[data-pdp-upsell]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
