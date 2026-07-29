
(function(){
  if (window.__HD_LEDGER_PAGE_VIEW_SWITCH_READY__) return;
  window.__HD_LEDGER_PAGE_VIEW_SWITCH_READY__ = true;

  function normalizeView(value) {
    return value === 'single' ? 'single' : 'report';
  }

  function currentViewFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return normalizeView(params.get('view') || params.get('format') || 'report');
  }

  function setUrlView(view) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    url.searchParams.set('format', view);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  function applyView(view, shouldWriteUrl) {
    const normalized = normalizeView(view);

    document.documentElement.setAttribute('data-ledger-view', normalized);
    if (document.body) {
      document.body.setAttribute('data-ledger-view', normalized);
    }

    document.querySelectorAll('[data-ledger-view-button]').forEach(function(button){
      const isActive = button.getAttribute('data-ledger-view-button') === normalized;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (shouldWriteUrl) {
      setUrlView(normalized);
    }

    window.dispatchEvent(new CustomEvent('hd-ledger-view-change', {
      detail: { view: normalized }
    }));
  }

  document.addEventListener('click', function(event){
    const button = event.target.closest('[data-ledger-view-button]');
    if (!button) return;

    event.preventDefault();
    applyView(button.getAttribute('data-ledger-view-button'), true);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      applyView(currentViewFromUrl(), false);
    });
  } else {
    applyView(currentViewFromUrl(), false);
  }
})();
