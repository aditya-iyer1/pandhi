const Unlock = {
  init() {
    const btn = document.getElementById('lock-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.classList.add('unlocking');
      btn.disabled = true;
      setTimeout(() => {
        App.fadeToScreen('screen-unlock', 'screen-login', 500);
      }, 650);
    });
  },
};

const MosaicMagnifier = {
  ZOOM: 6,
  LENS: 140,

  init() {
    const wrap = document.getElementById('mosaic-wrap');
    const img = document.getElementById('mosaic-img');
    const lens = document.getElementById('mosaic-lens');
    if (!wrap || !img || !lens) return;

    const src = img.currentSrc || img.src;
    lens.style.backgroundImage = `url("${src}")`;

    const move = (clientX, clientY) => {
      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        wrap.classList.remove('magnifying');
        return;
      }

      wrap.classList.add('magnifying');
      const half = this.LENS / 2;
      lens.style.left = `${x - half}px`;
      lens.style.top = `${y - half}px`;

      const bgW = rect.width * this.ZOOM;
      const bgH = rect.height * this.ZOOM;
      lens.style.backgroundSize = `${bgW}px ${bgH}px`;

      // Center the zoomed background on the cursor
      const bgX = -(x * this.ZOOM - half);
      const bgY = -(y * this.ZOOM - half);
      lens.style.backgroundPosition = `${bgX}px ${bgY}px`;
    };

    wrap.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    wrap.addEventListener('mouseenter', (e) => move(e.clientX, e.clientY));
    wrap.addEventListener('mouseleave', () => wrap.classList.remove('magnifying'));

    // Touch: press-and-drag magnifier
    wrap.addEventListener(
      'touchmove',
      (e) => {
        if (!e.touches[0]) return;
        e.preventDefault();
        move(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );
    wrap.addEventListener('touchend', () => wrap.classList.remove('magnifying'));
    wrap.addEventListener('touchcancel', () => wrap.classList.remove('magnifying'));
  },
};

const Login = {
  init() {
    const form = document.getElementById('login-form');
    if (!form) return;

    MosaicMagnifier.init();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('login-error');
      errorEl.textContent = '';
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const u = username.toLowerCase();

      if (u === 'kothi') {
        errorEl.textContent = "Are you sure that's you?";
        return;
      }

      try {
        const data = await App.api('/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });
        App.setUsername(data.username);
        this.enterSite();
      } catch (err) {
        const apiMsg = err.data && err.data.error;
        if (apiMsg === "Are you sure that's you?") {
          errorEl.textContent = apiMsg;
          return;
        }
        if (err.status === 401 || (err.data && err.data.ok === false)) {
          errorEl.textContent = 'Try again!';
          return;
        }
        const okOffline = this.validateOffline(username, password);
        if (okOffline) {
          App.setUsername(username);
          this.enterSite();
        } else {
          errorEl.textContent = 'Try again!';
        }
      }
    });
  },

  enterSite() {
    const from = document.getElementById('screen-login');
    if (from) from.classList.add('fading-out');
    setTimeout(() => {
      App.handleHash();
      if (typeof Letter !== 'undefined') Letter.maybeShow();
      if (typeof Story !== 'undefined') Story.refreshHubLabel();
    }, 400);
  },

  validateOffline(username, password) {
    const u = String(username).toLowerCase().trim();
    const p = String(password).toLowerCase().trim();
    return (u === 'pandhi' || u === 'kothi123') && p === 'puffage';
  },
};
