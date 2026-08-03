const LETTER_SEEN_KEY = 'puffage_birthday_letter_seen';

const Letter = {
  TITLE: 'Happy 21st Birthday Pandhi!!!',

  PARAGRAPHS: [
    "Naa dearest bangaram pandhi, happy 21st birthday!! I love you so so so so sooooo much and I'm so excited for your big day! Now that you're finally 21, we can go to the club and the bars together and I get to experience everything I've been waiting to do for so long with you. We can be Clive Bixby & Julianna, Jim & Pam, Monica & Chandler, Nick & Jessica, Marshall & Lilly (though I don't like them), Ben & Leslie, and all the countless other tv couples we've watched on our own for so long.",
    "Hopefully I'm right there next to you opening this, and here to celebrate your big day! I know long distance has been so hard for both of us, and it's the most evil unfair thing ever, but I'm SO excited and have done so much planning for when we're done and I just can't wait for it to be over. But that aside, I still value and cherish the times we are able to spend together, the time's we've had online playing games, on facetime calls, or even just sleeping in silence across from each other.",
    "That being said, let's go back to the main event - your 21st birthday!!! Now you can finally go to to bars and order drinks (since you've definitely never drank before) and go clubbing, which I'm sure you're gonna love. All I ask is that you take me along with you :). Happy birthday bangaram!!",
  ],

  SIGNOFF: '- Your kothi',

  init() {
    document.getElementById('letter-close')?.addEventListener('click', () => this.close());
    document.getElementById('letter-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'letter-overlay') this.close();
    });
    document.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('letter-overlay');
      if (e.key === 'Escape' && overlay?.classList.contains('open')) this.close();
    });
  },

  hasBeenSeen() {
    return localStorage.getItem(LETTER_SEEN_KEY) === '1';
  },

  markSeen() {
    localStorage.setItem(LETTER_SEEN_KEY, '1');
  },

  /** Show once for pandhi after login / returning visit. */
  maybeShow() {
    if (App.username !== 'pandhi' || this.hasBeenSeen()) return;
    this.open();
  },

  fullText() {
    return [this.TITLE, '', ...this.PARAGRAPHS, '', this.SIGNOFF].join('\n\n');
  },

  open() {
    const overlay = document.getElementById('letter-overlay');
    const body = document.getElementById('letter-body');
    if (!overlay || !body) return;

    body.innerHTML =
      this.PARAGRAPHS.map((p) => `<p>${escapeHtml(p)}</p>`).join('') +
      `<p class="signoff">${escapeHtml(this.SIGNOFF)}</p>`;

    overlay.hidden = false;
    // Force reflow so opacity transition runs
    void overlay.offsetWidth;
    overlay.classList.add('open');
  },

  async close() {
    const overlay = document.getElementById('letter-overlay');
    if (!overlay) return;

    const alreadySeen = this.hasBeenSeen();
    this.markSeen();

    overlay.classList.remove('open');
    setTimeout(() => {
      overlay.hidden = true;
    }, 350);

    if (!alreadySeen) {
      await this.saveAsMessage();
    }
  },

  async saveAsMessage() {
    try {
      await App.api('/messages', {
        method: 'POST',
        body: JSON.stringify({
          username: 'kothi123',
          text: this.fullText(),
          drawing_data_url: null,
        }),
      });
    } catch (err) {
      console.warn('Could not save birthday letter to messages:', err);
    }
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
