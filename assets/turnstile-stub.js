(function () {
  if (window.turnstile) return;
  window.turnstile = {
    render: function (_el, opts) {
      try {
        if (opts && typeof opts.callback === 'function') {
          setTimeout(function () { opts.callback('offline-token'); }, 0);
        }
      } catch (_e) {}
      return 'offline-turnstile';
    },
    reset: function () {},
    remove: function () {}
  };
})();
