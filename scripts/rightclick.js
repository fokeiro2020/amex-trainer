// ============================================================
// RIGHT CLICK ENABLER
// Works in current frame and all iframes
// ============================================================

function enableRightClick(doc) {
  if (!doc) return;

  // Remove inline handlers
  doc.oncontextmenu = null;
  doc.onselectstart = null;
  if (doc.body) {
    doc.body.oncontextmenu = null;
    doc.body.onselectstart = null;
  }

  // Stop contextmenu suppression but don't prevent default (we want the menu)
  doc.addEventListener('contextmenu', (e) => {
    e.stopImmediatePropagation();
  }, true);

  // Allow right mouse button
  doc.addEventListener('mousedown', (e) => {
    if (e.button === 2) e.stopImmediatePropagation();
  }, true);

  // Force text selectable via CSS
  const style = doc.createElement('style');
  style.id = '__amex_rightclick__';
  // Avoid double injection
  if (!doc.getElementById('__amex_rightclick__')) {
    style.textContent = `* { user-select: text !important; -webkit-user-select: text !important; }`;
    doc.documentElement.appendChild(style);
  }
}
