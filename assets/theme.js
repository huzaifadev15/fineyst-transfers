document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.mega-tabs').forEach(function (tabBar) {
    var panelGroup = tabBar.parentElement;
    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.mega-tab-btn');
      if (!btn) return;
      var target = btn.getAttribute('data-mega-tab');

      tabBar.querySelectorAll('.mega-tab-btn').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      panelGroup.querySelectorAll('.mega-tab-panel').forEach(function (panel) {
        panel.classList.toggle('is-active', panel.getAttribute('data-mega-panel') === target);
      });
    });
  });

  document.querySelectorAll('.product-gallery').forEach(function (gallery) {
    var main = gallery.querySelector('[data-gallery-main]');
    if (!main) return;

    // Slides can be images, videos or model viewers, so page by showing and
    // hiding whole slides rather than swapping a single <img> source.
    var slides = Array.from(main.querySelectorAll('[data-gallery-slide]'));
    var thumbs = Array.from(gallery.parentElement.querySelectorAll('[data-gallery-thumb]'));
    if (slides.length < 2) return;

    var index = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
    if (index < 0) index = 0;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, si) {
        var on = si === index;
        s.classList.toggle('is-active', on);
        // Stop a video that scrolls out of view so audio never overlaps.
        if (!on) {
          var v = s.querySelector('video');
          if (v && typeof v.pause === 'function') v.pause();
        }
      });
      thumbs.forEach(function (t, ti) { t.classList.toggle('is-active', ti === index); });
    }

    thumbs.forEach(function (thumb, ti) {
      thumb.addEventListener('click', function () { show(ti); });
    });

    var next = gallery.querySelector('.gallery-arrow--next');
    var prev = gallery.querySelector('.gallery-arrow--prev');
    if (next) next.addEventListener('click', function () { show(index + 1); });
    if (prev) prev.addEventListener('click', function () { show(index - 1); });
  });

  document.querySelectorAll('[data-delivery]').forEach(function (el) {
    var dateEl = el.querySelector('[data-delivery-date]');
    var countdownEl = el.querySelector('[data-delivery-countdown]');
    var cutoffHour = parseInt(el.getAttribute('data-cutoff-hour'), 10);
    if (isNaN(cutoffHour)) cutoffHour = 17;
    var months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

    function render() {
      var now = new Date();
      var deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutoffHour, 0, 0, 0);
      if (deadline <= now) deadline.setDate(deadline.getDate() + 1);

      var ship = new Date(deadline);
      ship.setDate(ship.getDate() + 1);
      if (ship.getDay() === 0) ship.setDate(ship.getDate() + 1);

      var minutesLeft = Math.max(0, Math.round((deadline - now) / 60000));
      var hours = Math.floor(minutesLeft / 60);
      var minutes = minutesLeft % 60;

      if (dateEl) dateEl.textContent = months[ship.getMonth()] + ' ' + ship.getDate();
      if (countdownEl) countdownEl.textContent = hours > 0 ? hours + 'h ' + minutes + 'm' : minutes + 'm';
    }

    render();
    setInterval(render, 30000);
  });

  document.querySelectorAll('[data-ai-toggle]').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var pressed = toggle.getAttribute('aria-pressed') === 'true';
      toggle.setAttribute('aria-pressed', String(!pressed));

      if (toggle.getAttribute('data-controls') === 'bg-options') {
        var tool = toggle.closest('[data-rail-tool]');
        var options = tool && tool.querySelector('[data-bg-options]');
        if (tool) tool.classList.toggle('rail-tool--open', !pressed);
        if (options) options.hidden = pressed;
      }
    });
  });

  document.querySelectorAll('.pdp').forEach(function (pdp) {
    var dropzone = pdp.querySelector('[data-upload-dropzone]');
    var editor = pdp.querySelector('[data-editor]');
    if (!dropzone) return;

    var input = dropzone.querySelector('[data-upload-input]');
    var browseBtn = dropzone.querySelector('[data-upload-browse]');
    var fileList = dropzone.querySelector('[data-upload-file-list]');
    var artworkUrl = null;
    var artRatio = 1;

    function renderFiles(files) {
      if (!fileList) return;
      fileList.innerHTML = '';
      Array.from(files).forEach(function (file) {
        var li = document.createElement('li');
        li.textContent = file.name;
        fileList.appendChild(li);
      });
    }

    function formatInches(value) {
      return parseFloat(value.toFixed(2)) + '"';
    }

    // "1-9:0.37, 10-19:1.09, ..." — base price per band of whole square inches.
    function parseBands(raw) {
      return (raw || '').split(',').reduce(function (bands, entry) {
        var parts = entry.trim().split(':');
        var range = (parts[0] || '').split('-');
        var min = parseFloat(range[0]);
        var max = parseFloat(range[1]);
        var price = parseFloat(parts[1]);
        if (!isNaN(min) && !isNaN(price)) {
          bands.push({ min: min, max: isNaN(max) ? Infinity : max, price: price });
        }
        return bands;
      }, []);
    }

    function money(value) {
      return '$' + value.toFixed(2);
    }

    // Rounds up to the cent, matching the source calculator. Trim float noise
    // first: 1.09 * 100 is 109.00000000000001, which would ceil to $1.10.
    function discounted(base, pct) {
      return Math.ceil(Number((base * (1 - pct / 100) * 100).toFixed(6))) / 100;
    }

    function basePrice(widthIn, heightIn) {
      var table = editor && editor.querySelector('[data-tiers]');
      if (!table) return 0;
      var bands = parseBands(table.getAttribute('data-bands'));
      if (!bands.length) return 0;
      // Area rounds up to the next whole square inch before the band lookup.
      var area = Math.ceil(widthIn * heightIn);
      var band = bands.filter(function (b) { return area >= b.min && area <= b.max; })[0];
      return (band || bands[bands.length - 1]).price;
    }

    function priceArtwork(widthIn, heightIn) {
      var base = basePrice(widthIn, heightIn);
      if (!base) return;
      editor.querySelectorAll('[data-tier]').forEach(function (tier) {
        var target = tier.querySelector('[data-tier-price]');
        if (!target) return;
        target.textContent = money(discounted(base, parseFloat(tier.getAttribute('data-pct')) || 0));
      });
    }

    function sizeArtwork(naturalWidth, naturalHeight) {
      if (!editor || !naturalWidth || !naturalHeight) return;
      var dpi = parseFloat(editor.getAttribute('data-dpi')) || 300;
      var maxWidth = parseFloat(editor.getAttribute('data-max-width')) || 22;
      artRatio = naturalWidth / naturalHeight;
      var widthIn = naturalWidth / dpi;
      if (widthIn > maxWidth) widthIn = maxWidth;
      var heightIn = widthIn / artRatio;

      var dimW = editor.querySelector('[data-dim-w]');
      var dimH = editor.querySelector('[data-dim-h]');
      if (dimW) dimW.textContent = formatInches(widthIn);
      if (dimH) dimH.textContent = formatInches(heightIn);

      priceArtwork(widthIn, heightIn);
      resetSizeRows(widthIn, heightIn);

      editor.querySelectorAll('[data-mockup]').forEach(function (mockup) {
        var label = mockup.querySelector('[data-mockup-size]');
        var w = parseFloat(mockup.getAttribute('data-width-in'));
        if (!label || !w) return;
        label.textContent = formatInches(w) + ' x ' + formatInches(w / artRatio);
      });
    }

    function openEditor(file) {
      if (!editor || !file || file.type.indexOf('image/') !== 0) return;
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
      artworkUrl = URL.createObjectURL(file);

      editor.querySelectorAll('[data-canvas-art], [data-option-art], [data-mockup-art]').forEach(function (img) {
        img.src = artworkUrl;
      });

      var probe = new Image();
      probe.onload = function () { sizeArtwork(probe.naturalWidth, probe.naturalHeight); };
      probe.src = artworkUrl;

      // The background-removal variants resolve one after another.
      editor.querySelectorAll('[data-rail-option]').forEach(function (option, index) {
        if (index === 0) return;
        option.classList.add('is-loading');
        setTimeout(function () { option.classList.remove('is-loading'); }, 700 + index * 600);
      });

      pdp.classList.add('is-editing');
      editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function closeEditor() {
      pdp.classList.remove('is-editing');
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
      artworkUrl = null;
      if (input) input.value = '';
      if (fileList) fileList.innerHTML = '';
      if (editor) {
        editor.querySelectorAll('[data-canvas-art], [data-option-art], [data-mockup-art]').forEach(function (img) {
          img.removeAttribute('src');
        });
      }
    }

    function handleFiles(files) {
      if (!files || !files.length) return;
      renderFiles(files);
      openEditor(files[0]);
    }

    if (browseBtn && input) {
      browseBtn.addEventListener('click', function () { input.click(); });
      dropzone.addEventListener('click', function (e) {
        if (e.target === dropzone) input.click();
      });
      input.addEventListener('change', function () { handleFiles(input.files); });
    }

    ['dragenter', 'dragover'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        if (input) input.files = e.dataTransfer.files;
        handleFiles(e.dataTransfer.files);
      }
    });

    if (!editor) return;

    editor.querySelector('[data-canvas-delete]')?.addEventListener('click', closeEditor);

    editor.querySelector('[data-canvas-zoom]')?.addEventListener('click', function () {
      editor.querySelector('[data-canvas]').classList.toggle('is-zoomed');
    });

    editor.querySelectorAll('[data-rail-option]').forEach(function (option) {
      option.addEventListener('click', function () {
        editor.querySelectorAll('[data-rail-option]').forEach(function (o) {
          o.classList.toggle('is-active', o === option);
        });
      });
    });

    var morePanel = editor.querySelector('[data-rail-more-panel]');
    editor.querySelector('[data-rail-more]')?.addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      if (morePanel) morePanel.hidden = expanded;
    });

    var stage = editor.querySelector('[data-preview-stage]');
    editor.querySelectorAll('[data-swatch]').forEach(function (swatch) {
      swatch.addEventListener('click', function () {
        editor.querySelectorAll('[data-swatch]').forEach(function (s) {
          s.classList.toggle('is-active', s === swatch);
        });
        if (stage) stage.style.setProperty('--preview-color', swatch.getAttribute('data-color') || '#fff');
      });
    });

    // --- Step 2: transfer sizes ---
    var sizeStep = editor.querySelector('[data-sizes]');
    var sizeRows = editor.querySelector('[data-size-rows]');
    var sizeTemplate = editor.querySelector('[data-size-template]');

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    // Total pieces across every size row — this is what earns the volume tier.
    function orderQty() {
      var total = 0;
      editor.querySelectorAll('[data-size-qty]').forEach(function (input) {
        total += parseInt(input.value, 10) || 0;
      });
      if (total > 0) return total;
      var fallback = parseInt(qtyInput && qtyInput.value, 10);
      if (fallback) return fallback;
      return parseInt(tierTable && tierTable.getAttribute('data-qty'), 10) || 1;
    }

    function activePct() {
      var qty = orderQty();
      var pct = 0;
      editor.querySelectorAll('[data-tier]').forEach(function (tier) {
        var min = parseInt(tier.getAttribute('data-min'), 10) || 0;
        var max = parseInt(tier.getAttribute('data-max'), 10) || 0;
        if (qty >= min && (max === 0 || qty <= max)) pct = parseFloat(tier.getAttribute('data-pct')) || 0;
      });
      return pct;
    }

    function recalcSizes() {
      if (!sizeRows) return;
      var pct = activePct();

      sizeRows.querySelectorAll('[data-size-row]').forEach(function (row) {
        var w = parseFloat(row.querySelector('[data-size-w]').value) || 0;
        var h = parseFloat(row.querySelector('[data-size-h]').value) || 0;
        var qty = parseInt(row.querySelector('[data-size-qty]').value, 10) || 0;
        var base = w && h ? basePrice(w, h) : 0;
        var each = discounted(base, pct);

        row.querySelector('[data-size-price]').textContent = base ? money(each) : '—';
        row.querySelector('[data-size-total]').textContent = base ? money(each * qty) : '—';
        row.querySelector('[data-size-was]').textContent = base && pct ? money(base) : '';
        row.querySelector('[data-size-total-was]').textContent = base && pct ? money(base * qty) : '';
        row.querySelector('[data-size-off]').textContent = pct ? pct + '% off' : '';
      });

      sizeRows.toggleAttribute('data-single', sizeRows.children.length < 2);
      if (tierTable) renderTiers();
    }

    function addSizeRow(widthIn, heightIn, qty) {
      if (!sizeRows || !sizeTemplate) return;
      var row = sizeTemplate.content.firstElementChild.cloneNode(true);
      var wInput = row.querySelector('[data-size-w]');
      var hInput = row.querySelector('[data-size-h]');
      var min = parseFloat(wInput.min) || 0.25;
      var max = parseFloat(wInput.max) || 22;

      wInput.value = clamp(widthIn, min, max).toFixed(2);
      hInput.value = clamp(heightIn, min, max).toFixed(2);
      row.querySelector('[data-size-qty]').value = qty || 1;

      // Width and height stay locked to the artwork's proportions.
      wInput.addEventListener('input', function () {
        var w = parseFloat(wInput.value);
        if (w > 0) hInput.value = clamp(w / artRatio, min, max).toFixed(2);
        recalcSizes();
      });
      hInput.addEventListener('input', function () {
        var h = parseFloat(hInput.value);
        if (h > 0) wInput.value = clamp(h * artRatio, min, max).toFixed(2);
        recalcSizes();
      });
      row.querySelector('[data-size-qty]').addEventListener('input', recalcSizes);
      row.querySelector('[data-size-remove]').addEventListener('click', function () {
        if (sizeRows.children.length < 2) return;
        row.remove();
        recalcSizes();
      });

      sizeRows.appendChild(row);
      recalcSizes();
    }

    function resetSizeRows(widthIn, heightIn) {
      if (!sizeRows) return;
      sizeRows.innerHTML = '';
      addSizeRow(widthIn, heightIn, 1);
    }

    if (sizeStep) {
      editor.querySelector('[data-size-add]')?.addEventListener('click', function () {
        var last = sizeRows.lastElementChild;
        var w = last ? parseFloat(last.querySelector('[data-size-w]').value) : 4;
        addSizeRow(w, w / artRatio, 1);
      });

      sizeStep.querySelectorAll('[data-size-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var target = tab.getAttribute('data-size-tab');
          sizeStep.querySelectorAll('.size-tab').forEach(function (t) {
            t.classList.toggle('is-active', t.getAttribute('data-size-tab') === target);
          });
          sizeStep.querySelectorAll('[data-size-panel]').forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-size-panel') !== target;
          });
        });
      });

      sizeStep.querySelectorAll('[data-popular-size]').forEach(function (preset) {
        preset.addEventListener('click', function () {
          var w = parseFloat(preset.getAttribute('data-width-in'));
          addSizeRow(w, w / artRatio, 1);
          sizeStep.querySelector('[data-size-tab="custom"]').click();
        });
      });
    }

    var notes = editor.querySelector('[data-notes]');
    editor.querySelector('[data-notes-toggle]')?.addEventListener('change', function () {
      if (notes) notes.hidden = !this.checked;
      if (notes && this.checked) notes.focus();
    });

    var tierRows = editor.querySelector('[data-tier-rows]');
    var viewAll = editor.querySelector('[data-tier-viewall]');
    if (viewAll) {
      viewAll.addEventListener('click', function () {
        var expanded = viewAll.getAttribute('aria-expanded') === 'true';
        viewAll.setAttribute('aria-expanded', String(!expanded));
        viewAll.lastChild.textContent = expanded ? ' View All' : ' Show Less';
        if (tierRows) tierRows.classList.toggle('is-open', !expanded);
      });
    }

    var tierTable = editor.querySelector('[data-tiers]');
    if (tierTable) {
      var qtyInput = pdp.querySelector('.pdp-qty input');

      function renderTiers() {
        var qty = orderQty();
        var tiers = Array.from(editor.querySelectorAll('[data-tier]'));
        var activeIndex = tiers.findIndex(function (tier) {
          var min = parseInt(tier.getAttribute('data-min'), 10) || 0;
          var max = parseInt(tier.getAttribute('data-max'), 10) || 0;
          return qty >= min && (max === 0 || qty <= max);
        });
        if (activeIndex < 0) activeIndex = 0;

        tiers.forEach(function (tier, index) {
          var active = index === activeIndex;
          tier.classList.toggle('is-active', active);
          // Tiers the order has already passed collapse behind "View All".
          tier.classList.toggle('is-below', index < activeIndex);

          var hint = tier.querySelector('[data-tier-hint]');
          if (!hint) return;
          var next = tiers[index + 1];
          if (active && next) {
            var nextMin = parseInt(next.getAttribute('data-min'), 10) || 0;
            var nextLabel = next.querySelector('.tier-discount').textContent.trim();
            hint.textContent = 'Add ' + Math.max(nextMin - qty, 1) + ' of this design or your next upload to reach ' + nextLabel + ' savings.';
            hint.hidden = false;
          } else {
            hint.hidden = true;
          }
        });

        if (viewAll) viewAll.hidden = activeIndex === 0;
      }

      renderTiers();
      if (qtyInput) qtyInput.addEventListener('input', renderTiers);
    }
  });
});

