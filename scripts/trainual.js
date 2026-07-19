// ============================================================
// TRAINUAL RUNNER — For Trainual platform
// ============================================================

class TrainualRunner {
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

  stop() { this.stopped = true; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Intercept fetch to capture answer key ─────────────────

  interceptFetch() {
    const win = this.win;
    const self = this;

    if (win._amexFetchIntercepted) {
      this.log('Fetch already intercepted', 'info');
      return;
    }

    const _fetch = win.fetch;
    win.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      const res = await _fetch.apply(this, args);
      if (url?.includes('trainual') && url?.includes('attempt')) {
        res.clone().json().then(data => {
          if (data?.data?.answered_questions?.length) {
            win._answerKey = {};
            data.data.answered_questions.forEach(q => {
              const correctOptions = q.options.filter(o => o.correct === true);
              win._answerKey[q.id] = {
                optionIds: correctOptions.map(o => o.id),
                texts: correctOptions.map(o => o.text.replace(/\n/g, ' ')),
                type: q.answer_type
              };
            });
            self.log(`✅ Answer key ready! ${Object.keys(win._answerKey).length} questions captured`, 'success');
          }
        }).catch(() => {});
      }
      return res;
    };

    win._amexFetchIntercepted = true;
    this.log('Fetch intercepted — answer randomly then answers will load automatically', 'info');
  }

  // ── Auto-complete questions ───────────────────────────────

  async autoComplete() {
    const win = this.win;
    const doc = this.doc;
    let answered = 0;

    while (!this.stopped) {
      if (this.paused) { await this.sleep(1000); continue; }

      const input = doc.querySelector('.choices-radio-field input, .choices-checkbox-field input');
      if (!input) {
        this.log('No more questions found', 'info');
        break;
      }

      // Get question ID via React fiber
      const fk = Object.keys(input).find(k => k.startsWith('__reactFiber'));
      let f = input[fk];
      let qid = null;
      for (let i = 0; i < 15; i++) {
        if (f?.memoizedProps?.question?.id) { qid = f.memoizedProps.question.id; break; }
        f = f?.return;
      }

      if (!qid || !win._answerKey?.[qid]) {
        this.log(`⚠️ No answer for Q${qid} — answer key not ready yet`, 'warn');
        this.sendStatus('paused', 'Waiting for answer key...');
        await this.sleep(2000);
        continue;
      }

      const answer = win._answerKey[qid];
      this.log(`Q${qid}: ${answer.texts.join(' | ')}`, 'success');
      this.sendStatus('running', `Answering Q${qid}`);

      // Click correct options
      answer.optionIds.forEach(optId => {
        const el = doc.getElementById(`radio-option-${optId}`) ||
                   doc.getElementById(`checkbox-option-${optId}`);
        if (el) el.click();
      });

      answered++;
      this.stats.content = answered;
      this.sendStats(this.stats);

      await this.sleep(700);

      // Click Next
      const btn = doc.getElementById('next-survey-question-button');
      if (!btn || btn.disabled) {
        this.log('🏁 All questions done!', 'success');
        this.sendStatus('running', 'Complete!');
        break;
      }
      btn.click();
      this.stats.next++;
      this.sendStats(this.stats);
      await this.sleep(1200);
    }

    this.log(`Trainual complete — ${answered} questions answered`, 'success');
  }

  // ── Main start ────────────────────────────────────────────

  async start() {
    this.log('Trainual runner started', 'success');
    this.sendStatus('running', 'Intercepting fetch...');

    // Intercept fetch first
    this.interceptFetch();

    // Wait a moment then try auto-complete
    // If answer key isn't ready, it will wait
    await this.sleep(1000);

    if (this.win._answerKey && Object.keys(this.win._answerKey).length > 0) {
      this.log('Answer key already available — starting auto-complete', 'info');
      await this.autoComplete();
    } else {
      this.log('Answer key not ready yet. Answer a question manually to trigger fetch capture, then click Start again.', 'warn');
      this.sendStatus('paused', 'Waiting — answer one question manually first');
    }
  }
}
