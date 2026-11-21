/** Our Journey: a black-and-white US map that turns to color around the places we've been. */
const Journey = {
  VIEW_W: 975,
  VIEW_H: 610,
  REVEAL_R: 34,
  // One color per state (by FIPS id), so neighbouring states we visit later look distinct.
  COLORS: ['#e58c99', '#7cc4a8', '#7fb2cc', '#efca7a', '#b79fd0'],
  data: null,
  us: null,
  cities: [],

  init() {},

  async load() {
    const root = document.getElementById('journey-root');
    if (!root) return;
    if (!this.data) root.innerHTML = `<p class="empty-state">Loading Our Journey…</p>`;

    try {
      const [data, us] = await Promise.all([
        fetch('data/journey.json').then((r) => r.json()),
        this.us || fetch('data/us-states.json').then((r) => r.json()),
      ]);
      this.data = data;
      this.us = us;
      this.render(root);
    } catch (err) {
      console.error(err);
      root.innerHTML = `<p class="empty-state">Could not load Our Journey.</p>`;
    }
  },

  render(root) {
    const projection = d3.geoAlbersUsa().scale(1300).translate([this.VIEW_W / 2, this.VIEW_H / 2]);
    const path = d3.geoPath(projection);
    const features = topojson.feature(this.us, this.us.objects.states).features;

    this.cities = (this.data.cities || [])
      .map((c) => {
        const xy = projection([c.lng, c.lat]);
        return xy ? { ...c, x: xy[0], y: xy[1] } : null;
      })
      .filter(Boolean);

    const statePaths = features.map((f) => ({ d: path(f), color: this.COLORS[Number(f.id) % this.COLORS.length] }));

    const reveals = this.cities
      .map(
        (c, i) =>
          `<circle class="journey-reveal" style="--i:${i}" cx="${c.x}" cy="${c.y}" r="${this.REVEAL_R}" fill="url(#journey-glow)" />`
      )
      .join('');

    const dots = this.cities
      .map(
        (c, i) => `
        <g class="journey-city" data-i="${i}" tabindex="0" role="button" aria-label="${this.escape(c.name)}">
          <circle class="journey-pulse" cx="${c.x}" cy="${c.y}" r="6" />
          <circle class="journey-dot" cx="${c.x}" cy="${c.y}" r="5.5" />
          <circle class="journey-hit" cx="${c.x}" cy="${c.y}" r="15" />
        </g>`
      )
      .join('');

    const n = this.cities.length;
    root.innerHTML = `
      <div class="journey-layout">
        <div class="journey-map" id="journey-map">
          <svg viewBox="0 0 ${this.VIEW_W} ${this.VIEW_H}" role="img" aria-label="Map of the United States, in color where we have been">
            <defs>
              <radialGradient id="journey-glow">
                <stop offset="0" stop-color="#fff" />
                <stop offset="0.7" stop-color="#fff" />
                <stop offset="1" stop-color="#fff" stop-opacity="0" />
              </radialGradient>
              <mask id="journey-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${this.VIEW_W}" height="${this.VIEW_H}">
                ${reveals}
              </mask>
            </defs>
            <g class="journey-base">${statePaths.map((s) => `<path d="${s.d}" />`).join('')}</g>
            <g class="journey-color" mask="url(#journey-mask)">
              ${statePaths.map((s) => `<path d="${s.d}" fill="${s.color}" />`).join('')}
            </g>
            <g class="journey-cities">${dots}</g>
          </svg>
          <div class="journey-tip" id="journey-tip" hidden></div>
        </div>
        <p class="journey-count">${n} place${n === 1 ? '' : 's'} so far — more to color in</p>
        <ul class="journey-list">
          ${this.cities
            .map((c, i) => `<li><button type="button" class="journey-chip" data-i="${i}">${this.escape(c.name)}</button></li>`)
            .join('')}
        </ul>
      </div>
    `;

    this.bind(root);
  },

  bind(root) {
    const map = root.querySelector('#journey-map');
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
    root.querySelectorAll('.journey-chip').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showTip(Number(btn.dataset.i));
      });
    });
    map.addEventListener('click', () => this.hideTip());
  },

  showTip(i) {
    const tip = document.getElementById('journey-tip');
    const city = this.cities[i];
    if (!tip || !city) return;
    tip.textContent = city.name;
    tip.style.left = `${(city.x / this.VIEW_W) * 100}%`;
    tip.style.top = `${(city.y / this.VIEW_H) * 100}%`;
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
