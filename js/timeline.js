const Timeline = {
  loaded: false,
  observer: null,

  init() {
    // no-op; load on panel open
  },

  async load() {
    const list = document.getElementById('timeline-list');
    if (!list) return;

    try {
      const res = await fetch('data/timeline.json');
      const entries = await res.json();
      entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      list.innerHTML = entries
        .map(
          (e) => `
        <article class="timeline-entry">
          <p class="date">${this.formatDate(e.date)}</p>
          <h3>${this.escape(e.title)}</h3>
          ${e.image ? `<img src="${this.escapeAttr(e.image)}" alt="${this.escapeAttr(e.title)}" loading="lazy" />` : ''}
          <p class="caption">${this.escape(e.caption || '')}</p>
        </article>`
        )
        .join('');

      if (this.observer) this.observer.disconnect();
      this.observer = new IntersectionObserver(
        (items) => {
          items.forEach((item) => {
            if (item.isIntersecting) {
              item.target.classList.add('visible');
              this.observer.unobserve(item.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      list.querySelectorAll('.timeline-entry').forEach((el) => this.observer.observe(el));
      this.loaded = true;
    } catch (err) {
      list.innerHTML = `<p class="empty-state">Could not load timeline.</p>`;
    }
  },

  formatDate(iso) {
    try {
      const d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  },

  escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  escapeAttr(str) {
    return this.escape(str).replace(/'/g, '&#39;');
  },
};
