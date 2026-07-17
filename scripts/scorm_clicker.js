// ============================================================
// SCORM AUTO-CLICKER — For slide-object platform
// ============================================================

class ScormAutoClicker {
  constructor(doc, win, callbacks) {
    this.doc = doc;
    this.win = win;
    this.log = callbacks.log || console.log;
    this.sendStats = callbacks.sendStats || (() => {});
    this.sendStatus = callbacks.sendStatus || (() => {});

    this.stopped = false;
    this.paused = false;
    this.submitMode = false;

    this.stats = { content: 0, next: 0, home: 0, close: 0, tryagain: 0 };
  }

  stop() { this.stopped = true; this.paused = false; this.submitMode = false; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Event firing ──────────────────────────────────────────

  fireEvents(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const image = el.querySelector('image');
    const svg = el.querySelector('svg');
    const eventableG = el.querySelector('g.eventable');
    const path = el.querySelector('path');

    ['mouseover','mouseenter','mousedown','mouseup','click'].forEach(eventType => {
      const event = new MouseEvent(eventType, {
        view: this.win, bubbles: true, cancelable: true,
        clientX: x, clientY: y,
        which: ['mousedown','mouseup','click'].includes(eventType) ? 1 : 0,
        button: ['mousedown','mouseup','click'].includes(eventType) ? 0 : undefined
      });
      if (image) image.dispatchEvent(event);
      if (path) path.dispatchEvent(event);
      if (eventableG) eventableG.dispatchEvent(event);
      if (svg) svg.dispatchEvent(event);
      el.dispatchEvent(event);
    });
  }

  clickBtn(btn, label) {
    if (!btn) return;
    this.log(`Clicking ${label}...`, 'info');
    this.fireEvents(btn);
  }

  // ── Helpers ────────────────────────────────────────────────

  isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = this.win.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
           style.opacity !== '0' && style.display !== 'none' &&
           style.visibility !== 'hidden';
  }

  getSvgText(el) {
    if (!el) return '';
    let text = '';
    el.querySelectorAll('tspan').forEach(t => text += t.textContent.trim() + ' ');
    return text.toLowerCase().trim();
  }

  getDisplayText(el) {
    if (!el) return '';
    return (el.getAttribute('data-acc-text') || '').trim() || this.getSvgText(el);
  }

  // ── Button finders ────────────────────────────────────────