/* ================= HEADER BEHAVIOURS (ported from Fineyst Patches) ================= */
document.addEventListener('DOMContentLoaded', function () {

  /* --- Measure the fixed header so content clears it ---
     The announcement bar wraps to two lines on narrow screens, so the offset
     can't be a fixed number. Publishes --header-offset and --nav-bottom. */
  (function () {
    var header = document.querySelector('.site-header');
    var navbar = document.querySelector('.navbar-bg');
    if (!header || !navbar) return;

    function measure() {
      var wasHidden = header.classList.contains('header-hidden');
      if (wasHidden) header.classList.remove('header-hidden');

      // The header is position:fixed, so these rects are already viewport
      // relative and constant. Adding scrollY here would inflate the offset by
      // however far the page happened to be scrolled when measure() re-ran.
      var navBottom = navbar.getBoundingClientRect().bottom;
      var capsule = header.querySelector('.capsule-tabs-wrap');
      var bottom = capsule
        ? capsule.getBoundingClientRect().bottom
        : navBottom;

      var root = document.documentElement;
      root.style.setProperty('--nav-bottom', Math.round(navBottom) + 'px');
      root.style.setProperty('--header-offset', Math.round(bottom + 8) + 'px');

      if (wasHidden) header.classList.add('header-hidden');
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  })();

  /* --- Mobile sidebar --- */
  var sidebar = document.getElementById('mobileSidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var openBtn = document.getElementById('mobileMenuOpen');
  var closeBtn = document.getElementById('mobileMenuClose');

  function setSidebar(open) {
    if (!sidebar || !overlay) return;
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (openBtn) openBtn.addEventListener('click', function () { setSidebar(true); });
  if (closeBtn) closeBtn.addEventListener('click', function () { setSidebar(false); });
  if (overlay) overlay.addEventListener('click', function () { setSidebar(false); });

  /* --- Capsule tab bar: arrow scroll --- */
  var tabsScroll = document.getElementById('capsuleTabsScroll');
  var tabsArrow = document.getElementById('capsuleTabArrow');
  if (tabsScroll && tabsArrow) {
    tabsArrow.addEventListener('click', function () {
      tabsScroll.scrollBy({ left: 160, behavior: 'smooth' });
    });
  }

  /* --- Search overlay --- */
  (function () {
    var searchOverlay = document.getElementById('searchOverlay');
    var input = document.getElementById('searchInput');
    var toggleBtn = document.getElementById('searchToggleBtn');
    var closeSearchBtn = document.getElementById('searchCloseBtn');
    var submitBtn = document.getElementById('searchSubmitBtn');
    var resultsEl = document.getElementById('searchResults');
    var tabAll = document.getElementById('tabAll');
    var tabProducts = document.getElementById('tabProducts');
    var tabPages = document.getElementById('tabPages');
    if (!searchOverlay || !input || !toggleBtn) return;

    var allResults = [];
    var activeFilter = 'all';
    var debounceTimer = null;

    function openSearch() {
      searchOverlay.classList.add('open');
      searchOverlay.setAttribute('aria-hidden', 'false');
      setTimeout(function () { input.focus(); }, 50);
    }
    function closeSearch() {
      searchOverlay.classList.remove('open');
      searchOverlay.setAttribute('aria-hidden', 'true');
    }
    function goToSearch() {
      if (input.value.trim()) {
        window.location.href = '/search?q=' + encodeURIComponent(input.value.trim()) + '&type=product,page';
      }
    }

    toggleBtn.addEventListener('click', openSearch);
    if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);
    if (submitBtn) submitBtn.addEventListener('click', goToSearch);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearch(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') goToSearch(); });

    [tabAll, tabProducts, tabPages].forEach(function (tab) {
      if (!tab) return;
      tab.addEventListener('click', function () {
        activeFilter = tab.dataset.filter;
        [tabAll, tabProducts, tabPages].forEach(function (t) { if (t) t.classList.remove('active'); });
        tab.classList.add('active');
        renderResults();
      });
    });

    function pageIcon() {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }

    function renderResults() {
      var filtered = allResults.filter(function (r) {
        return activeFilter === 'all' || r.type === activeFilter;
      });
      if (!filtered.length) {
        resultsEl.innerHTML = '<div class="search-empty">No results found.</div>';
        return;
      }
      resultsEl.innerHTML = filtered.map(function (r) {
        var iconHtml = r.image ? '<img src="' + r.image + '" alt="' + r.title + '">' : pageIcon();
        var desc = r.body ? r.body.replace(/<[^>]+>/g, '').substring(0, 90) + '…' : '';
        return '<a href="' + r.url + '" class="search-result-item">'
          + '<div class="search-result-icon">' + iconHtml + '</div>'
          + '<div class="search-result-info">'
            + '<div class="search-result-title">' + r.title + '</div>'
            + (desc ? '<div class="search-result-desc">' + desc + '</div>' : '')
            + '<div class="search-result-type">' + (r.type === 'product' ? 'Product' : 'Page') + '</div>'
          + '</div></a>';
      }).join('');
    }

    function updateTabs(products, pages) {
      if (tabAll) tabAll.textContent = 'All (' + (products + pages) + ')';
      if (tabProducts) tabProducts.textContent = 'Products (' + products + ')';
      if (tabPages) tabPages.textContent = 'Pages (' + pages + ')';
    }

    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      if (!q) {
        allResults = [];
        updateTabs(0, 0);
        resultsEl.innerHTML = '<div class="search-empty">Start typing to search…</div>';
        return;
      }
      debounceTimer = setTimeout(function () {
        fetch('/search/suggest.json?q=' + encodeURIComponent(q) + '&resources[type]=product%2Cpage&resources[limit]=8')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var resources = (data.resources && data.resources.results) || {};
            var products = (resources.products || []).map(function (p) {
              var img = p.featured_image ? p.featured_image.url : (p.image ? p.image.url : null);
              return { type: 'product', title: p.title, url: p.url, image: img, body: p.description || p.body || '' };
            });
            var pages = (resources.pages || []).map(function (p) {
              return { type: 'page', title: p.title, url: p.url, image: null, body: p.body || p.body_html || '' };
            });
            allResults = products.concat(pages);
            updateTabs(products.length, pages.length);
            renderResults();
          })
          .catch(function () { resultsEl.innerHTML = '<div class="search-empty">Something went wrong.</div>'; });
      }, 250);
    });
  })();

  /* --- Hide header on scroll down (mobile only) --- */
  (function () {
    if (window.innerWidth > 768) return;
    var header = document.querySelector('.site-header');
    if (!header) return;
    var lastY = 0;
    window.addEventListener('scroll', function () {
      if (window.innerWidth > 768) return;
      var y = window.scrollY;
      header.classList.toggle('header-hidden', y > lastY && y > 60);
      lastY = y;
    }, { passive: true });
  })();

  /* --- Mega menu tabs (Patches & Stickers) --- */
  document.querySelectorAll('.mega-tabs').forEach(function (tabs) {
    var panelWrap = tabs.parentElement;
    tabs.querySelectorAll('.mega-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-mega-tab');
        tabs.querySelectorAll('.mega-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === tab);
        });
        panelWrap.querySelectorAll('.mega-tab-panel').forEach(function (panel) {
          var isMatch = panel.getAttribute('data-mega-panel') === target;
          panel.classList.toggle('is-active', isMatch);
          panel.hidden = !isMatch;
        });
      });
    });
  });
});
