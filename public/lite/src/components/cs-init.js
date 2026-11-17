/**
 * Clubstride Lite – Component initialiser
 *
 * Runs after page load and after each dynamic re-render to:
 *  1. Hydrate [data-sub-badge] placeholder spans with real SubBadge SVGs.
 *  2. Apply chip-border style to .cs-sub-chip-badge elements (TAP-TO-SUB chips).
 *  3. Overlay the PRO pill on locked/pro-tier icons for Lite users.
 *
 * Called automatically via MutationObserver so new DOM nodes are handled too.
 */

(function () {
  'use strict';

  // ── Tier flag ──────────────────────────────────────────────────────────────
  // Change this to true when the user upgrades to Clubstride Pro.
  // In production derive from AppState or a persisted preference.
  function getIsPro() {
    try {
      const stored = localStorage.getItem('cs_tier');
      return stored === 'pro';
    } catch (_) {
      return false;
    }
  }

  // ── Hydrate SubBadge placeholders ──────────────────────────────────────────
  function hydrateBadges(root) {
    if (typeof SubBadge !== 'function') return;

    root.querySelectorAll('[data-sub-badge]').forEach(function (el) {
      if (el.dataset.hydrated) return;
      el.dataset.hydrated = '1';

      const spec = el.dataset.subBadge; // e.g. "in-24" or "out-16"
      const parts = spec.split('-');
      if (parts.length < 2) return;

      const size = parseInt(parts[parts.length - 1], 10) || 24;
      const kind = parts.slice(0, -1).join('-'); // "in" or "out"
      const isChip = el.classList.contains('cs-sub-chip-badge');

      const badge = SubBadge({ kind: kind, size: size, chipBorder: isChip });

      // Copy display styles
      badge.style.display = 'inline-flex';
      badge.style.verticalAlign = 'middle';

      // Replace placeholder with real badge
      el.parentNode.replaceChild(badge, el);
    });
  }

  // A marker element gets the pill once the tier is Lite, so the app's own ci-sprite
  // icons can be gated without giving them a second icon system.
  function applyProPills(root) {
    if (typeof ProPill !== 'function') return;
    const isPro = getIsPro();

    root.querySelectorAll('[data-pro]').forEach(function (el) {
      if (el.querySelector('.cs-pro-pill')) return; // already applied

      const pill = ProPill(isPro);
      if (!pill) return;

      // Ensure relative positioning for absolute pill
      const style = window.getComputedStyle(el);
      if (style.position === 'static') {
        el.style.position = 'relative';
      }
      el.appendChild(pill);
    });
  }

  // ── Combined hydration pass ────────────────────────────────────────────────
  function hydrateAll(root) {
    root = root || document;
    hydrateBadges(root);
    applyProPills(root);
  }

  // ── MutationObserver – watch for new DOM subtrees ──────────────────────────
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType === 1 /* ELEMENT_NODE */) {
          hydrateAll(node);
          // Also check the node itself
          if (node.dataset && node.dataset.subBadge) {
            hydrateAll(node.parentNode || document);
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ── Initial pass once DOM is ready ────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { hydrateAll(document); });
  } else {
    hydrateAll(document);
  }

  // ── Expose for manual re-trigger (e.g. after App re-renders) ─────────────
  window.CSInit = { hydrate: hydrateAll };

})();
