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
});
