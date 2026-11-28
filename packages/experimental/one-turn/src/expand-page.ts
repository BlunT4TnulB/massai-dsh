/**
 * The Idea Expander: the mask, as a journey rather than a form.
 *
 * The interview already exists as data (`interview()`), and the readings and shape
 * choices are already endpoints. What was missing is a surface that walks a person
 * from "I have an idea" to "here is a sealed, one-turn-ready prompt" — asking only
 * what changes the build, offering examples at every step, and never asking a
 * question whose answer it cannot use.
 *
 * Free by design: compiling is deterministic, so the whole journey costs nothing
 * until the person decides to build. The page is one document with its own state;
 * every question is rendered from the server's own interview data, so the two can
 * never drift.
 *
 * @module @deepseek-ai/dsh-one-turn/expand-page
 */

/** Ideas worth starting from when someone has none of their own. */
const SEEDS: ReadonlyArray<{ title: string; goal: string }> = [
  { title: 'A page for a lawn care business', goal: 'a one page site for my lawn care business with prices, the area I cover, and my phone number' },
  { title: 'A tip calculator that splits weirdly', goal: 'a tip calculator that splits a bill unevenly between people, with each persons share and a total' },
  { title: 'A parts list and cutting plan', goal: 'a parts list and cutting plan for a 12mm fiber tubing frame, six pieces, with lengths and ferrules' },
  { title: 'A shift schedule for a small crew', goal: 'a weekly shift schedule for four people that shows who works when and warns when someone is double booked' },
  { title: 'A birthday countdown', goal: 'a countdown page for my daughters birthday that shows the days left and a message' },
  { title: 'A reading list I actually keep', goal: 'a reading list where I paste a title and it remembers it in the browser, with a done toggle' },
  { title: 'A CSV dashboard', goal: 'a dashboard for this CSV of monthly revenue, showing the trend and the biggest months' },
  { title: 'A resume from my notes', goal: 'a resume for a warehouse supervisor role from these notes, with a clear structure and marked blanks for what I must fill' },
  { title: 'A workout timer', goal: 'an interval workout timer with rounds, work and rest times, and a beep' },
  { title: 'A packing list for a trip', goal: 'a packing list for a week long trip with categories and a checkbox per item that survives reload' },
  { title: 'A simple invoice', goal: 'an invoice generator that adds up line items and shows tax, print friendly' },
  { title: 'A dark mode landing page', goal: 'a dark landing page for my indie game with a trailer link and a wishlist button' },
]

/** What the Expander knows about each shape, in Massai's voice. */
const INSIGHTS: Readonly<Record<string, { reach: string; expand: readonly string[] }>> = {
  'single-page-site': {
    reach: 'One page, opened straight from a file. Fastest to get right, hardest to look finished — the copy and the spacing do all the work.',
    expand: ['add a prices section with three tiers', 'add a short FAQ from the questions you always get asked', 'add a contact block with the hours you actually keep'],
  },
  'single-file-app': {
    reach: 'One file, real interaction, state kept in the browser. This is where most good ideas belong.',
    expand: ['let it remember your last input', 'add a plain-language summary you can copy', 'add a reset that undoes everything in one press'],
  },
  'data-view': {
    reach: 'A page plus a data file, with the numbers read from the file rather than typed in.',
    expand: ['add a month-by-month view', 'add a "biggest mover" callout', 'add a print view for a meeting'],
  },
  script: {
    reach: 'A single script with its own output. No interface to polish — correctness is everything.',
    expand: ['add a dry-run flag that prints what it would do', 'add a summary at the end', 'make it safe to run twice'],
  },
  document: {
    reach: 'A written artifact with no invented facts and clear blanks for what only you know.',
    expand: ['add a short opening summary', 'mark every blank in one consistent style', 'add a version line at the top'],
  },
}

/** Escape text for HTML interpolation. */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The Idea Expander page.
 * @returns a complete HTML document.
 */
