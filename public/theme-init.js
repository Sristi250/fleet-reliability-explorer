// Apply a saved Light/Dark choice before the page paints, so there is no flash.
// A separate file (not inline) because the Content-Security-Policy blocks inline scripts.
try {
  var t = localStorage.getItem('theme')
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t
} catch {
  // Storage blocked: follow the system setting.
}
