const Story = {
  data: null,
  progress: null,
  map: null,
  markers: {},
  guessMarker: null,
  activeId: null,
  placingEnabled: true,

  init() {},

  async load() {
    const root = document.getElementById('story-root');
    if (!root) return;
    root.innerHTML = `<p class="empty-state">Loading Our Story…</p>`;

    try {
      const [dataRes, progress] = await Promise.all([
        fetch('data/story.json').then((r) => r.json()),
        App.api('/story'),
      ]);
      this.data = dataRes;
      this.progress = progress;
      this.updateHubLabel();
      this.render();
    } catch (err) {
      console.error(err);
      root.innerHTML = `<p class="empty-state">Could not load Our Story. Is the backend running?</p>`;
    }
  },

  updateHubLabel() {
    const label = document.getElementById('story-hub-label');
    const title = document.getElementById('story-panel-title');
    const unlocked = this.progress?.titleUnlocked;
    const text = unlocked
      ? this.data?.titleUnlocked || 'Our Story'
      : this.data?.titleLocked || '?????';
    if (label) label.textContent = text;
    if (title) title.textContent = text;
  },

  isCompleted(id) {
    return !!this.progress?.locations?.find((l) => l.location_id === id && l.completed);
  },

  isUnlocked(id) {
    if (id === 1) return true;
    return this.isCompleted(id - 1);
  },

  /** Next location the player should find on the map */
  currentTarget() {
    return this.data.locations.find((l) => this.isUnlocked(l.id) && !this.isCompleted(l.id)) || null;
  },

  locationById(id) {
    return this.data.locations.find((l) => l.id === id);
  },

  /** Haversine distance in meters */
  distanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  },

  render() {
    const root = document.getElementById('story-root');
    const target = this.currentTarget();
    root.innerHTML = `
      <div class="story-layout">
        <div class="story-hint-card" id="story-hint-card"></div>
        <div id="story-map" class="story-map"></div>
        <p class="story-progress-label">${this.progress.completedCount} / 21 places found</p>
        <p class="story-place-msg" id="story-place-msg" aria-live="polite"></p>
      </div>
      <div class="story-modal" id="story-modal" hidden>
        <div class="story-modal-card">
          <button type="button" class="lightbox-close" id="story-modal-close" aria-label="Close">×</button>
          <h3 id="story-modal-title"></h3>
          <p class="hint" id="story-modal-hint"></p>
          <div id="story-game-root"></div>
        </div>
      </div>
      <div class="story-confetti" id="story-confetti" hidden></div>
    `;

    this.renderHintCard(target);

    document.getElementById('story-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('story-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'story-modal') this.closeModal();
    });

    this.initMap();
  },

  renderHintCard(target) {
    const card = document.getElementById('story-hint-card');
    if (!card) return;
    if (this.progress.titleUnlocked) {
      card.innerHTML = `
        <p class="story-hint-label">Journey complete</p>
        <p class="story-hint-text">All 21 places found — tap a sticker to replay.</p>`;
      return;
    }
    if (!target) {
      card.innerHTML = `<p class="story-hint-text">Loading…</p>`;
      return;
    }
    card.innerHTML = `
      <p class="story-hint-label">Place ${target.id} of 21 — tap the map to drop a pin</p>
      <p class="story-hint-text">“${this.escape(target.hint)}”</p>
      <p class="hint story-hint-sub">Use the hint to find the spot. Close is close enough.</p>`;
  },

  escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  initMap() {
    const el = document.getElementById('story-map');
    if (!el || typeof L === 'undefined') {
      if (el) el.innerHTML = `<p class="empty-state">Map library failed to load.</p>`;
      return;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
      this.markers = {};
      this.guessMarker = null;
    }

    const start = this.data.mapStart;
    this.map = L.map(el, { scrollWheelZoom: true }).setView([start.lat, start.lng], start.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    // Only show stickers for locations already completed — never reveal unfinished targets
    this.data.locations.forEach((loc) => {
      if (this.isCompleted(loc.id)) this.addCompletedMarker(loc);
    });

    this.placingEnabled = !this.progress.titleUnlocked;
    this.map.on('click', (e) => this.onMapClick(e));

    this.frameForProgress(false);

    if (this.progress.titleUnlocked) {
      this.celebrate(false);
    }

    setTimeout(() => this.map.invalidateSize(), 100);
  },

  frameForProgress(animate) {
    const completed = this.data.locations.filter((l) => this.isCompleted(l.id));
    const target = this.currentTarget();

    if (this.progress.titleUnlocked && completed.length) {
      const bounds = L.latLngBounds(completed.map((l) => [l.lat, l.lng]));
      this.map.fitBounds(bounds.pad(0.25), { animate: !!animate, duration: 1.1, maxZoom: 6 });
      return;
    }

    // Frame a region (not the exact pin) so the answer isn't revealed by the camera
    if (target) {
      const view = this.regionView(target);
      if (animate) this.map.flyTo([view.lat, view.lng], view.zoom, { duration: 1.1 });
      else this.map.setView([view.lat, view.lng], view.zoom);
      return;
    }

    const start = this.data.mapStart;
    this.map.setView([start.lat, start.lng], start.zoom);
  },

  /** Approximate camera for a location — nearby, not exact */
  regionView(loc) {
    if (loc.radiusM >= 2000) {
      // City-scale: center loosely in the metro area
      return { lat: loc.lat + 0.04, lng: loc.lng - 0.03, zoom: 10 };
    }
    // Campus / IV: keep the whole neighborhood in view
    return { lat: 34.4125, lng: -119.855, zoom: 14 };
  },

  addCompletedMarker(loc) {
    if (this.markers[loc.id]) return;
    const icon = L.divIcon({
      className: 'story-pin done',
      html: `<span class="story-pin-emoji">${loc.sticker}</span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(this.map);
    marker.on('click', () => this.openLocation(loc.id));
    this.markers[loc.id] = marker;
  },

  clearGuess() {
    if (this.guessMarker) {
      this.map.removeLayer(this.guessMarker);
      this.guessMarker = null;
    }
  },

  onMapClick(e) {
    if (!this.placingEnabled) return;
    const target = this.currentTarget();
    if (!target) return;

    this.clearGuess();
    const icon = L.divIcon({
      className: 'story-pin guess',
      html: `<span class="story-pin-emoji">📍</span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 36],
    });
    this.guessMarker = L.marker(e.latlng, { icon }).addTo(this.map);

    const dist = this.distanceM(e.latlng.lat, e.latlng.lng, target.lat, target.lng);
    const radius = target.radiusM || 500;
    const msg = document.getElementById('story-place-msg');

    if (dist <= radius) {
      if (msg) msg.textContent = `Found it — ${target.name}!`;
      this.placingEnabled = false;
      setTimeout(() => {
        this.clearGuess();
        this.addCompletedMarker(target);
        this.openLocation(target.id);
        this.placingEnabled = true;
      }, 450);
    } else {
      if (msg) {
        const nice =
          dist < 1000
            ? `${Math.round(dist)}m away — try again`
            : `${(dist / 1000).toFixed(1)}km away — try again`;
        msg.textContent = nice;
      }
    }
  },

  openLocation(id) {
    if (!this.isUnlocked(id)) return;
    // Only open if found (completed) OR just found this session (current target after pin)
    // After successful pin we open before complete — allow if completed OR is current target
    const loc = this.locationById(id);
    const solved = this.isCompleted(id);
    if (!solved && this.currentTarget()?.id !== id) return;

    this.activeId = id;
    const modal = document.getElementById('story-modal');
    document.getElementById('story-modal-title').textContent = loc.name;
    document.getElementById('story-modal-hint').textContent = loc.hint;
    const gameRoot = document.getElementById('story-game-root');
    gameRoot.innerHTML = '';

    StoryGames.mount(gameRoot, loc.game, loc.content, {
      solved,
      onSolved: () => this.completeLocation(id),
    });

    modal.hidden = false;
    modal.classList.add('open');
  },

  closeModal() {
    const modal = document.getElementById('story-modal');
    modal?.classList.remove('open');
    if (modal) modal.hidden = true;
    const gameRoot = document.getElementById('story-game-root');
    const wordle = gameRoot?.querySelector('.sg-wordle');
    if (wordle?._cleanup) wordle._cleanup();
    this.activeId = null;

    // If they closed without finishing the mini-game, remove premature sticker
    const incomplete = this.data.locations.find(
      (l) => this.markers[l.id] && !this.isCompleted(l.id)
    );
    if (incomplete) {
      this.map.removeLayer(this.markers[incomplete.id]);
      delete this.markers[incomplete.id];
    }
    this.renderHintCard(this.currentTarget());
    const msg = document.getElementById('story-place-msg');
    if (msg) msg.textContent = '';
  },

  async completeLocation(id) {
    try {
      const result = await App.api(`/story/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ username: App.username }),
      });
      this.progress = result;
      this.updateHubLabel();

      const loc = this.locationById(id);
      if (!this.markers[id]) this.addCompletedMarker(loc);

      const next = this.currentTarget();
      this.renderHintCard(next);

      const prog = document.querySelector('.story-progress-label');
      if (prog) prog.textContent = `${result.completedCount} / 21 places found`;

      const msg = document.getElementById('story-place-msg');
      if (msg) msg.textContent = next ? 'Next hint is ready — find it on the map.' : '';

      if (next) {
        setTimeout(() => this.frameForProgress(true), 500);
      }

      if (result.titleUnlocked) {
        this.placingEnabled = false;
        setTimeout(() => {
          this.frameForProgress(true);
          this.celebrate(true);
        }, 800);
      }

      if (this.activeId === id) {
        const gameRoot = document.getElementById('story-game-root');
        if (gameRoot) {
          StoryGames.mount(gameRoot, loc.game, loc.content, {
            solved: true,
            onSolved: () => {},
          });
        }
      }
    } catch (err) {
      alert(err.message || 'Could not save progress');
    }
  },

  celebrate(showConfetti) {
    if (!showConfetti) return;
    const layer = document.getElementById('story-confetti');
    if (!layer) return;
    layer.hidden = false;
    layer.innerHTML = Array.from({ length: 40 }, () => {
      const x = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const emoji = ['💖', '✨', '🎉', '💕', '⭐'][Math.floor(Math.random() * 5)];
      return `<span style="left:${x}%;animation-delay:${delay}s">${emoji}</span>`;
    }).join('');
    setTimeout(() => {
      layer.hidden = true;
      layer.innerHTML = '';
    }, 4000);
  },

  async refreshHubLabel() {
    try {
      const [data, progress] = await Promise.all([
        this.data ? Promise.resolve(this.data) : fetch('data/story.json').then((r) => r.json()),
        App.api('/story'),
      ]);
      this.data = data;
      this.progress = progress;
      this.updateHubLabel();
    } catch {
      // keep ?????
    }
  },
};