export function expandPageHtml(): string {
  const seeds = JSON.stringify(SEEDS)
  const insights = JSON.stringify(INSIGHTS)
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Idea Expander — Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="robots" content="noindex">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:#0b0b0d;color:#EDE7DA;
    font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6;
    background-image:radial-gradient(60rem 40rem at 20% -10%,rgba(193,68,14,.14),transparent 70%)}
  main{max-width:44rem;margin:0 auto;padding:2.2rem 1.15rem 5rem}
  .brand{display:flex;align-items:center;gap:.55rem;font-size:.72rem;letter-spacing:.3em;color:#c9b389}
  .brand img{width:22px;height:22px}
  h1{font-size:1.55rem;line-height:1.25;margin:1.4rem 0 .4rem;letter-spacing:-.01em}
  .lede{color:#a49a86;margin:0 0 1.6rem;max-width:34rem}
  .step{font-size:.62rem;letter-spacing:.28em;text-transform:uppercase;color:#7d7159;margin:0 0 .3rem}
  .card{border:1px solid #26221d;border-radius:14px;background:rgba(20,18,16,.72);padding:1rem 1.05rem;margin:.7rem 0 1.1rem}
  label{display:block;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:#9b8f78;margin:.1rem 0 .35rem}
  textarea,input[type=text],select{width:100%;background:#12100e;color:#EDE7DA;border:1px solid #332c24;
    border-radius:9px;padding:.65rem .7rem;font:inherit;font-size:.92rem}
  textarea{min-height:5.2rem;resize:vertical}
  textarea:focus,input:focus,select:focus{outline:none;border-color:#8a5f2c}
  .hint{font-size:.76rem;color:#7d7364;margin:.3rem 0 .55rem}
  .row{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}
  button{font:inherit;cursor:pointer;border-radius:9px;padding:.55rem .9rem;border:1px solid #3a3128;
    background:#181512;color:#EDE7DA;transition:border-color .15s ease,background .15s ease}
  button:hover{border-color:#8a5f2c}
  button.primary{background:linear-gradient(180deg,#c1440e,#96330a);border-color:#c1440e;color:#fff;font-weight:600}
  button.ghost{background:transparent}
  button:disabled{opacity:.45;cursor:not-allowed}
  .chips{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem}
  .chip{border:1px solid #332c24;border-radius:999px;padding:.3rem .7rem;font-size:.8rem;cursor:pointer;
    background:#141210;color:#cdbfa5}
  .chip[aria-pressed=true]{background:#2a1a0e;border-color:#c1440e;color:#ffd9a8}
  .seed{display:flex;justify-content:space-between;align-items:center;gap:.6rem;border:1px solid #26221d;
    border-radius:10px;padding:.55rem .7rem;margin:.35rem 0;background:#12100e}
  .seed span{font-size:.86rem;color:#d9cdb7}
  .grid{display:grid;grid-template-columns:1fr;gap:.6rem}
  @media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}
  .kv{display:flex;justify-content:space-between;font-size:.8rem;color:#9b8f78;border-bottom:1px dashed #26221d;padding:.3rem 0}
  .kv b{color:#EDE7DA;font-weight:600}
  pre{margin:.4rem 0 0;white-space:pre-wrap;word-break:break-word;font-size:.74rem;line-height:1.5;
    color:#c8bda9;background:#12100e;border:1px solid #26221d;border-radius:10px;padding:.8rem;max-height:22rem;overflow:auto}
  .insight{border-left:2px solid #c1440e;padding:.15rem 0 .15rem .8rem;margin:.7rem 0;color:#c6b9a2;font-size:.88rem}
  .insight b{color:#ffd9a8;font-weight:600}
  .note{font-size:.76rem;color:#7d7364;margin-top:.5rem}
  .hidden{display:none}
  .toast{position:fixed;left:50%;transform:translateX(-50%);bottom:1.4rem;background:#1b1815;border:1px solid #3a3128;
    border-radius:10px;padding:.6rem 1rem;font-size:.82rem;color:#EDE7DA;opacity:0;transition:opacity .25s ease;pointer-events:none}
  .toast.show{opacity:1}
</style></head><body><main>
<div class="brand"><img src="/massai-crest.svg" alt=""><span>MASSAI · IDEA EXPANDER</span></div>

<h1>Start with a sentence. Leave with a build that cannot miss.</h1>
<p class="lede">Every build that fails, fails on something nobody said out loud. This walks you through
the things that matter, in the order they matter, and seals the result into one prompt. Nothing here
costs anything until you choose to build.</p>

<div class="card">
  <p class="step">Step 1 · the idea</p>
  <label for="goal">What should exist when this is done?</label>
  <textarea id="goal" placeholder="a page for my lawn care business with prices and my phone number"></textarea>
  <p class="hint" id="readLine">One sentence, your own words. Roughness is information — do not tidy it.</p>
  <p class="seedline" id="seedline" aria-live="polite" style="margin:.45rem 0 0;font-size:.82rem;color:#8f8474;min-height:1.4em;transition:opacity .5s ease">
    <span style="color:#6f6553;letter-spacing:.14em;font-size:.62rem;text-transform:uppercase">try</span>
    <button type="button" id="seedUse" style="border:0;background:none;color:#c6b9a2;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0"></button>
  </p>
  <div class="row">
    <button id="random" class="ghost" type="button">Surprise me</button>
    <button id="showSeeds" class="ghost" type="button">Browse starting points</button>
  </div>
  <div id="seeds" class="card hidden" style="margin-top:.7rem;background:#100e0c"></div>
</div>

<div id="stage2" class="hidden">
  <div class="card">
    <p class="step">Step 2 · Massai reads it</p>
    <div id="readings"></div>
    <label for="shape" style="margin-top:.8rem">Closest shape</label>
    <select id="shape"></select>
    <p class="hint" id="reach"></p>
    <div id="expandList"></div>
  </div>

  <div class="card">
    <p class="step">Step 3 · the particulars</p>
    <div id="questions"></div>
  </div>

  <div class="row">
    <button id="compile" class="primary" type="button">Seal it into a prompt</button>
    <button id="reset" class="ghost" type="button">Start over</button>
  </div>
</div>

<div id="stage3" class="hidden">
  <div class="card">
    <p class="step">Step 4 · the sealed prompt</p>
    <div id="facts"></div>
    <div class="row">
      <button id="copy" class="primary" type="button">Copy the prompt</button>
      <button id="openWorkshop" class="ghost" type="button">Open the workshop</button>
      <button id="back" class="ghost" type="button">Back to the questions</button>
    </div>
    <p class="note" id="compileNote"></p>
    <p class="note" id="guestNote" style="margin-top:.4rem"></p>
    <pre id="mask"></pre>
  </div>
</div>

<div class="toast" id="toast"></div>
</main>
<script>
(() => {
  const SEEDS = ${seeds};
  const INSIGHTS = ${insights};
  const $ = (id) => document.getElementById(id);
  const state = { goal: '', shape: '', answers: {} };
  let lastReading = null;
  let typedTimer = 0;
  let questions = [];
  let shapes = [];

  const toast = (text) => {
    const el = $('toast'); el.textContent = text; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  };

  /** A chip list bound to one answer key. */
  const chips = (key, options) => {
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    for (const option of options) {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.textContent = option;
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => {
        const on = chip.getAttribute('aria-pressed') === 'true';
        chip.setAttribute('aria-pressed', on ? 'false' : 'true');
        const set = new Set((state.answers[key] ?? '').split('\\n').filter(Boolean));
        if (on) set.delete(option); else set.add(option);
        state.answers[key] = [...set].join('\\n');
      });
      wrap.append(chip);
    }
    return wrap;
  };

  /** Render the interview questions as controls that suit each one. */
  const renderQuestions = () => {
    const host = $('questions'); host.innerHTML = '';
    for (const q of questions) {
      if (q.key === 'goal' || q.key === 'shape') continue;
      const block = document.createElement('div');
      block.style.margin = '0 0 1rem';
      const label = document.createElement('label');
      label.textContent = q.ask;
      label.setAttribute('for', 'q_' + q.key);
      block.append(label);
      if (q.hint) {
        const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = q.hint;
        block.append(hint);
      }
      const styleChips = q.key === 'styleWords' || q.key === 'mustHave' || q.key === 'nonGoals';
      if (styleChips && q.examples.length > 0) {
        const area = document.createElement('textarea');
        area.id = 'q_' + q.key; area.value = state.answers[q.key] ?? '';
        area.addEventListener('input', () => { state.answers[q.key] = area.value; });
        block.append(area);
        block.append(chips(q.key, q.key === 'styleWords'
          ? ['plain', 'warm', 'dark', 'bold', 'quiet', 'funny', 'technical', 'minimal']
          : q.examples.slice(0, 6)));
      } else {
        const input = document.createElement(q.key === 'details' || q.key === 'acceptance' ? 'textarea'
          : 'textarea');
        input.id = 'q_' + q.key; input.value = state.answers[q.key] ?? '';
        input.placeholder = q.examples[0] ?? '';
        input.addEventListener('input', () => { state.answers[q.key] = input.value; });
        block.append(input);
        if (q.examples.length > 1) {
          const hint = document.createElement('p'); hint.className = 'hint';
          hint.textContent = 'e.g. ' + q.examples.slice(0, 2).join('  ·  ');
          block.append(hint);
        }
      }
      if (q.required) {
        const req = document.createElement('p'); req.className = 'note'; req.textContent = 'required';
        block.append(req);
      }
      host.append(block);
    }
  };

  /** Ask Massai how it is reading the sentence. */
  const renderReadings = async () => {
    const host = $('readings'); host.innerHTML = '';
    try {
      const response = await fetch('/api/one-turn/readings?goal=' + encodeURIComponent(state.goal));
      const data = await response.json();
      lastReading = data.readings.length > 0 ? data.readings[0] : null;
      if (typeof data.suggested === 'string' && !state.shapeTouched) state.shape = data.suggested;
      if (Array.isArray(data.readings) && data.readings.length > 0) {
        const first = document.createElement('div');
        first.className = 'insight';
        first.innerHTML = '<b>Massai reads it as</b> ' + (data.readings[0].means ?? '') +
          (data.readings.length > 1 ? ' · ' + (data.readings.length - 1) + ' other reading(s) possible' : '');
        host.append(first);
      } else {
        const none = document.createElement('div'); none.className = 'insight';
        none.textContent = 'One clear reading. Good — that is rare and worth keeping.';
        host.append(none);
      }
      if (data.ambiguous) {
        const warn = document.createElement('p'); warn.className = 'note';
        warn.textContent = 'This sentence can be read more than one way. The shape below decides which reading the build takes.';
        host.append(warn);
      }
    } catch { /* readings are a courtesy, not a gate */ }
  };

  /** Shape select + the insight for the chosen shape. */
  const renderShapes = () => {
    const select = $('shape');
    select.innerHTML = '';
    for (const choice of shapes) {
      const option = document.createElement('option');
      option.value = choice.shape;
      option.textContent = choice.shape + '  ·  ' + choice.example;
      select.append(option);
    }
    select.value = state.shape || (shapes[0] ? shapes[0].shape : '');
    state.shape = select.value;
    select.addEventListener('change', () => { state.shape = select.value; state.shapeTouched = true; renderInsight(); });
    renderInsight();
  };

  const renderInsight = () => {
    const insight = INSIGHTS[state.shape];
    $('reach').textContent = insight ? insight.reach : '';
    const list = $('expandList'); list.innerHTML = '';
    if (insight === undefined) return;
    const head = document.createElement('p'); head.className = 'hint';
    head.textContent = 'Ways this could grow later — pick one and it becomes part of the brief:';
    list.append(head);
    for (const idea of insight.expand) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'chip'; button.textContent = '+ ' + idea;
      button.addEventListener('click', () => {
        state.answers.mustHave = ((state.answers.mustHave ?? '') + '\\n' + idea.replace(/^add /, '')).trim();
        button.setAttribute('aria-pressed', 'true');
        const area = document.getElementById('q_mustHave');
        if (area) area.value = state.answers.mustHave;
        toast('added to what it must do');
      });
      list.append(button);
    }
  };

  /**
   * Work out the steps for what has been typed so far.
   * @param silent - true while the person is still typing: no scroll, no toast.
   */
  const begin = async (silent) => {
    const typed = $('goal').value.trim();
    if (typed.length < 8) {
      if (silent !== true) toast('give it a sentence first');
      return;
    }
    const changed = typed !== state.goal;
    state.goal = typed;
    $('stage2').classList.remove('hidden');
    if (silent === true) $('readLine').textContent = 'reading it as you type…';
    await renderReadings();
    // The shape follows the sentence until the person chooses one themselves.
    if (shapes.length > 0 && !state.shapeTouched && lastReading !== null && typeof lastReading.shape === 'string') {
      const inferred = shapes.find(choice => choice.shape === lastReading.shape);
      if (inferred !== undefined) state.shape = inferred.shape;
    }
    renderShapes();
    renderQuestions();
    if (silent === true) {
      $('readLine').textContent = changed
        ? 'reading it as you type — the steps below follow your sentence.'
        : 'One sentence, your own words. Roughness is information — do not tidy it.';
      return;
    }
    $('stage2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Prefer the server's compiler; fall back to an honest local preview. */
  const compileNow = async () => {
    const body = {
      goal: state.goal,
      shape: state.shape,
      details: (state.answers.details ?? '').split('\\n').filter(Boolean),
      mustHave: (state.answers.mustHave ?? '').split('\\n').filter(Boolean),
      nonGoals: (state.answers.nonGoals ?? '').split('\\n').filter(Boolean),
      neverInvent: (state.answers.neverInvent ?? '').split('\\n').filter(Boolean),
      styleWords: (state.answers.styleWords ?? '').split('\\n').filter(Boolean),
      acceptance: (state.answers.acceptance ?? '').split('\\n').filter(Boolean),
      audience: state.answers.audience ?? '',
      techLimits: state.answers.techLimits ?? '',
      reference: state.answers.reference ?? '',
      data: state.answers.data ?? '',
      notes: state.answers.notes ?? '',
    };
    $('stage3').classList.remove('hidden');
    $('mask').textContent = 'sealing…';
    try {
      const response = await fetch('/api/one-turn/compile', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.ok === true) {
        $('mask').textContent = data.mask;
        $('facts').innerHTML = [
          ['shape', data.spec.shape],
          ['prompt tokens', String(data.tokens)],
          ['sections', String(data.sections.length)],
          ['cost so far', '$0.00'],
        ].map(([k, v]) => '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>').join('');
        $('compileNote').textContent = 'This is the exact prompt the build receives. Editing the answers regenerates it.';
        $('guestNote').textContent = 'Planning is free and open to anyone. Building it — spending the'
          + ' operator\\'s credit — needs a signed-in session.';
        return;
      }
      if (data.ok === false) {
        $('mask').textContent = data.explain ?? 'The interview needs one more answer before it can be sealed.';
        $('compileNote').textContent = 'Massai would rather ask than guess.';
        return;
      }
      throw new Error('unexpected');
    } catch {
      // No session: show what the answers would send, and say so plainly.
      const preview = ['GOAL', state.goal, '', 'SHAPE', state.shape, '',
        ...Object.entries(state.answers).filter(([, v]) => (v ?? '').trim() !== '')
          .map(([k, v]) => k.toUpperCase() + '\\n' + v),
      ].join('\\n');
      $('mask').textContent = preview;
      $('facts').innerHTML = '<div class="kv"><span>state</span><b>not sealed</b></div>';
      $('compileNote').textContent = 'Sealing needs a signed-in session. These are your answers, ready to paste.';
    }
  };

  $('random').addEventListener('click', () => {
    const pick = SEEDS[Math.floor(Math.random() * SEEDS.length)];
    $('goal').value = pick.goal;
    toast('a starting point: ' + pick.title);
  });
  $('showSeeds').addEventListener('click', () => {
    const host = $('seeds');
    host.innerHTML = '';
    for (const seed of SEEDS) {
      const row = document.createElement('div'); row.className = 'seed';
      const label = document.createElement('span'); label.textContent = seed.title;
      const use = document.createElement('button'); use.type = 'button'; use.textContent = 'use';
      use.addEventListener('click', () => { $('goal').value = seed.goal; host.classList.add('hidden'); toast('idea loaded'); });
      row.append(label, use); host.append(row);
    }
    host.classList.toggle('hidden');
  });
  $('goal').addEventListener('input', () => {
    const text = $('goal').value.trim();
    $('readLine').textContent = text.length === 0
      ? 'One sentence, your own words. Roughness is information — do not tidy it.'
      : 'reading it as you type — the steps below follow your sentence.';
    $('seedline').style.opacity = '0';
    clearTimeout(typedTimer);
    if (text.length < 8) return;
    typedTimer = setTimeout(() => { void begin(true) }, 650);
  });
  document.getElementById('goal').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void begin(); }
  });
  $('compile').addEventListener('click', () => { void compileNow(); });
  $('reset').addEventListener('click', () => { location.reload(); });
  $('back').addEventListener('click', () => { $('stage3').classList.add('hidden'); $('stage2').scrollIntoView({ behavior: 'smooth' }); });
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('mask').textContent); toast('copied'); }
    catch { toast('select the text and copy it'); }
  });
  $('openWorkshop').addEventListener('click', () => { location.href = '/access'; });

  // One suggestion at a time, changing every six seconds, until a person starts to type:
  // the page should feel attended rather than pre-filled.
  let seedIndex = Math.floor(Math.random() * SEEDS.length);
  let seedTimer = 0;
  const paintSeed = () => {
    $('seedUse').textContent = SEEDS[seedIndex % SEEDS.length].title.toLowerCase();
    $('seedline').style.opacity = '1';
  };
  const nextSeed = () => {
    seedIndex += 1;
    $('seedline').style.opacity = '0';
    setTimeout(paintSeed, 500);
  };
  paintSeed();
  seedTimer = setInterval(() => {
    if ($('goal').value.trim() !== '') { clearInterval(seedTimer); return }
    nextSeed();
  }, 6000);
  $('seedUse').addEventListener('click', () => {
    $('goal').value = SEEDS[seedIndex % SEEDS.length].goal;
    $('seedline').style.opacity = '0';
    clearInterval(seedTimer);
    void begin(true);
  });

  $('goal').addEventListener('blur', () => { if ($('goal').value.trim().length >= 8) void begin(true); });

  // The interview and the shapes come from the server, so they cannot drift from the build.
  void (async () => {
    try {
      const response = await fetch('/api/one-turn/intake');
      const data = await response.json();
      questions = Array.isArray(data.questions) ? data.questions : [];
      shapes = Array.isArray(data.shapes) ? data.shapes : [];
    } catch { /* the page still works with the text boxes */ }
  })();
})();
</script>
</body></html>`
}

/** Keep the escaper referenced for future edits. */
void esc
