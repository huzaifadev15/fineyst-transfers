/* Rotate the homepage trust-line words, including when Shopify reloads a section. */
(function () {
  function initializeHeroRotators(root) {
    if (!root || !root.querySelectorAll) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    root.querySelectorAll('[data-hero-rotator]').forEach(function (rotator) {
      if (rotator.hasAttribute('data-rotator-initialized')) return;

      var words = (rotator.getAttribute('data-words') || '').split(',').map(function (word) {
        return word.trim();
      }).filter(Boolean);
      if (words.length < 2) return;

      var index = 0;
      rotator.setAttribute('data-rotator-initialized', 'true');
      rotator.textContent = words[index];
      window.setInterval(function () {
        index = (index + 1) % words.length;
        rotator.textContent = words[index];
      }, 2000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initializeHeroRotators(document);
    });
  } else {
    initializeHeroRotators(document);
  }
  document.addEventListener('shopify:section:load', function (event) {
    initializeHeroRotators(event.target);
  });
})();

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
    var artworkUrl = null;
    var originalArtworkFile = null;
    var optionFiles = [];
    var optionUrls = [];
    var activeOptionIndex = 0;
    var backgroundRunId = 0;
    var backgroundReplacementTimer = null;
    var backgroundRemovalModulePromise = null;
    var backgroundModelLoaded = false;
    var backgroundRemovalCache = new Map();
    var backgroundRemovalRequests = new Map();
    var aiBgRemovalEnabled = !!(window.DTF_CONFIG && window.DTF_CONFIG.aiBgRemoval === true);
    var backgroundPanelToggle = editor && editor.querySelector('[data-rail-tool] [data-controls="bg-options"]');
    var backgroundPanel = backgroundPanelToggle && backgroundPanelToggle.closest('[data-rail-tool]');
    var backgroundToggle = aiBgRemovalEnabled && editor && (
      backgroundPanelToggle ||
      pdp.querySelector('[data-ai-toggle][aria-label="Remove background"]')
    );
    var backgroundMessage = null;
    var artRatio = 1;

    if (!aiBgRemovalEnabled) {
      if (backgroundPanel) backgroundPanel.classList.add('bg-removal-disabled');
      pdp.querySelectorAll('.ai-tools-row').forEach(function (row) {
        if (row.querySelector('[data-ai-toggle][aria-label="Remove background"]')) {
          row.classList.add('bg-removal-disabled');
        }
      });
    }

    if (backgroundToggle) {
      backgroundMessage = pdp.querySelector('.bg-msg');
      if (!backgroundMessage) {
        backgroundMessage = document.createElement('span');
        backgroundMessage.className = 'bg-msg';
        backgroundMessage.setAttribute('role', 'status');
        backgroundMessage.setAttribute('aria-live', 'polite');
        var messageAnchor = backgroundToggle.closest('.rail-tool-head') ||
          backgroundToggle.closest('.ai-tools-row') ||
          backgroundToggle.parentElement;
        if (messageAnchor && messageAnchor.parentNode) {
          messageAnchor.parentNode.insertBefore(backgroundMessage, messageAnchor.nextSibling);
        }
      }
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

    function isBackgroundEnabled() {
      return aiBgRemovalEnabled &&
        !!backgroundToggle &&
        backgroundToggle.getAttribute('aria-pressed') === 'true';
    }

    function setBackgroundMessage(message, isError) {
      if (!backgroundMessage) return;
      backgroundMessage.textContent = message || '';
      backgroundMessage.classList.toggle('is-error', !!isError);
    }

    function setSpinnerProgress(current, total) {
      var progress = total > 0 && isFinite(current)
        ? Math.round(current / total * 100) + '%'
        : '';
      editor.querySelectorAll('[data-rail-option]').forEach(function (option, index) {
        var spinner = option.querySelector('.rail-spinner');
        if (!spinner) return;
        if (index === activeOptionIndex && progress) spinner.setAttribute('data-progress', progress);
        else spinner.removeAttribute('data-progress');
      });
    }

    function fileKey(file) {
      return JSON.stringify([file.name, file.size, file.lastModified]);
    }

    function loadImage(blob) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(blob);
        var image = new Image();
        image.onload = function () {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error('Unable to read the artwork image.'));
        };
        image.src = url;
      });
    }

    function canvasToPng(canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('Unable to create a PNG image.'));
        }, 'image/png');
      });
    }

    function loadBackgroundRemoval() {
      if (!backgroundRemovalModulePromise) {
        backgroundRemovalModulePromise = import(
          'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm'
        ).then(function (module) {
          var removeBackground = module.default || module.removeBackground;
          if (typeof removeBackground !== 'function') {
            throw new Error('The background-removal library did not load correctly.');
          }
          return removeBackground;
        }).catch(function (error) {
          backgroundRemovalModulePromise = null;
          throw error;
        });
      }
      return backgroundRemovalModulePromise;
    }

    async function removeBg(file) {
      var sourceKey = fileKey(file);
      var originalImage = await loadImage(file);
      var originalWidth = originalImage.naturalWidth;
      var originalHeight = originalImage.naturalHeight;
      if (!originalWidth || !originalHeight) throw new Error('The artwork has invalid image dimensions.');

      var scale = Math.min(1, 2000 / Math.max(originalWidth, originalHeight));
      var inputWidth = Math.max(1, Math.round(originalWidth * scale));
      var inputHeight = Math.max(1, Math.round(originalHeight * scale));
      var inputCanvas = document.createElement('canvas');
      inputCanvas.width = inputWidth;
      inputCanvas.height = inputHeight;
      var inputContext = inputCanvas.getContext('2d');
      if (!inputContext) throw new Error('Canvas is unavailable for background removal.');
      inputContext.drawImage(originalImage, 0, 0, inputWidth, inputHeight);
      var inputBlob = await canvasToPng(inputCanvas);

      if (!backgroundModelLoaded) {
        setBackgroundMessage('Downloading AI model, first time only…');
      }
      var removeBackground = await loadBackgroundRemoval();
      var maskBlob = await removeBackground(inputBlob, {
        model: 'isnet_fp16',
        output: { format: 'image/png' },
        progress: function (key, current, total) {
          if (!originalArtworkFile || fileKey(originalArtworkFile) !== sourceKey || !isBackgroundEnabled()) return;
          var message = backgroundModelLoaded
            ? 'Removing background…'
            : 'Downloading AI model, first time only…';
          if (total > 0 && isFinite(current)) {
            message += ' ' + Math.round(current / total * 100) + '%';
          }
          setSpinnerProgress(current, total);
          setBackgroundMessage(message);
        }
      });
      backgroundModelLoaded = true;

      var maskImage = await loadImage(maskBlob);
      var outputCanvas = document.createElement('canvas');
      outputCanvas.width = originalWidth;
      outputCanvas.height = originalHeight;
      var outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
      if (!outputContext) throw new Error('Canvas is unavailable for applying the background mask.');
      outputContext.drawImage(originalImage, 0, 0);
      outputContext.globalCompositeOperation = 'destination-in';
      outputContext.drawImage(maskImage, 0, 0, originalWidth, originalHeight);
      outputContext.globalCompositeOperation = 'source-over';

      var imageData = outputContext.getImageData(0, 0, originalWidth, originalHeight);
      var originalAlpha = new Uint8Array(originalWidth * originalHeight);
      for (var pixel = 0; pixel < originalAlpha.length; pixel++) {
        originalAlpha[pixel] = imageData.data[pixel * 4 + 3];
      }

      var baseName = (file.name || 'artwork').replace(/\.[^.]+$/, '');
      var optionOne = new File([await canvasToPng(outputCanvas)], baseName + '-background-removed.png', {
        type: 'image/png'
      });

      for (var y = 0; y < originalHeight; y++) {
        for (var x = 0; x < originalWidth; x++) {
          var offset = y * originalWidth + x;
          var keep = originalAlpha[offset] > 128;
          if (keep) {
            for (var dy = -1; dy <= 1 && keep; dy++) {
              for (var dx = -1; dx <= 1; dx++) {
                var neighborX = x + dx;
                var neighborY = y + dy;
                if (
                  neighborX < 0 || neighborX >= originalWidth ||
                  neighborY < 0 || neighborY >= originalHeight ||
                  originalAlpha[neighborY * originalWidth + neighborX] <= 128
                ) {
                  keep = false;
                  break;
                }
              }
            }
          }
          imageData.data[offset * 4 + 3] = keep ? 255 : 0;
        }
      }
      outputContext.putImageData(imageData, 0, 0);
      var optionTwo = new File([await canvasToPng(outputCanvas)], baseName + '-sharper-edges.png', {
        type: 'image/png'
      });

      for (var alphaIndex = 0; alphaIndex < originalAlpha.length; alphaIndex++) {
        imageData.data[alphaIndex * 4 + 3] = Math.min(255, Math.round(originalAlpha[alphaIndex] * 1.4));
      }
      outputContext.putImageData(imageData, 0, 0);
      var optionThree = new File([await canvasToPng(outputCanvas)], baseName + '-more-detail.png', {
        type: 'image/png'
      });

      inputCanvas.width = 0;
      inputCanvas.height = 0;
      outputCanvas.width = 0;
      outputCanvas.height = 0;
      return [optionOne, optionTwo, optionThree];
    }

    function getBackgroundVariants(file) {
      var key = fileKey(file);
      if (backgroundRemovalCache.has(key)) return Promise.resolve(backgroundRemovalCache.get(key));
      if (backgroundRemovalRequests.has(key)) return backgroundRemovalRequests.get(key);

      var request = removeBg(file).then(function (variants) {
        backgroundRemovalCache.set(key, variants);
        backgroundRemovalRequests.delete(key);
        return variants;
      }, function (error) {
        backgroundRemovalRequests.delete(key);
        throw error;
      });
      backgroundRemovalRequests.set(key, request);
      return request;
    }

    function clearOptionUrls() {
      optionUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      optionUrls = [];
    }

    function setOptionFiles(files) {
      clearOptionUrls();
      optionFiles = files;
      optionUrls = files.map(function (file) { return URL.createObjectURL(file); });
      editor.querySelectorAll('[data-option-art]').forEach(function (image, index) {
        image.src = optionUrls[index] || artworkUrl;
      });
    }

    function setOriginalOptionFiles(file) {
      clearOptionUrls();
      optionFiles = [file, file, file];
      editor.querySelectorAll('[data-option-art]').forEach(function (image) {
        image.src = artworkUrl;
      });
    }

    function setOptionLoading(isLoading) {
      editor.querySelectorAll('[data-rail-option]').forEach(function (option) {
        option.classList.toggle('is-loading', isLoading);
        option.disabled = isLoading;
        if (!isLoading) {
          var spinner = option.querySelector('.rail-spinner');
          if (spinner) spinner.removeAttribute('data-progress');
        }
      });
    }

    function showArtwork(url) {
      editor.querySelectorAll('[data-canvas-art], [data-mockup-art]').forEach(function (image) {
        image.src = url;
      });
    }

    function setActiveOption(index) {
      editor.querySelectorAll('[data-rail-option]').forEach(function (option, optionIndex) {
        option.classList.toggle('is-active', optionIndex === index);
      });
    }

    function cancelBackgroundReplacement() {
      if (backgroundReplacementTimer) clearTimeout(backgroundReplacementTimer);
      backgroundReplacementTimer = null;
    }

    function replaceUploadedArtwork(file) {
      cancelBackgroundReplacement();
      backgroundReplacementTimer = setTimeout(function () {
        backgroundReplacementTimer = null;
        document.dispatchEvent(new CustomEvent('dtf:artwork-replace', {
          detail: { file: file }
        }));
      }, 300);
    }

    function selectOption(index, shouldReplace) {
      if (!optionFiles[index]) return;
      activeOptionIndex = index;
      setActiveOption(index);
      showArtwork(optionUrls[index] || artworkUrl);
      if (shouldReplace) replaceUploadedArtwork(optionFiles[index]);
    }

    function showOriginal(shouldReplace) {
      setActiveOption(-1);
      showArtwork(artworkUrl);
      if (shouldReplace && originalArtworkFile) replaceUploadedArtwork(originalArtworkFile);
    }

    function startBackgroundRemoval(resetSelection) {
      if (!aiBgRemovalEnabled || !originalArtworkFile || !isBackgroundEnabled()) return;
      var file = originalArtworkFile;
      var runId = ++backgroundRunId;
      if (resetSelection) activeOptionIndex = 0;
      setOptionLoading(true);
      setBackgroundMessage(backgroundModelLoaded
        ? 'Removing background…'
        : 'Downloading AI model, first time only…');

      getBackgroundVariants(file).then(function (variants) {
        if (runId !== backgroundRunId || file !== originalArtworkFile || !isBackgroundEnabled()) return;
        setOptionFiles(variants);
        setOptionLoading(false);
        setBackgroundMessage('');
        selectOption(Math.min(activeOptionIndex, variants.length - 1), true);
      }).catch(function (error) {
        if (runId !== backgroundRunId || file !== originalArtworkFile || !isBackgroundEnabled()) return;
        setOriginalOptionFiles(file);
        activeOptionIndex = 0;
        setActiveOption(0);
        setOptionLoading(false);
        showArtwork(artworkUrl);
        setBackgroundMessage('Background removal failed. Showing the original artwork.', true);
        console.error('Background removal failed.', error);
      });
    }

    function handleBackgroundToggle() {
      if (!aiBgRemovalEnabled || !originalArtworkFile) return;
      if (!isBackgroundEnabled()) {
        backgroundRunId++;
        setOptionLoading(false);
        setBackgroundMessage('');
        showOriginal(true);
        return;
      }

      setOriginalOptionFiles(originalArtworkFile);
      showArtwork(artworkUrl);
      if (originalArtworkFile.name.indexOf('artwork-edited-') === 0) {
        setActiveOption(0);
        setBackgroundMessage('');
        return;
      }
      startBackgroundRemoval(false);
    }

    function openEditor(file) {
      if (!editor || !file || file.type.indexOf('image/') !== 0) return;
      backgroundRunId++;
      cancelBackgroundReplacement();
      clearOptionUrls();
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
      originalArtworkFile = file;
      artworkUrl = URL.createObjectURL(file);
      setOriginalOptionFiles(file);
      showArtwork(artworkUrl);
      setActiveOption(0);
      setOptionLoading(false);
      setBackgroundMessage('');

      var probe = new Image();
      probe.onload = function () { sizeArtwork(probe.naturalWidth, probe.naturalHeight); };
      probe.src = artworkUrl;

      pdp.classList.add('is-editing');
      editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (aiBgRemovalEnabled && file.name.indexOf('artwork-edited-') !== 0 && isBackgroundEnabled()) {
        startBackgroundRemoval(true);
      }
    }

    function closeEditor() {
      pdp.classList.remove('is-editing');
      backgroundRunId++;
      cancelBackgroundReplacement();
      clearOptionUrls();
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
      artworkUrl = null;
      originalArtworkFile = null;
      optionFiles = [];
      setOptionLoading(false);
      setBackgroundMessage('');
      if (input) input.value = '';
      if (editor) {
        editor.querySelectorAll('[data-canvas-art], [data-option-art], [data-mockup-art]').forEach(function (img) {
          img.removeAttribute('src');
        });
        setActiveOption(-1);
      }
    }

    dropzone.addEventListener('dtf:artwork-ready', function (e) {
      if (e.detail && e.detail.file) openEditor(e.detail.file);
    });


    if (!editor) return;

    editor.querySelector('[data-canvas-delete]')?.addEventListener('click', closeEditor);

    editor.querySelector('[data-canvas-zoom]')?.addEventListener('click', function () {
      editor.querySelector('[data-canvas]').classList.toggle('is-zoomed');
    });

    if (backgroundToggle) {
      backgroundToggle.addEventListener('click', handleBackgroundToggle);
    }

    editor.querySelectorAll('[data-rail-option]').forEach(function (option) {
      option.addEventListener('click', function () {
        if (isBackgroundEnabled()) selectOption(
          Array.prototype.indexOf.call(editor.querySelectorAll('[data-rail-option]'), option),
          true
        );
      });
    });

    var morePanel = editor.querySelector('[data-rail-more-panel]');
    editor.querySelector('[data-rail-more]')?.addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      if (morePanel) morePanel.hidden = expanded;
    });

    var mockupImages = [];
    var selectedGarmentColor = '#ffffff';
    var initialSwatch = editor.querySelector('[data-swatch].is-active');
    if (initialSwatch) selectedGarmentColor = initialSwatch.getAttribute('data-color') || selectedGarmentColor;

    function parseSwatchColor(color) {
      var match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim());
      if (!match) return null;
      var hex = match[1];
      if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }

    function tintMockup(mockup, color) {
      var rgb = parseSwatchColor(color);
      if (!rgb) {
        console.error('Invalid garment swatch color:', color);
        return;
      }

      var source = mockup.source.data;
      var output = mockup.context.createImageData(mockup.source.width, mockup.source.height);
      for (var i = 0; i < source.length; i += 4) {
        var brightness = (source[i] * 0.2126 + source[i + 1] * 0.7152 + source[i + 2] * 0.0722) / 255;
        output.data[i] = Math.round(rgb[0] * brightness);
        output.data[i + 1] = Math.round(rgb[1] * brightness);
        output.data[i + 2] = Math.round(rgb[2] * brightness);
        output.data[i + 3] = source[i + 3];
      }

      mockup.context.putImageData(output, 0, 0);
      mockup.img.src = mockup.canvas.toDataURL('image/png');
    }

    function cacheMockupImage(img) {
      if (img.dataset.mockupCached || !img.naturalWidth) return;
      img.dataset.mockupCached = 'true';

      var canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        console.error('Unable to create a canvas for garment color preview.');
        return;
      }

      try {
        context.drawImage(img, 0, 0);
        var source = context.getImageData(0, 0, canvas.width, canvas.height);
        var mockup = { img: img, canvas: canvas, context: context, source: source };
        mockupImages.push(mockup);
        tintMockup(mockup, selectedGarmentColor);
      } catch (error) {
        console.error('Unable to recolor this mockup. Use a Shopify-hosted image with a transparent background.', error);
      }
    }

    editor.querySelectorAll('.mockup-product').forEach(function (img) {
      if (img.complete) {
        cacheMockupImage(img);
      } else {
        img.addEventListener('load', function () { cacheMockupImage(img); }, { once: true });
      }
    });

    function activateSwatch(activeSwatch, color) {
      editor.querySelectorAll('[data-swatch], .swatch--multi').forEach(function (swatch) {
        swatch.classList.toggle('is-active', swatch === activeSwatch);
      });
      selectedGarmentColor = color || '#ffffff';
      mockupImages.forEach(function (mockup) {
        tintMockup(mockup, selectedGarmentColor);
      });
    }

    editor.querySelectorAll('[data-swatch]').forEach(function (swatch) {
      swatch.addEventListener('click', function () {
        activateSwatch(swatch, swatch.getAttribute('data-color'));
      });
    });

    var pickerRoot = editor.querySelector('[data-custom-picker]');
    if (pickerRoot) {
      var pickerButton = pickerRoot.querySelector('[data-custom-toggle]');
      var picker = pickerRoot.querySelector('[data-color-picker]');
      var plane = pickerRoot.querySelector('[data-color-plane]');
      var pointer = pickerRoot.querySelector('[data-color-pointer]');
      var hueInput = pickerRoot.querySelector('[data-color-hue]');
      var hexInput = pickerRoot.querySelector('[data-color-hex]');
      var pickerHsv = { h: 0, s: 0, v: 1 };

      function hexToHsv(hex) {
        var rgb = parseSwatchColor(hex);
        if (!rgb) return null;
        var r = rgb[0] / 255;
        var g = rgb[1] / 255;
        var b = rgb[2] / 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var delta = max - min;
        var h = 0;
        if (delta) {
          if (max === r) h = 60 * (((g - b) / delta) % 6);
          else if (max === g) h = 60 * ((b - r) / delta + 2);
          else h = 60 * ((r - g) / delta + 4);
        }
        return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
      }

      function hsvToHex(h, s, v) {
        var hue = ((h % 360) + 360) % 360;
        var chroma = v * s;
        var x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
        var m = v - chroma;
        var rgb = hue < 60 ? [chroma, x, 0] :
          hue < 120 ? [x, chroma, 0] :
            hue < 180 ? [0, chroma, x] :
              hue < 240 ? [0, x, chroma] :
                hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
        return '#' + rgb.map(function (channel) {
          return ('0' + Math.round((channel + m) * 255).toString(16)).slice(-2);
        }).join('');
      }

      function updatePicker(color) {
        var hsv = hexToHsv(color);
        if (!hsv) return;
        pickerHsv = hsv;
        hueInput.value = String(Math.round(hsv.h) % 360);
        plane.style.backgroundColor = 'hsl(' + hsv.h + ', 100%, 50%)';
        pointer.style.left = (hsv.s * 100) + '%';
        pointer.style.top = ((1 - hsv.v) * 100) + '%';
        hexInput.value = hsvToHex(hsv.h, hsv.s, hsv.v);
      }

      function applyPickerColor(color) {
        if (!parseSwatchColor(color)) return;
        updatePicker(color);
        activateSwatch(pickerButton, color);
      }

      function closePicker() {
        picker.hidden = true;
        pickerButton.setAttribute('aria-expanded', 'false');
      }

      pickerButton.addEventListener('click', function () {
        if (picker.hidden) {
          updatePicker(selectedGarmentColor);
          picker.hidden = false;
          pickerButton.setAttribute('aria-expanded', 'true');
          activateSwatch(pickerButton, selectedGarmentColor);
        } else {
          closePicker();
        }
      });

      hueInput.addEventListener('input', function () {
        applyPickerColor(hsvToHex(Number(hueInput.value), pickerHsv.s, pickerHsv.v));
      });

      hexInput.addEventListener('input', function () {
        if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hexInput.value.trim())) {
          applyPickerColor(hexInput.value.trim());
        }
      });

      function setColorFromPointer(event) {
        var bounds = plane.getBoundingClientRect();
        pickerHsv.s = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        pickerHsv.v = 1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        applyPickerColor(hsvToHex(pickerHsv.h, pickerHsv.s, pickerHsv.v));
      }

      plane.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        plane.setPointerCapture(event.pointerId);
        setColorFromPointer(event);
      });
      plane.addEventListener('pointermove', function (event) {
        if (plane.hasPointerCapture(event.pointerId)) setColorFromPointer(event);
      });
      plane.addEventListener('keydown', function (event) {
        var amount = event.shiftKey ? 0.1 : 0.02;
        if (event.key === 'ArrowLeft') pickerHsv.s = Math.max(0, pickerHsv.s - amount);
        else if (event.key === 'ArrowRight') pickerHsv.s = Math.min(1, pickerHsv.s + amount);
        else if (event.key === 'ArrowUp') pickerHsv.v = Math.min(1, pickerHsv.v + amount);
        else if (event.key === 'ArrowDown') pickerHsv.v = Math.max(0, pickerHsv.v - amount);
        else return;
        event.preventDefault();
        applyPickerColor(hsvToHex(pickerHsv.h, pickerHsv.s, pickerHsv.v));
      });

      document.addEventListener('pointerdown', function (event) {
        if (!pickerRoot.contains(event.target)) closePicker();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !picker.hidden) {
          closePicker();
          pickerButton.focus();
        }
      });
    }

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

      var popularSelect = sizeStep.querySelector('[data-popular-select]');
      if (popularSelect) {
        popularSelect.addEventListener('change', function () {
          var w = parseFloat(popularSelect.value);
          if (!w) return;
          addSizeRow(w, w / artRatio, 1);
          sizeStep.querySelector('[data-size-tab="custom"]').click();
          popularSelect.value = '';
        });
      }
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