  findSubmitButton() {
    const doc = this.doc;
    const direct = doc.querySelector('[data-acc-text="Submit"].cursor-hover, .cursor-hover[data-acc-text*="Submit"]');
    if (direct && this.isVisible(direct)) return direct;
    const allBtns = doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]');
    for (let btn of allBtns) {
      if (this.getSvgText(btn) === 'submit' && this.isVisible(btn)) return btn;
    }
    return null;
  }

  hasTryAgainButton() {
    const doc = this.doc;
    const direct = doc.querySelector('[data-acc-text="Try Again"].cursor-hover');
    if (direct && this.isVisible(direct)) return direct;
    const stategroups = doc.querySelectorAll('.slide-object-stategroup.cursor-hover');
    for (let group of stategroups) {
      if (group.querySelector('[data-acc-text="Try Again"]') && this.isVisible(group)) return group;
    }
    const allBtns = doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]');
    for (let btn of allBtns) {
      if (this.getSvgText(btn) === 'try again' && this.isVisible(btn)) return btn;
    }
    return null;
  }

  getSuccessMessageType() {
    const doc = this.doc;
    if (doc.querySelector('[data-acc-text*="You can now select the Close button"]')) return 'close';
    if (doc.querySelector('[data-acc-text*="successfully completed"]')) return 'home';
    if (doc.querySelector('[data-acc-text*="Select the Home button to return to the Main"]')) return 'home';
    const allEls = doc.querySelectorAll('.slide-object[data-display-name="SlideObject"]');
    for (let el of allEls) {
      const text = this.getSvgText(el);
      if (text.includes('you can now select the close button') || text.includes('navigator training completion page')) return 'close';
      if (text.includes('successfully completed') && text.includes('knowledge check')) return 'home';
      if (text.includes('select the home button to return to the main menu')) return 'home';
    }
    return null;
  }

  findHomeButton() {
    const doc = this.doc;
    const direct = doc.querySelector('[data-acc-text="Home"].cursor-hover[data-display-name="SlideObject"]');
    if (direct) return direct;
    const allBtns = doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]');
    for (let btn of allBtns) { if (this.getSvgText(btn) === 'home') return btn; }
    return null;
  }

  findCloseButton() {
    const doc = this.doc;
    const direct = doc.querySelector('[data-acc-text="Close"].cursor-hover[data-display-name="SlideObject"]');
    if (direct) return direct;
    const allBtns = doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]');
    for (let btn of allBtns) { if (this.getSvgText(btn) === 'close') return btn; }
    return null;
  }

  findActiveNextButton() {
    const doc = this.doc;
    const allBtns = doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]');
    const nextBtns = Array.from(allBtns).filter(btn => {
      const accText = btn.getAttribute('data-acc-text') || '';
      return accText.toLowerCase().includes('next') || this.getSvgText(btn).includes('next');
    });
    if (nextBtns.length === 0) return null;
    if (nextBtns.length === 1) return nextBtns[0];
    return nextBtns.reduce((best, btn) =>
      parseInt(btn.style.zIndex || '0') > parseInt(best.style.zIndex || '0') ? btn : best
    );
  }

  async tryClickNext() {
    const nextBtn = this.findActiveNextButton();
    if (nextBtn) {
      this.log(`Next → "${this.getDisplayText(nextBtn)}"`, 'info');
      this.fireEvents(nextBtn);
      this.stats.next++;
      this.sendStats(this.stats);
      await this.sleep(3000);
      return true;
    }
    return false;
  }

  // ── Main menu detection ───────────────────────────────────

  isMainMenu() {
    const doc = this.doc;
    const checkmarks = doc.querySelectorAll('[data-acc-text="check.png"]');
    if (checkmarks.length === 0) return false;
    return Array.from(checkmarks).some(c => {
      const img = c.querySelector('image');
      return img?.getAttribute('data-original-image') === '02';
    });
  }

  findNextUnfinishedModule() {
    const doc = this.doc;
    const allCheckmarks = doc.querySelectorAll('[data-acc-text="check.png"]');
    const undonePx = Array.from(allCheckmarks)
      .filter(c => c.querySelector('image')?.getAttribute('data-original-image') === '02')
      .map(c => {
        const m = c.style.transform.match(/translate\([\d.]+px,\s*([\d.]+)px\)/);
        return m ? parseFloat(m[1]) : null;
      }).filter(y => y !== null);

    if (undonePx.length === 0) return null;

    const moduleBtns = doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]');
    const candidates = Array.from(moduleBtns).filter(btn => {
      const accText = (btn.getAttribute('data-acc-text') || '').toLowerCase();
      if (['close','help','home','back','menu'].some(k => accText.includes(k))) return false;
      if (accText.includes('.png') || accText.includes('.jpg') || !accText.trim()) return false;
      const m = btn.style.transform.match(/translate\([\d.]+px,\s*([\d.]+)px\)/);
      if (!m) return false;
      const btnY = parseFloat(m[1]);
      return undonePx.some(cy => Math.abs(btnY - cy) <= 20);
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const getY = el => { const m = el.style.transform.match(/translate\([\d.]+px,\s*([\d.]+)px\)/); return m ? parseFloat(m[1]) : 0; };
      return getY(a) - getY(b);
    });

    return candidates[0];
  }

  // ── Content buttons ───────────────────────────────────────

  BLOCKED = ['check','next','.png','.jpg','close','help','home','back','menu','icon','logo','arrow','submit','try again','retry','rectangular hotspot'];

  findContentButtons() {
    const doc = this.doc;
    return Array.from(doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]'))
      .filter(btn => {
        const accText = (btn.getAttribute('data-acc-text') || '').toLowerCase();
        const svgText = this.getSvgText(btn);
        const combined = (accText + ' ' + svgText).trim();
        if (accText.includes('check') || btn.classList.contains('cursor-default')) return false;
        const image = btn.querySelector('image');
        if (image) {
          const href = image.getAttribute('xlink:href') || image.getAttribute('href') || '';
          if (href.toLowerCase().includes('check')) return false;
        }
        if (this.BLOCKED.some(k => combined.includes(k))) return false;
        return !!combined;
      });
  }

  // ── Answer options for quiz ───────────────────────────────

  findAnswerOptions() {
    const doc = this.doc;
    return Array.from(doc.querySelectorAll('.slide-object.cursor-hover[data-display-name="SlideObject"]'))
      .filter(btn => {
        if (!this.isVisible(btn)) return false;
        if (btn.classList.contains('cursor-default')) return false;
        const image = btn.querySelector('image');
        if (image) {
          const href = image.getAttribute('xlink:href') || image.getAttribute('href') || '';
          if (href.toLowerCase().includes('check')) return false;
        }
        const combined = ((btn.getAttribute('data-acc-text') || '') + ' ' + this.getSvgText(btn)).trim().toLowerCase();
        if (!combined) return false;
        if (this.BLOCKED.some(k => combined.includes(k))) return false;
        return true;
      });
  }

  // ── Submit mode ───────────────────────────────────────────

  async runSubmitMode() {
    this.log('SUBMIT MODE activated', 'info');
    this.sendStatus('running', 'Submit Mode — Quiz');
    this.submitMode = true;
    const triedIndices = new Set();
    let checkCount = 0;

    while (!this.stopped && this.submitMode && checkCount < 80) {
      checkCount++;
      if (this.paused) { await this.sleep(1000); continue; }

      const successType = this.getSuccessMessageType();
      if (successType) {
        this.log(`Success! Type: ${successType}`, 'success');
        await this.sleep(2000);
        if (successType === 'close') {
          const btn = this.findCloseButton();
          if (btn) { this.clickBtn(btn, 'Close'); this.stats.close++; await this.sleep(3000); }
        } else {
          const btn = this.findHomeButton();
          if (btn) { this.clickBtn(btn, 'Home'); this.stats.home++; await this.sleep(3000); }
        }
        this.sendStats(this.stats);
        await this.tryClickNext();
        this.submitMode = false;
        this.log('Exiting Submit Mode', 'info');
        return true;
      }

      if (this.findActiveNextButton() && !this.hasTryAgainButton()) {
        this.log('Correct answer — Next available', 'success');
        await this.tryClickNext();
        this.submitMode = false;
        return true;
      }

      const tryAgainBtn = this.hasTryAgainButton();
      if (tryAgainBtn) {
        this.log('Wrong answer — clicking Try Again', 'warn');
        this.clickBtn(tryAgainBtn, 'Try Again');
        this.stats.tryagain++;
        this.sendStats(this.stats);
        await this.sleep(2500);
      }

      const answerOptions = this.findAnswerOptions();
      if (answerOptions.length > 0) {
        let nextIdx = -1;
        for (let i = 0; i < answerOptions.length; i++) {
          if (!triedIndices.has(i)) { nextIdx = i; break; }
        }
        if (nextIdx === -1) { triedIndices.clear(); nextIdx = 0; }
        triedIndices.add(nextIdx);

        this.log(`Trying option ${nextIdx + 1}/${answerOptions.length}`, 'info');
        this.fireEvents(answerOptions[nextIdx]);
        await this.sleep(800);

        const submitBtn = this.findSubmitButton();
        if (submitBtn) {
          this.clickBtn(submitBtn, 'Submit');
          await this.sleep(2500);
        } else {
          if (await this.tryClickNext()) { this.submitMode = false; return true; }
          await this.sleep(1000);
        }
      } else {
        if (await this.tryClickNext()) { this.submitMode = false; return true; }
        await this.sleep(1000);
      }

      if (triedIndices.size > 0 && answerOptions.length > 0 && triedIndices.size >= answerOptions.length * 3) {
        await this.tryClickNext();
        this.submitMode = false;
        break;
      }
    }

    this.submitMode = false;
    return false;
  }

  // ── Main loop ──────────────────────────────────────────────

  async start() {
    this.log('SCORM Auto-Clicker started', 'success');
    this.sendStatus('running', 'Scanning page...');

    while (!this.stopped) {
      try {
        if (this.paused) { await this.sleep(1000); continue; }

        // Main menu
        if (this.isMainMenu()) {
          this.sendStatus('running', 'Main Menu — selecting module');
          const nextModule = this.findNextUnfinishedModule();
          if (nextModule) {
            const label = nextModule.getAttribute('data-acc-text');
            this.log(`Clicking module: "${label}"`, 'info');
            this.clickBtn(nextModule, label);
            await this.sleep(4000);
            continue;
          } else {
            this.log('All modules complete!', 'success');
            await this.sleep(3000);
            continue;
          }
        }

        // Submit mode
        const submitBtn = this.findSubmitButton();
        if (submitBtn) {
          await this.runSubmitMode();
          if (this.stopped) break;
          continue;
        }

        // Content buttons
        const contentBtns = this.findContentButtons();
        if (contentBtns.length > 0) {
          this.sendStatus('running', `Clicking ${contentBtns.length} content button(s)`);
          for (let btn of contentBtns) {
            if (this.stopped) break;
            this.log(`Content: "${this.getDisplayText(btn).substring(0,40)}"`, 'info');
            this.fireEvents(btn);
            this.stats.content++;
            this.sendStats(this.stats);
            await this.sleep(1000);
          }
          await this.sleep(1000);
        }

        if (this.stopped) break;

        if (await this.tryClickNext()) {
          this.sendStatus('running', 'Navigating to next page');
          continue;
        }

        this.sendStatus('running', 'Waiting...');
        await this.sleep(2000);
        await this.tryClickNext();

      } catch(e) {
        this.log(`Error: ${e.message}`, 'error');
        await this.sleep(2000);
      }
    }

    this.log('SCORM Auto-Clicker stopped', 'warn');
    this.sendStatus('stopped');
  }
}
