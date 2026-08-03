const Messages = {
  drawing: false,
  color: '#3d3530',
  undoStack: [],
  canvas: null,
  ctx: null,

  init() {
    this.canvas = document.getElementById('draw-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resetCanvas();

    document.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.color = btn.dataset.color;
      });
    });

    document.getElementById('draw-clear')?.addEventListener('click', () => {
      this.pushUndo();
      this.resetCanvas();
    });

    document.getElementById('draw-undo')?.addEventListener('click', () => this.undo());

    const start = (e) => {
      this.drawing = true;
      this.pushUndo();
      this.draw(e);
    };
    const move = (e) => {
      if (!this.drawing) return;
      this.draw(e);
    };
    const end = () => {
      this.drawing = false;
      this.ctx.beginPath();
    };

    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    this.canvas.addEventListener('mouseup', end);
    this.canvas.addEventListener('mouseleave', end);

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      start(e.touches[0]);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      move(e.touches[0]);
    }, { passive: false });
    this.canvas.addEventListener('touchend', end);

    document.getElementById('message-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
  },

  resetCanvas() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.beginPath();
  },

  pushUndo() {
    if (!this.canvas) return;
    this.undoStack.push(this.canvas.toDataURL('image/png'));
    if (this.undoStack.length > 30) this.undoStack.shift();
  },

  undo() {
    if (!this.undoStack.length || !this.ctx) return;
    const prev = this.undoStack.pop();
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
  },

  pointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  },

  draw(e) {
    const { x, y } = this.pointerPos(e);
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = this.color;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  },

  isCanvasBlank() {
    const blank = document.createElement('canvas');
    blank.width = this.canvas.width;
    blank.height = this.canvas.height;
    const bctx = blank.getContext('2d');
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(0, 0, blank.width, blank.height);
    return this.canvas.toDataURL() === blank.toDataURL();
  },

  async load() {
    const root = document.getElementById('messages-list');
    if (!root) return;
    root.innerHTML = `<p class="empty-state">Loading…</p>`;
    try {
      const messages = await App.api('/messages');
      if (!messages.length) {
        root.innerHTML = `<p class="empty-state">No messages yet — be the first!</p>`;
        return;
      }
      // API returns newest first; featured = most recent
      const [featured, ...rest] = messages;
      root.innerHTML = `
        <div class="message-featured">
          <p class="message-meta">Latest · ${escapeHtml(App.displayName(featured.username))} · ${escapeHtml(this.fmtTime(featured.created_at))}</p>
          <p>${escapeHtml(featured.text)}</p>
          ${featured.drawing_data_url ? `<img src="${escapeAttr(featured.drawing_data_url)}" alt="Drawing" />` : ''}
        </div>
        ${
          rest.length
            ? `<div class="message-history">
                <h3 style="margin:1.5rem 0 0.5rem">Earlier</h3>
                ${rest
                  .map(
                    (m) => `
                  <div class="message-item">
                    <p class="message-meta">${escapeHtml(App.displayName(m.username))} · ${escapeHtml(this.fmtTime(m.created_at))}</p>
                    <p>${escapeHtml(m.text)}</p>
                    ${m.drawing_data_url ? `<img src="${escapeAttr(m.drawing_data_url)}" alt="Drawing" />` : ''}
                  </div>`
                  )
                  .join('')}
              </div>`
            : ''
        }`;
    } catch {
      root.innerHTML = `<p class="empty-state">Could not load messages. Is the backend running?</p>`;
    }
  },

  fmtTime(iso) {
    try {
      return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z').toLocaleString();
    } catch {
      return iso;
    }
  },

  async submit() {
    const errorEl = document.getElementById('message-error');
    const textEl = document.getElementById('message-text');
    errorEl.textContent = '';
    if (!App.requireAuth()) return;

    const text = textEl.value.trim();
    if (!text) {
      errorEl.textContent = 'Write a little something first.';
      return;
    }

    const drawing_data_url = this.isCanvasBlank() ? null : this.canvas.toDataURL('image/png');

    try {
      await App.api('/messages', {
        method: 'POST',
        body: JSON.stringify({
          username: App.username,
          text,
          drawing_data_url,
        }),
      });
      textEl.value = '';
      this.undoStack = [];
      this.resetCanvas();
      await this.load();
    } catch {
      errorEl.textContent = 'Could not send. Try again in a moment.';
    }
  },
};
