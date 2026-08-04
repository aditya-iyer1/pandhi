const Hub = {
  ANNIVERSARY_START: '2025-03-21',

  init() {
    document.querySelectorAll('.hub-panel').forEach((btn) => {
      btn.addEventListener('click', () => {
        App.openPanel(btn.dataset.panel);
      });
    });
    this.renderCounters();
  },

  /** Local calendar date at noon to avoid DST edge cases */
  parseDay(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  },

  today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
  },

  daysBetween(from, to) {
    const ms = to.getTime() - from.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  },

  addYears(date, years) {
    return new Date(date.getFullYear() + years, date.getMonth(), date.getDate(), 12, 0, 0, 0);
  },

  renderDaysTogether() {
    const el = document.getElementById('hub-days-together');
    if (!el) return;
    const start = this.parseDay(this.ANNIVERSARY_START);
    const days = this.daysBetween(start, this.today());
    const n = Math.max(0, days);
    el.textContent = `${n} day${n === 1 ? '' : 's'} since March 21, 2025`;
  },

  async renderNextAnniversary() {
    const el = document.getElementById('hub-next-anni');
    if (!el) return;

    try {
      const res = await fetch('data/timeline.json');
      const entries = await res.json();
      const today = this.today();

      const upcoming = entries
        .map((e) => {
          const original = this.parseDay(e.date);
          const oneYear = this.addYears(original, 1);
          return {
            title: e.title,
            anniversary: oneYear,
            daysUntil: this.daysBetween(today, oneYear),
          };
        })
        .filter((e) => e.daysUntil >= 0)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      if (!upcoming.length) {
        el.textContent = '';
        return;
      }

      const next = upcoming[0];
      if (next.daysUntil === 0) {
        el.textContent = `Today is the 1 year anniversary of ${next.title}`;
      } else {
        el.textContent = `${next.daysUntil} day${next.daysUntil === 1 ? '' : 's'} until 1 year anniversary of ${next.title}`;
      }
    } catch {
      el.textContent = '';
    }
  },

  renderCounters() {
    this.renderDaysTogether();
    this.renderNextAnniversary();
  },
};
