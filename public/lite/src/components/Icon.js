/**
 * Clubstride Lite – Icon component
 *
 * Loads a named SVG icon from /assets/icons/ and injects it inline so that
 * stroke="currentColor" responds to the CSS `color` property.
 *
 * Usage (HTML element approach):
 *   const el = await Icon({ name: 'squad', size: 24, color: '#22D3EE' });
 *   container.appendChild(el);
 *
 * Or use the convenience helper that also handles caching:
 *   ClubstrideIcon.render(container, 'goal', { size: 32, color: '#C8F230' });
 */

const _iconCache = {};

/**
 * Fetch and parse an SVG icon by name.
 * @param {string} name  - Icon filename without extension (e.g. 'squad', 'sub-in').
 * @param {object} [opts]
 * @param {number} [opts.size=24]            - Width/height in px.
 * @param {string} [opts.color='currentColor'] - Stroke/fill color or CSS token string.
 * @param {string} [opts.className='']        - Extra CSS classes on the wrapper span.
 * @returns {Promise<HTMLElement>} - A <span> wrapping the inline SVG.
 */
async function Icon({ name, size = 24, color = 'currentColor', className = '' } = {}) {
  let svgText = _iconCache[name];

  if (!svgText) {
    try {
      const resp = await fetch(`./assets/icons/${name}.svg`);
      if (!resp.ok) throw new Error(`Icon not found: ${name}`);
      svgText = await resp.text();
      _iconCache[name] = svgText;
    } catch (err) {
      console.warn('[Clubstride] Icon load failed:', err.message);
      const fallback = document.createElement('span');
      fallback.style.cssText = `display:inline-block;width:${size}px;height:${size}px;`;
      return fallback;
    }
  }

  const wrapper = document.createElement('span');
  wrapper.className = `cs-icon cs-icon--${name} ${className}`.trim();
  wrapper.style.cssText = [
    `display:inline-flex`,
    `align-items:center`,
    `justify-content:center`,
    `width:${size}px`,
    `height:${size}px`,
    color !== 'currentColor' ? `color:${color}` : '',
  ].filter(Boolean).join(';');

  wrapper.innerHTML = svgText;

  const svg = wrapper.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.style.display = 'block';
    if (color !== 'currentColor') {
      svg.style.color = color;
    }
  }

  return wrapper;
}

/**
 * Convenience helper with imperative render API.
 *
 *   ClubstrideIcon.render(containerEl, 'goal', { size: 32, color: '#C8F230' });
 *   ClubstrideIcon.renderSync(containerEl, 'squad'); // uses cached SVG only
 */
const ClubstrideIcon = {
  /**
   * Async render – fetches and injects icon into `container`.
   * Replaces existing `.cs-icon` child if present.
   */
  render(container, name, opts = {}) {
    Icon({ name, ...opts }).then(el => {
      const existing = container.querySelector('.cs-icon');
      if (existing) existing.remove();
      container.appendChild(el);
    });
  },

  /**
   * Preload a list of icon names into cache.
   */
  preload(names = []) {
    return Promise.all(names.map(n => Icon({ name: n })));
  },
};

// Export for both ES module and script tag environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Icon, ClubstrideIcon };
} else {
  window.Icon = Icon;
  window.ClubstrideIcon = ClubstrideIcon;
}
