// Progressive enhancement for /concepts: apply ?layer=&status= filters client-side.
// External file (not inline) so the strict CSP stays hash-free for authored scripts;
// without JavaScript the form still navigates and the full list renders.
(function () {
  var params = new URLSearchParams(location.search);
  var layer = params.get('layer') || '';
  var status = params.get('status') || '';
  var form = document.querySelector('form[aria-label="Filter concepts"]');
  if (form) {
    form.querySelector('[name="layer"]').value = layer;
    form.querySelector('[name="status"]').value = status;
  }
  if (!layer && !status) return;
  var visible = 0;
  document.querySelectorAll('li[data-layer]').forEach(function (item) {
    var match =
      (!layer || item.dataset.layer === layer) && (!status || item.dataset.status === status);
    item.hidden = !match;
    if (match) visible++;
  });
  document.querySelectorAll('[data-layer-section]').forEach(function (section) {
    section.hidden = section.querySelectorAll('li[data-layer]:not([hidden])').length === 0;
  });
  if (visible === 0) document.getElementById('empty-state').hidden = false;
})();