/* ================= SIZE INPUT STEPPERS ================= */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-stepper]');
  if (!btn) return;
  var row = btn.closest('[data-size-row]');
  if (!row) return;
  var parts = (btn.dataset.stepper || '').split(':');
  var field = parts[0]; // w, h, or q
  var dir = parts[1];   // up or dn
  var sel = field === 'w' ? '[data-size-w]' : field === 'h' ? '[data-size-h]' : '[data-size-qty]';
  var input = row.querySelector(sel);
  if (!input) return;
  var step = parseFloat(input.getAttribute('step')) || 1;
  var min = parseFloat(input.getAttribute('min')) || 0;
  var max = parseFloat(input.getAttribute('max')) || 9999;
  var val = parseFloat(input.value) || 0;
  var newVal = dir === 'up' ? val + step : val - step;
  newVal = Math.max(min, Math.min(max, newVal));
  var dec = (step.toString().split('.')[1] || '').length;
  input.value = newVal.toFixed(dec);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

/* ================= CUSTOM CHECKOUT ================= */
(function () {
  var btn = document.querySelector('[data-checkout-btn]');
  if (!btn) return;

  var CHECKOUT_URL = '/apps/gang-sheet-builder/checkout';
  var originalLabel = btn.textContent.trim();

  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.textContent = 'PROCESSING…';

    var variantId = btn.getAttribute('data-variant-id') || '';
    var productTitle = btn.getAttribute('data-product-title') || '';

    var carrierInput = document.querySelector('[data-artwork-carriers] input');
    var artworkUrl = carrierInput ? carrierInput.value : '';

    var editor = document.querySelector('[data-editor]');
    var artImg = editor ? editor.querySelector('[data-canvas-art]') : null;
    var previewUrl = artworkUrl || (artImg ? artImg.src : '');

    var lineItems = [];

    // --- DTF transfer pages: size rows with custom dimensions/pricing ---
    var sizeRows = editor ? editor.querySelectorAll('[data-size-row]') : [];
    if (sizeRows.length) {
      sizeRows.forEach(function (row) {
        var w = parseFloat(row.querySelector('[data-size-w]').value) || 0;
        var h = parseFloat(row.querySelector('[data-size-h]').value) || 0;
        var qty = parseInt(row.querySelector('[data-size-qty]').value, 10) || 1;
        var priceEl = row.querySelector('[data-size-price]');
        var priceText = priceEl ? priceEl.textContent.replace(/[^0-9.]/g, '') : '';
        var unitPrice = parseFloat(priceText) || 0;

        lineItems.push({
          unitPrice: unitPrice,
          quantity: qty,
          productTitle: productTitle + ' (' + w.toFixed(2) + '" x ' + h.toFixed(2) + '")',
          sheetFt: Math.ceil(Math.max(w, h) / 12),
          film: 'DTF',
          imageCount: 1,
          artworkUrl: artworkUrl,
          previewUrl: previewUrl
        });
      });
    }

    // --- Premium DTF / gang sheet pages: single size row ---
    if (!lineItems.length) {
      var gangRow = document.querySelector('[data-size-row]');
      if (gangRow) {
        var gangPrice = gangRow.querySelector('[data-gang-size-price]');
        var gangQty = gangRow.querySelector('[data-gang-size-qty]');
        var priceVal = gangPrice ? parseFloat(gangPrice.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;
        var qtyVal = gangQty ? parseInt(gangQty.value, 10) || 1 : 1;
        lineItems.push({
          unitPrice: priceVal,
          quantity: qtyVal,
          productTitle: productTitle,
          film: 'DTF',
          artworkUrl: artworkUrl,
          previewUrl: previewUrl
        });
      }
    }

    // --- Apparel pages (hats/hoodies/tshirts): multi-variant qty grid ---
    if (!lineItems.length) {
      var variantInputs = document.querySelectorAll('[data-variant-qty]');
      variantInputs.forEach(function (input) {
        var qty = parseInt(input.value, 10) || 0;
        if (qty < 1) return;
        var vid = input.getAttribute('data-variant-qty');
        var priceCents = parseInt(input.getAttribute('data-price'), 10) || 0;
        var label = input.getAttribute('aria-label') || '';
        var sizeName = label.replace('Quantity for ', '');
        lineItems.push({
          variantId: 'gid://shopify/ProductVariant/' + vid,
          unitPrice: priceCents / 100,
          quantity: qty,
          productTitle: productTitle + (sizeName ? ' - ' + sizeName : '')
        });
      });
    }

    // --- Generic product page: single variant fallback ---
    if (!lineItems.length) {
      var fallbackPrice = parseFloat(btn.getAttribute('data-variant-price')) || 0;
      lineItems.push({
        variantId: variantId,
        unitPrice: fallbackPrice,
        quantity: 1,
        productTitle: productTitle
      });
    }

    if (!lineItems.length) {
      alert('Please select at least one item.');
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }

    var body = lineItems.length === 1
      ? lineItems[0]
      : { lineItems: lineItems };

    fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.ok && data.invoiceUrl) {
        window.location.href = data.invoiceUrl;
      } else {
        alert('Checkout failed. Please try again.');
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    })
    .catch(function () {
      alert('Checkout failed. Please try again.');
      btn.disabled = false;
      btn.textContent = originalLabel;
    });
  });
})();

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
  var tabsArrowBack = document.getElementById('capsuleTabArrowBack');
  if (tabsScroll && tabsArrow) {
    function updateCapsuleArrowState() {
      var canScrollLeft = tabsScroll.scrollLeft > 1;
      tabsScroll.classList.toggle('has-scroll-left', canScrollLeft);
      var maxScrollLeft = tabsScroll.scrollWidth - tabsScroll.clientWidth;
      var canScrollRight = maxScrollLeft - tabsScroll.scrollLeft > 1;

      if (tabsArrowBack) {
        tabsArrowBack.hidden = !canScrollLeft;
        tabsArrowBack.disabled = !canScrollLeft;
      }
      tabsArrow.disabled = !canScrollRight;
    }

    tabsArrow.addEventListener('click', function () {
      tabsScroll.scrollBy({ left: 160, behavior: 'smooth' });
    });
    if (tabsArrowBack) {
      tabsArrowBack.addEventListener('click', function () {
        tabsScroll.scrollBy({ left: -160, behavior: 'smooth' });
      });
    }
    tabsScroll.addEventListener('scroll', updateCapsuleArrowState, { passive: true });
    window.addEventListener('resize', updateCapsuleArrowState);
    requestAnimationFrame(updateCapsuleArrowState);
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




/* MOBILE SUBMENU TOGGLE */

document.addEventListener("click", function (event) {
  const toggle = event.target.closest(".mobile-submenu-toggle");

  if (!toggle) return;

  const submenuId = toggle.getAttribute("aria-controls");
  const submenu = document.getElementById(submenuId);

  if (!submenu) return;

  const isOpen = toggle.getAttribute("aria-expanded") === "true";

  toggle.setAttribute("aria-expanded", String(!isOpen));
  submenu.hidden = isOpen;
});
