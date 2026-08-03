/**
 * Photo data layer — decoupled from display so a map view can be added later.
 */
const PhotoData = {
  albums: null,

  async getAlbums() {
    if (this.albums) return this.albums;
    const res = await fetch('data/albums.json');
    this.albums = await res.json();
    return this.albums;
  },

  async getAlbum(index) {
    const albums = await this.getAlbums();
    return albums[index] || null;
  },
};

const Albums = {
  view: 'list', // 'list' | 'album'
  currentIndex: null,
  lightboxIndex: 0,
  lightboxPhotos: [],

  init() {
    document.getElementById('lightbox-close')?.addEventListener('click', () => this.closeLightbox());
    document.getElementById('lightbox-prev')?.addEventListener('click', () => this.navLightbox(-1));
    document.getElementById('lightbox-next')?.addEventListener('click', () => this.navLightbox(1));
    document.getElementById('lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') this.closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      const box = document.getElementById('lightbox');
      if (!box?.classList.contains('open')) return;
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navLightbox(-1);
      if (e.key === 'ArrowRight') this.navLightbox(1);
    });
  },

  async showList() {
    this.view = 'list';
    this.currentIndex = null;
    const title = document.getElementById('albums-title');
    const root = document.getElementById('albums-root');
    if (title) title.textContent = 'Photo Albums';
    if (!root) return;

    try {
      const albums = await PhotoData.getAlbums();
      root.innerHTML = `
        <div class="album-grid">
          ${albums
            .map(
              (a, i) => `
            <button type="button" class="album-card" data-album-index="${i}">
              <img src="${escapeAttr(a.cover)}" alt="" loading="lazy" />
              <span class="album-name">${escapeHtml(a.name)}</span>
            </button>`
            )
            .join('')}
        </div>`;
      root.querySelectorAll('[data-album-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.openAlbum(Number(btn.dataset.albumIndex));
        });
      });
    } catch {
      root.innerHTML = `<p class="empty-state">Could not load albums.</p>`;
    }
  },

  async openAlbum(index) {
    const album = await PhotoData.getAlbum(index);
    if (!album) return;
    this.view = 'album';
    this.currentIndex = index;
    const title = document.getElementById('albums-title');
    const root = document.getElementById('albums-root');
    if (title) title.textContent = album.name;
    if (!root) return;

    root.innerHTML = `
      <p style="margin:0 0 1rem;max-width:900px;margin-inline:auto">
        <button type="button" class="btn-ghost" id="albums-back-list">← All albums</button>
      </p>
      <div class="photo-grid">
        ${(album.photos || [])
          .map(
            (src, i) => `
          <button type="button" class="photo-thumb" data-photo-index="${i}">
            <img src="${escapeAttr(src)}" alt="" loading="lazy" />
          </button>`
          )
          .join('')}
      </div>`;

    document.getElementById('albums-back-list')?.addEventListener('click', () => this.showList());
    root.querySelectorAll('[data-photo-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openLightbox(album.photos, Number(btn.dataset.photoIndex));
      });
    });
  },

  openLightbox(photos, index) {
    this.lightboxPhotos = photos;
    this.lightboxIndex = index;
    const box = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (!box || !img) return;
    img.src = photos[index];
    box.classList.add('open');
  },

  navLightbox(delta) {
    if (!this.lightboxPhotos.length) return;
    this.lightboxIndex =
      (this.lightboxIndex + delta + this.lightboxPhotos.length) % this.lightboxPhotos.length;
    const img = document.getElementById('lightbox-img');
    if (img) img.src = this.lightboxPhotos[this.lightboxIndex];
  },

  closeLightbox() {
    document.getElementById('lightbox')?.classList.remove('open');
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
