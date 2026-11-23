/** Our Journey: a black-and-white world map that turns to color around the places we've been (by who's been). */
const Journey = {
  VIEW_W: 1000,
  VIEW_H: 520,
  REVEAL_R: 9,
  DOT_R: 3.6,
  MAX_ZOOM: 14,
  // Draw order: shared places sit on top of solo ones.
  WHO: [
    { id: 'me', label: 'Me', color: '#5b9bd5' },
    { id: 'her', label: 'Her', color: '#ee8fa6' },
    { id: 'both', label: 'We’ve both been', color: '#f2c744' },
    { id: 'together', label: 'We’ve been together', color: '#9b6fd6' },
  ],
  data: null,
  world: null,
  cities: [],
  view: { k: 1, x: 0, y: 0 },

  init() {},

  async load() {
    const root = document.getElementById('journey-root');
    if (!root) return;
    if (!this.data) root.innerHTML = `<p class="empty-state">Loading Our Journey…</p>`;

    try {
      const [data, world] = await Promise.all([
        fetch('data/journey.json').then((r) => r.json()),
        this.world || fetch('data/world.json').then((r) => r.json()),
      ]);
      this.data = data;
      this.world = world;
      this.render(root);
    } catch (err) {
      console.error(err);
      root.innerHTML = `<p class="empty-state">Could not load Our Journey.</p>`;
    }
  },

  render(root) {
    const countries = topojson
      .feature(this.world, this.world.objects.countries)
      .features.filter((f) => f.id !== '010'); // no Antarctica
    const projection = d3
      .geoNaturalEarth1()
      .fitExtent([[6, 6], [this.VIEW_W - 6, this.VIEW_H - 6]], { type: 'FeatureCollection', features: countries });
    const path = d3.geoPath(projection);
    const paths = countries.map((f) => path(f)).filter(Boolean);

    const order = this.WHO.map((w) => w.id);
    this.cities = (this.data.places || [])
      .slice()
      .sort((a, b) => order.indexOf(a.who) - order.indexOf(b.who))
      .map((c) => {
        const xy = projection([c.lng, c.lat]);
        return xy ? { ...c, x: xy[0], y: xy[1], size: c.size || 1 } : null;
      })
      .filter(Boolean);

    const grads = this.WHO.map((w) =>
      w.id === 'together'
        ? `<radialGradient id="journey-glow-together">
            <stop offset="0" stop-color="#fff" stop-opacity="0.95" />
            <stop offset="0.25" stop-color="#c9a8f5" />
            <stop offset="0.7" stop-color="${w.color}" />
            <stop offset="1" stop-color="${w.color}" stop-opacity="0" />
          </radialGradient>`
        : `<radialGradient id="journey-glow-${w.id}">
            <stop offset="0" stop-color="${w.color}" />
            <stop offset="0.7" stop-color="${w.color}" />
            <stop offset="1" stop-color="${w.color}" stop-opacity="0" />
          </radialGradient>`
    ).join('');

    const reveals = this.cities
      .map(
        (c, i) =>
          `<circle class="journey-reveal" data-i="${i}" style="--i:${Math.min(i, 30)}" cx="${c.x}" cy="${c.y}" fill="url(#journey-glow-${c.who})" />`
      )
      .join('');

    const dots = this.cities
      .map(
        (c, i) => `
        <g class="journey-city who-${c.who}" data-i="${i}" tabindex="0" role="button" aria-label="${this.escape(c.name)}">
          <circle class="journey-pulse" cx="${c.x}" cy="${c.y}" />
          <circle class="journey-dot" cx="${c.x}" cy="${c.y}" />
          <circle class="journey-hit" cx="${c.x}" cy="${c.y}" />
        </g>`
      )
      .join('');

    const legend = this.WHO.map(
      (w) => `<li class="journey-key who-${w.id}"><i style="--c:${w.color}"></i>${w.label}</li>`
    ).join('');

    root.innerHTML = `
      <div class="journey-map" id="journey-map">
        <svg id="journey-svg" viewBox="0 0 ${this.VIEW_W} ${this.VIEW_H}" role="img" aria-label="World map, in color where we have been">
          <defs>
            ${grads}
            <clipPath id="journey-clip">${paths.map((d) => `<path d="${d}" />`).join('')}</clipPath>
          </defs>
          <g class="journey-base">${paths.map((d) => `<path d="${d}" />`).join('')}</g>
          <g class="journey-color" clip-path="url(#journey-clip)">${reveals}</g>
          <g class="journey-outline">${paths.map((d) => `<path d="${d}" />`).join('')}</g>
          <g class="journey-cities">${dots}</g>
        </svg>
        <div class="journey-tip" id="journey-tip" hidden></div>
        <ul class="journey-legend">${legend}</ul>
        <div class="journey-zoom">
          <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
          <button type="button" data-zoom="reset" aria-label="Reset view">⌂</button>
        </div>
      </div>
    `;

    this.view = { k: 1, x: 0, y: 0 };
    this.bind(root);
    this.applyView();
  },

  /** Sync the viewBox and the screen-constant sizes of dots/glows to the current zoom. */
  applyView() {
    const svg = document.getElementById('journey-svg');
    if (!svg) return;
    const { k, x, y } = this.view;
    svg.setAttribute('viewBox', `${x} ${y} ${this.VIEW_W / k} ${this.VIEW_H / k}`);
    svg.querySelectorAll('.journey-reveal').forEach((el) => {
      el.setAttribute('r', (this.REVEAL_R * this.cities[el.dataset.i].size) / Math.sqrt(k));
    });
    svg.querySelectorAll('.journey-city').forEach((g) => {
      const [pulse, dot, hit] = g.children;
      pulse.setAttribute('r', (this.DOT_R + 1) / k);
      dot.setAttribute('r', this.DOT_R / k);
      hit.setAttribute('r', 9 / k);
    });
    svg.style.setProperty('--dot-stroke', `${1.6 / k}px`);
    this.hideTip();
  },

  clampView() {
    const v = this.view;
    v.k = Math.min(this.MAX_ZOOM, Math.max(1, v.k));
    v.x = Math.min(this.VIEW_W - this.VIEW_W / v.k, Math.max(0, v.x));
    v.y = Math.min(this.VIEW_H - this.VIEW_H / v.k, Math.max(0, v.y));
  },

  /** Zoom by `factor`, keeping the map point under (clientX, clientY) fixed. */
  zoomAt(factor, clientX, clientY) {
    const svg = document.getElementById('journey-svg');
    const ctm = svg.getScreenCTM();
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const v = this.view;
    const k = Math.min(this.MAX_ZOOM, Math.max(1, v.k * factor));
    v.x = pt.x - ((pt.x - v.x) * v.k) / k;
    v.y = pt.y - ((pt.y - v.y) * v.k) / k;
    v.k = k;
    this.clampView();
    this.applyView();
  },

  bind(root) {
    const map = root.querySelector('#journey-map');
    const svg = root.querySelector('#journey-svg');

    root.querySelectorAll('.journey-city').forEach((g) => {
      const i = Number(g.dataset.i);
      g.addEventListener('mouseenter', () => this.showTip(i));
      g.addEventListener('mouseleave', () => this.hideTip());
      g.addEventListener('focus', () => this.showTip(i));
      g.addEventListener('blur', () => this.hideTip());
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showTip(i);
      });
    });

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      },
      { passive: false }
    );

    // Drag to pan
    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.journey-city')) return;
      drag = { x: e.clientX, y: e.clientY, moved: false };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const scale = svg.getScreenCTM().a; // screen px per view unit
      const dx = (e.clientX - drag.x) / scale;
      const dy = (e.clientY - drag.y) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 2 / scale) drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.view.x -= dx;
      this.view.y -= dy;
      this.clampView();
      this.applyView();
    });
    const end = () => (drag = null);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('click', () => this.hideTip());

    map.querySelectorAll('[data-zoom]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.zoom === 'reset') {
          this.view = { k: 1, x: 0, y: 0 };
          this.applyView();
          return;
        }
        const r = svg.getBoundingClientRect();
        this.zoomAt(btn.dataset.zoom === 'in' ? 1.6 : 1 / 1.6, r.left + r.width / 2, r.top + r.height / 2);
      });
    });
  },

  showTip(i) {
    const tip = document.getElementById('journey-tip');
    const city = this.cities[i];
    const dot = document.querySelector(`.journey-city[data-i="${i}"] .journey-dot`);
    if (!tip || !city || !dot) return;
    const map = document.getElementById('journey-map').getBoundingClientRect();
    const r = dot.getBoundingClientRect();
    tip.textContent = city.name;
    tip.style.left = `${r.left + r.width / 2 - map.left}px`;
    tip.style.top = `${r.top - map.top}px`;
    tip.hidden = false;
  },

  hideTip() {
    const tip = document.getElementById('journey-tip');
    if (tip) tip.hidden = true;
  },

  escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
