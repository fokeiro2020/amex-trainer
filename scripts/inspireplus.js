// ============================================================
// INSPIREPLUS RUNNER — For Angular/InspirePlus platform
// ============================================================

class InspirePlusRunner {
  constructor(doc, win, callbacks) {
    this.doc = doc;
    this.win = win;
    this.log = callbacks.log || console.log;
    this.sendStats = callbacks.sendStats || (() => {});
    this.sendStatus = callbacks.sendStatus || (() => {});

    this.stopped = false;
    this.paused = false;
    this.stats = { content: 0, next: 0, home: 0, close: 0, tryagain: 0 };
  }

  stop() { this.stopped = true; this.paused = false; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  humanClick(el) {
    if (!el) return false;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    ['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t =>
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
    );
    return true;
  }

  isEnabled(el) {
    if (!el) return false;
    const aria = el.getAttribute('aria-disabled');
    if (aria && aria.toLowerCase() === 'true') return false;
    if (el.disabled) return false;
    return true;
  }

  normalize(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  // ── Buttons ───────────────────────────────────────────────

  getRetryButton() {
    const doc = this.doc;
    let btn = doc.getElementById('RETRY_BUTTON_OBJ');
    if (btn && this.isEnabled(btn)) return btn;
    btn = doc.getElementById('RETRY_BUTTON');
    if (btn && this.isEnabled(btn)) return btn;
    btn = doc.querySelector('button[aria-label="Retry"]');
    if (btn && this.isEnabled(btn)) return btn;
    btn = doc.querySelector('.ip-retryBtn');
    if (btn && this.isEnabled(btn)) return btn;
    return null;
  }

  isQAQuiz() {
    return !!this.doc.getElementById('PIE_PERC_QUICK_QUIZ_PROGRESS');
  }

  clickNextIfAble() {
    const doc = this.doc;
    const next = doc.getElementById('NAV_NEXT');
    if (next && this.isEnabled(next)) {
      this.log('NAV_NEXT → clicking', 'info');
      this.humanClick(next);
      this.stats.next++;
      this.sendStats(this.stats);
      return true;
    }
    const pageNext = doc.querySelector('a.pageNum[aria-label="Next"][aria-disabled="false"]');
    if (pageNext) {
      this.log('Pagination Next → clicking', 'info');
      this.humanClick(pageNext);
      this.stats.next++;
      this.sendStats(this.stats);
      return true;
    }
    const nextIcon = doc.getElementById('NEXT_ICON');
    if (nextIcon) {
      const parentLink = nextIcon.closest('a[aria-label="Next"]');
      if (parentLink && parentLink.getAttribute('aria-disabled') !== 'true') {
        this.log('NEXT_ICON → clicking', 'info');
        this.humanClick(parentLink);
        this.stats.next++;
        this.sendStats(this.stats);
        return true;
      }
    }
    return false;
  }

  clickSubmit() {
    const btn = this.doc.getElementById('IP_SAQ_SUBMIT_BUTTON');
    if (btn && this.isEnabled(btn)) {
      this.log('Submit → clicking', 'info');
      this.humanClick(btn);
      return true;
    }
    return false;
  }

  clickSwitchToText() {
    const btn = this.doc.getElementById('BTN_TEXT_MODE');
    if (btn && this.isEnabled(btn)) {
      this.log('Switch to Text → clicking', 'info');
      this.humanClick(btn);
      return true;
    }
    return false;
  }

  // ── Answer options ────────────────────────────────────────

  getAnswerOptions() {
    const doc = this.doc;

    const radioLis = doc.querySelectorAll('li[id^="radio-"]');
    if (radioLis.length > 0) {
      return {
        type: 'radio',
        options: Array.from(radioLis).map((li, i) => ({
          li, input: doc.getElementById(`SAQ_RADIO_0_OPTION_${i}`),
          text: li.innerText?.trim(),
          textNorm: this.normalize(li.innerText?.trim()),
          index: i
        }))
      };
    }

    const checkboxLis = doc.querySelectorAll('li[id^="chk-"]');
    if (checkboxLis.length > 0) {
      return {
        type: 'checkbox',
        options: Array.from(checkboxLis).map((li, i) => ({
          li, input: doc.getElementById(`SAQ_CHECKBOX_0_OPTION_${i}`),
          text: li.innerText?.trim(),
          textNorm: this.normalize(li.innerText?.trim()),
          index: i
        }))
      };
    }

    const radioInputs = doc.querySelectorAll('input[id^="SAQ_RADIO_0_OPTION_"]');
    if (radioInputs.length > 0) {
      return {
        type: 'radio',
        options: Array.from(radioInputs).map((input, i) => {
          const li = input.closest('li');
          return { li, input, text: li?.innerText?.trim() || `Option ${i+1}`, textNorm: this.normalize(li?.innerText?.trim() || ''), index: i };
        })
      };
    }

    const checkboxInputs = doc.querySelectorAll('input[id^="SAQ_CHECKBOX_0_OPTION_"]');
    if (checkboxInputs.length > 0) {
      return {
        type: 'checkbox',
        options: Array.from(checkboxInputs).map((input, i) => {
          const li = input.closest('li');
          return { li, input, text: li?.innerText?.trim() || `Option ${i+1}`, textNorm: this.normalize(li?.innerText?.trim() || ''), index: i };
        })
      };
    }

    return { type: null, options: [] };
  }

  // ── SCORM API answer lookup ───────────────────────────────

  loadCorrectAnswers() {
    const answers = [];
    const seenIds = new Set();
    try {
      const api = this.win.parent?.SCORM2004_objAPI || this.win.top?.SCORM2004_objAPI;
      if (!api) { this.log('SCORM2004_objAPI not found', 'warn'); return answers; }

      for (let i = 0; i < 200; i++) {
        const id = api.GetValue(`cmi.interactions.${i}.id`);
        const correct = api.GetValue(`cmi.interactions.${i}.correct_responses.0.pattern`);
        const desc = api.GetValue(`cmi.interactions.${i}.description`);
        if (!id && !correct && !desc) break;
        if (!id || seenIds.has(id)) continue;
        if (correct) {
          seenIds.add(id);
          const correctParts = correct.split(/\[,\]|,(?![^\[]*\])/).map(s => s.trim()).filter(Boolean);
          const correctNorms = correctParts.map(p => this.normalize(p));
          answers.push({ index: i, id, correct, correctParts, correctNorms, isMulti: correctParts.length > 1, desc });
          this.log(`Q[${id.split('-').pop()}]: "${correct.substring(0,50)}"`, 'info');
        }
      }
      this.log(`Loaded ${answers.length} unique answers`, 'success');
    } catch(e) {
      this.log(`SCORM error: ${e.message}`, 'error');
    }
    return answers;
  }

  // ── Match scoring ─────────────────────────────────────────

  matchScore(optNorm, ansNorm) {
    if (!optNorm || !ansNorm || optNorm.length < 5) return 0;
    const optLen = optNorm.length;
    const ansLen = ansNorm.length;
    if (optNorm === ansNorm) return 100;
    if (ansNorm.includes(optNorm) && optLen / ansLen > 0.5) return 90;
    if (optNorm.includes(ansNorm) && ansLen / optLen > 0.5) return 85;
    if (optLen >= 20 && ansLen >= 20 && optNorm.substring(0,20) === ansNorm.substring(0,20)) return 80;
    return 0;
  }

  async selectCorrectOptions(optionData, allAnswers) {
    const { type, options } = optionData;

    if (type === 'radio') {
      let bestOption = null;
      let bestScore = 0;
      for (let opt of options) {
        for (let ans of allAnswers) {
          for (let ansNorm of ans.correctNorms) {
            const score = this.matchScore(opt.textNorm, ansNorm);
            if (score > bestScore) { bestScore = score; bestOption = { opt, ans, score }; }
          }
        }
      }
      if (bestOption && bestScore >= 80) {
        const { opt } = bestOption;
        this.log(`Radio match (${bestScore}%): "${opt.text}"`, 'success');
        if (opt.li) this.humanClick(opt.li);
        if (opt.input) opt.input.click();
        return true;
      }
      return false;
    }

    if (type === 'checkbox') {
      let bestAns = null;
      let bestTotalScore = 0;

      for (let ans of allAnswers) {
        let totalScore = 0;
        let matchCount = 0;
        for (let correctNorm of ans.correctNorms) {
          let bestOptScore = 0;
          for (let opt of options) {
            const score = this.matchScore(opt.textNorm, correctNorm);
            if (score > bestOptScore) bestOptScore = score;
          }
          if (bestOptScore >= 80) { totalScore += bestOptScore; matchCount++; }
        }
        if (matchCount >= ans.correctNorms.length && totalScore > bestTotalScore) {
          bestTotalScore = totalScore;
          bestAns = { ans, matchCount };
        }
      }

      if (bestAns) {
        this.log(`Checkbox match: ${bestAns.matchCount} correct options`, 'success');
        // Uncheck all first
        options.forEach(opt => {
          if (opt.input && opt.input.checked) { if (opt.li) this.humanClick(opt.li); opt.input.click(); }
        });
        await this.sleep(300);

        let selectedCount = 0;
        for (let correctNorm of bestAns.ans.correctNorms) {
          let bestOpt = null; let bestScore = 0;
          for (let opt of options) {
            const score = this.matchScore(opt.textNorm, correctNorm);
            if (score > bestScore) { bestScore = score; bestOpt = opt; }
          }
          if (bestOpt && bestScore >= 80) {
            this.log(`Checking: "${bestOpt.text}"`, 'info');
            if (bestOpt.li) this.humanClick(bestOpt.li);
            if (bestOpt.input) bestOpt.input.click();
            selectedCount++;
            await this.sleep(300);
          }
        }
        return selectedCount > 0;
      }

      // Fallback: select all
      this.log('No checkbox match - selecting all', 'warn');
      options.forEach(opt => { if (opt.li) this.humanClick(opt.li); if (opt.input && !opt.input.checked) opt.input.click(); });
      return true;
    }

    return false;
  }

  // ── Q&A Quiz mode ─────────────────────────────────────────

  async handleQAQuizMode() {
    this.log('Q&A Quiz detected — starting two-pass solver', 'info');
    this.sendStatus('running', 'Q&A Quiz — Pass 1');

    const isComplete100 = () => {
      const el = this.doc.getElementById('PIE_PERC_QUICK_QUIZ_PROGRESS');
      return el && el.innerText.trim() === '100%';
    };

    // Pass 1: populate SCORM data
    let pass1Steps = 0;
    while (pass1Steps < 25 && !this.stopped) {
      pass1Steps++;
      if (this.paused) { await this.sleep(1000); continue; }
      if (this.getRetryButton()) { this.log(`Pass 1 done (${pass1Steps} steps)`, 'success'); break; }

      const { options } = this.getAnswerOptions();
      if (options.length > 0) {
        const opt = options[0];
        if (opt.li) this.humanClick(opt.li);
        if (opt.input) opt.input.click();
        await this.sleep(500);
        if (!this.clickSubmit()) {
          if (this.clickNextIfAble()) await this.sleep(2000);
          else await this.sleep(1000);
        } else {
          await this.sleep(2000);
        }
      } else {
        if (this.clickNextIfAble()) await this.sleep(2000);
        else await this.sleep(1000);
      }
    }

    // Load unique correct answers
    this.sendStatus('running', 'Loading correct answers...');
    await this.sleep(1000);
    const allAnswers = this.loadCorrectAnswers();

    if (allAnswers.length === 0) {
      this.log('No answers loaded!', 'error');
      return true;
    }

    // Click Retry
    const retryBtn = this.getRetryButton();
    if (!retryBtn) { this.log('Retry not found!', 'error'); return true; }
    this.humanClick(retryBtn);
    this.log('Clicked Retry — starting Pass 2', 'info');
    await this.sleep(3000);

    // Pass 2: answer correctly
    this.sendStatus('running', 'Q&A Quiz — Pass 2 (answering correctly)');
    let pass2Steps = 0;
    const triedFallback = {};

    while (pass2Steps < 30 && !this.stopped) {
      pass2Steps++;
      if (this.paused) { await this.sleep(1000); continue; }

      if (isComplete100()) { this.log('PERFECT SCORE! 100%!', 'success'); break; }

      if (this.getRetryButton()) {
        const scoreEl = this.doc.getElementById('PIE_PERC_QUICK_QUIZ_PROGRESS');
        this.log(`Done! Score: ${scoreEl?.innerText?.trim()}`, 'success');
        break;
      }

      const optionData = this.getAnswerOptions();
      const { options } = optionData;

      if (options.length > 0) {
        const selected = await this.selectCorrectOptions(optionData, allAnswers);

        if (!selected) {
          const key = options.map(o => o.textNorm).join('|');
          if (!triedFallback[key]) triedFallback[key] = new Set();
          const tried = triedFallback[key];
          let nextIdx = -1;
          for (let i = 0; i < options.length; i++) { if (!tried.has(i)) { nextIdx = i; break; } }
          if (nextIdx === -1) { tried.clear(); nextIdx = 0; }
          tried.add(nextIdx);
          const opt = options[nextIdx];
          this.log(`Fallback option ${nextIdx+1}: "${opt.text}"`, 'warn');
          if (opt.li) this.humanClick(opt.li);
          if (opt.input) opt.input.click();
        }

        await this.sleep(800);

        if (!this.clickSubmit()) {
          if (this.clickNextIfAble()) await this.sleep(2500);
          else await this.sleep(1000);
        } else {
          await this.sleep(2500);
        }
      } else {
        if (this.clickNextIfAble()) await this.sleep(2500);
        else await this.sleep(1500);
      }
    }

    await this.sleep(1000);
    if (this.clickNextIfAble()) await this.sleep(2000);

    return true;
  }

  // ── Main loop ──────────────────────────────────────────────

  async start() {
    this.log('InspirePlus runner started', 'success');
    this.sendStatus('running', 'Scanning...');

    while (!this.stopped) {
      try {
        if (this.paused) { await this.sleep(1000); continue; }

        if (this.clickSwitchToText()) { await this.sleep(2000); continue; }

        if (this.isQAQuiz()) {
          await this.handleQAQuizMode();
          await this.sleep(1000);
          continue;
        }

        if (this.clickNextIfAble()) { await this.sleep(2000); continue; }

        await this.sleep(800);
      } catch(e) {
        this.log(`Error: ${e.message}`, 'error');
        await this.sleep(2000);
      }
    }

    this.log('InspirePlus runner stopped', 'warn');
    this.sendStatus('stopped');
  }
}
