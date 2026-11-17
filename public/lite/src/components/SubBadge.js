/**
 * Clubstride Lite – SubBadge component
 *
 * Renders a sub-in or sub-out badge circle at 16, 24, or 32 px.
 * Badges use fixed gradient fills from the CI SVGs – do NOT recolour them.
 *
 * Usage:
 *   const badge = SubBadge({ kind: 'in', size: 24 });
 *   container.appendChild(badge);
 *
 *   // With TAP-TO-SUB chip border (60% opacity):
 *   const chipBadge = SubBadge({ kind: 'out', size: 24, chipBorder: true });
 *
 *   // Avatar corner badge:
 *   const avatarBadge = SubBadge({ kind: 'in', size: 16, className: 'absolute bottom-0 right-0' });
 */

/**
 * Inline SVG source for every badge variant.
 * Using inline SVG avoids a fetch round-trip for small, frequently-used badges.
 */
const _BADGE_SVG = {
  'in-16': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><defs><linearGradient id="gin16" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FF0B4"/><stop offset=".55" stop-color="#3BE38A"/><stop offset="1" stop-color="#1FB868"/></linearGradient></defs><circle cx="12" cy="12" r="11.5" fill="url(#gin16)"/><circle cx="12" cy="12" r="10.75" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/><g fill="none" stroke="#06142B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V7"/><path d="M7 11L12 6.5 17 11"/></g></svg>`,
  'in-24': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><defs><linearGradient id="gin24" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FF0B4"/><stop offset=".55" stop-color="#3BE38A"/><stop offset="1" stop-color="#1FB868"/></linearGradient></defs><circle cx="12" cy="12" r="11.5" fill="url(#gin24)"/><circle cx="12" cy="12" r="10.75" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/><g fill="none" stroke="#06142B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17.5V7"/><path d="M7.5 11L12 6.5 16.5 11"/></g></svg>`,
  'in-32': `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><defs><linearGradient id="gin32" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FF0B4"/><stop offset=".55" stop-color="#3BE38A"/><stop offset="1" stop-color="#1FB868"/></linearGradient></defs><circle cx="12" cy="12" r="11.5" fill="url(#gin32)"/><circle cx="12" cy="12" r="10.75" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/><g fill="none" stroke="#06142B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17.5V7"/><path d="M7.5 11L12 6.5 16.5 11"/></g></svg>`,
  'out-16': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><defs><linearGradient id="gout16" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB3AC"/><stop offset=".55" stop-color="#FF8A80"/><stop offset="1" stop-color="#E8615A"/></linearGradient></defs><circle cx="12" cy="12" r="11.5" fill="url(#gout16)"/><circle cx="12" cy="12" r="10.75" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/><g fill="none" stroke="#06142B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5V17"/><path d="M7 13L12 17 17 13"/></g></svg>`,
  'out-24': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><defs><linearGradient id="gout24" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB3AC"/><stop offset=".55" stop-color="#FF8A80"/><stop offset="1" stop-color="#E8615A"/></linearGradient></defs><circle cx="12" cy="12" r="11.5" fill="url(#gout24)"/><circle cx="12" cy="12" r="10.75" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/><g fill="none" stroke="#06142B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5V17"/><path d="M7.5 13L12 17.5 16.5 13"/></g></svg>`,
  'out-32': `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><defs><linearGradient id="gout32" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB3AC"/><stop offset=".55" stop-color="#FF8A80"/><stop offset="1" stop-color="#E8615A"/></linearGradient></defs><circle cx="12" cy="12" r="11.5" fill="url(#gout32)"/><circle cx="12" cy="12" r="10.75" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="1"/><g fill="none" stroke="#06142B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5V17"/><path d="M7.5 13L12 17.5 16.5 13"/></g></svg>`,
};

/** Token hex values for chip borders */
const _BORDER_COLOR = { in: '#3BE38A', out: '#FF8A80' };

/**
 * Create a SubBadge element.
 *
 * @param {object} opts
 * @param {'in'|'out'}   opts.kind         - Substitution direction.
 * @param {16|24|32}     [opts.size=24]    - Badge diameter in px.
 * @param {boolean}      [opts.chipBorder] - Add a 2px border at 60% opacity (TAP-TO-SUB chip).
 * @param {string}       [opts.className]  - Extra CSS classes.
 * @returns {HTMLElement}
 */
function SubBadge({ kind = 'in', size = 24, chipBorder = false, className = '' } = {}) {
  const key = `${kind}-${size}`;
  const svg = _BADGE_SVG[key];

  if (!svg) {
    console.warn(`[Clubstride] SubBadge: unknown kind/size combo "${key}"`);
    const empty = document.createElement('span');
    empty.style.cssText = `display:inline-block;width:${size}px;height:${size}px;`;
    return empty;
  }

  const wrapper = document.createElement('span');
  wrapper.className = `cs-sub-badge cs-sub-badge--${kind} cs-sub-badge--${size} ${className}`.trim();

  const styles = [
    `display:inline-flex`,
    `align-items:center`,
    `justify-content:center`,
    `width:${size}px`,
    `height:${size}px`,
    `border-radius:50%`,
    `flex-shrink:0`,
  ];

  if (chipBorder) {
    const borderHex = _BORDER_COLOR[kind] || '#FFFFFF';
    styles.push(`box-shadow:0 0 0 2px ${borderHex}99`); // 99 ≈ 60% opacity
  }

  wrapper.style.cssText = styles.join(';');
  wrapper.innerHTML = svg;

  // Ensure SVG fills wrapper exactly
  const svgEl = wrapper.querySelector('svg');
  if (svgEl) {
    svgEl.setAttribute('width', size);
    svgEl.setAttribute('height', size);
    svgEl.style.display = 'block';
    svgEl.style.overflow = 'visible'; // keep gradient defs visible
  }

  return wrapper;
}

/**
 * Render a ProPill overlay element (Lite users only).
 * Place this absolutely over a parent with position:relative.
 *
 * @param {boolean} isPro - If true, returns null (no pill for Pro users).
 * @returns {HTMLElement|null}
 */
function ProPill(isPro = false) {
  if (isPro) return null;
  const img = document.createElement('img');
  img.src = './assets/icons/pro-pill.svg';
  img.alt = 'PRO';
  img.className = 'cs-pro-pill';
  img.style.cssText = [
    'position:absolute',
    'top:-4px',
    'right:-6px',
    'width:44px',
    'height:20px',
    'pointer-events:none',
    'z-index:10',
  ].join(';');
  return img;
}

// Export for both ES module and script tag environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SubBadge, ProPill };
} else {
  window.SubBadge = SubBadge;
  window.ProPill = ProPill;
}
