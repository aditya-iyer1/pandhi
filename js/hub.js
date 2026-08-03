const Hub = {
  init() {
    document.querySelectorAll('.hub-panel').forEach((btn) => {
      btn.addEventListener('click', () => {
        App.openPanel(btn.dataset.panel);
      });
    });
  },
};
