/**
 * The front door for asking: a single box, a mind behind it, an answer with a source.
 *
 * This is the everyday-use surface. It is deliberately taller and calmer than the chat —
 * one question, one answer, one follow-up at a time — and it hands anything worth building
 * over to the Expander rather than trying to be both things at once.
 *
 * @module @deepseek-ai/dsh-hosted-signin/ask-page
 */

/** Questions worth showing as the rotating placeholder. */
const PROMPTS: readonly string[] = [
  'how long does cooked rice keep in the fridge?',
  'what does a barometer actually measure?',
  'best way to store fresh ginger?',
  'why does the moon look bigger near the horizon?',
  'what should I cook with half a cabbage?',
  'how do I stop a wooden board from warping?',
  'what is the difference between baking soda and powder?',
  'how much water does a person need a day, honestly?',
]

/**
 * The ask page.
 * @param signedIn - whether the caller may spend the mind's answers.
 * @returns a complete HTML document.
 */
export function askPageHtml(signedIn: boolean): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ask Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<meta name="description" content="Ask Massai one thing and get a short answer with the source it used.">
<style>
  *{box-sizing:border-box}
  :root{--ink:#EDE7DA;--dim:#9c9180;--faint:#6f6553;--line:#2a241d;--amber:#ffd9a8}
  html,body{margin:0;min-height:100%;background:#0b0a09;color:var(--ink);
    font:16px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif;
    background-image:radial-gradient(50rem 34rem at 50% -12%,rgba(193,68,14,.16),transparent 72%)}
  main{max-width:38rem;margin:0 auto;padding:2.2rem 1.1rem calc(3rem + env(safe-area-inset-bottom))}
  .brand{display:flex;align-items:center;gap:.5rem;font-size:.68rem;letter-spacing:.3em;color:#c9b389}
  .brand img{width:20px;height:20px}
  h1{font-size:1.5rem;line-height:1.25;margin:1.5rem 0 .3rem;letter-spacing:-.01em}
  .lede{color:var(--dim);margin:0 0 1.3rem;max-width:30rem}
  form{display:flex;gap:.5rem;align-items:stretch}
  input[type=text]{flex:1;min-width:0;background:#12100e;border:1px solid var(--line);border-radius:12px;
    color:var(--ink);padding:.85rem .9rem;font:inherit;font-size:1rem}
  input[type=text]:focus{outline:none;border-color:#8a5f2c}
  button{font:inherit;cursor:pointer;border-radius:12px;padding:.8rem 1rem;border:1px solid #3a3128;
    background:#181512;color:var(--ink)}
  button.primary{background:linear-gradient(180deg,#c1440e,#96330a);border-color:#c1440e;color:#fff;font-weight:600}
  button.ghost{background:transparent}
  button:disabled{opacity:.45;cursor:not-allowed}
  .row{display:flex;gap:.45rem;flex-wrap:wrap;margin-top:.6rem}
  .hint{font-size:.78rem;color:var(--faint);margin:.7rem 0 0;min-height:1.2em}
  .thread{margin:1.6rem 0 0;display:grid;gap:1rem}
  .turn{border-top:1px solid var(--line);padding-top:.9rem}
  .q{color:var(--dim);font-size:.92rem;margin:0 0 .45rem;letter-spacing:.01em}
  .a{margin:0;font-size:1.02rem;line-height:1.6;color:#f3ecdf}
  .src{margin:.5rem 0 0;font-size:.76rem;color:var(--faint)}
  .src a{color:#c9b389}
  .fail{color:#e8b8a6}
  .foot{margin-top:2rem;font-size:.76rem;color:var(--faint);line-height:1.7}
  .foot a{color:#9c9180}
  .spin{display:inline-block;width:.8em;height:.8em;border:1.5px solid #8a7c62;border-top-color:transparent;
    border-radius:50%;animation:spin .8s linear infinite;vertical-align:-.05em;margin-right:.4rem}
  @keyframes spin{to{transform:rotate(360deg)}}
  .signin{border:1px solid #5a3a12;background:#1d1710;border-radius:12px;padding:.9rem 1rem;margin:1.2rem 0 0}
  .signin a{color:#ffd9a8}
</style></head><body><main>
<div class="brand"><img src="/massai-crest.svg" alt=""><span>MASSAI</span></div>
<h1>Ask it one thing.</h1>
<p class="lede">A short answer, in the mind's own voice, and the source it used. If the answer is worth
building, it hands you to the Expander — this page is for questions, not projects.</p>

${signedIn ? '' : `<div class="signin"><b>Sign in to ask.</b> The thinking is for people who came in —
<a href="/access">/access</a> — while the mind itself stays open to anyone.</div>`}

<form id="askForm" ${signedIn ? '' : 'aria-disabled="true"'}>
  <input id="q" type="text" autocomplete="off" placeholder="${PROMPTS[0]}" ${signedIn ? '' : 'disabled'}>
  ${signedIn ? '<button id="send" class="primary" type="submit">Ask</button>' : ''}
</form>
<div class="row">
  <button id="listen" class="ghost" type="button" ${signedIn ? '' : 'disabled'}>Speak it</button>
  <button id="aloud" class="ghost" type="button" aria-pressed="false">Read answers aloud</button>
  <a href="/expand"><button class="ghost" type="button">Make something instead →</button></a>
  <button id="fresh" class="ghost" type="button">Start over</button>
</div>
<p class="hint" id="hint"></p>
<div class="thread" id="thread"></div>
<p class="foot">Answers are model output with one public reference consulted first, so they can be wrong —
check the source on anything that matters. Costs the operator about six hundredths of a cent a question.
<a href="/limits">Every limit, printed →</a></p>
</main>
<script>
(() => {
  const PROMPTS = ${JSON.stringify(PROMPTS)}
  const signedIn = ${signedIn ? 'true' : 'false'}
  const $ = (id) => document.getElementById(id)
  const thread = $('thread')
  const input = $('q')
  const hint = $('hint')
  let aloud = false
  /** The last few exchanges, sent with the next question so a follow-up lands. */
  const conversation = []

  // The placeholder rotates, so the page suggests rather than waits.
  let promptIndex = 0
  setInterval(() => {
    if (input.value.trim() !== '') return
    promptIndex = (promptIndex + 1) % PROMPTS.length
    input.placeholder = PROMPTS[promptIndex]
  }, 5200)

  const say = (text) => {
    if (!aloud) return
    try {
      const synth = window.speechSynthesis
      if (synth === null || synth === undefined) return
      synth.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 0.9
      utterance.volume = 0.8
      synth.speak(utterance)
    } catch (error) { void error }
  }

  const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const addTurn = (question) => {
    const turn = document.createElement('div')
    turn.className = 'turn'
    turn.innerHTML = '<p class="q">' + escapeHtml(question) + '</p>'
      + '<p class="a"><span class="spin"></span>thinking…</p>'
    thread.prepend(turn)
    return turn
  }

  const fill = (turn, answer, source) => {
    const body = turn.querySelector('.a')
    body.textContent = answer
    if (source !== null) {
      const line = document.createElement('p')
      line.className = 'src'
      line.innerHTML = 'source: <a href="' + escapeHtml(source.url) + '" target="_blank" rel="noreferrer">'
        + escapeHtml(source.title) + '</a>'
      turn.append(line)
    }
    say(answer)
    try {
      const host = window.MassaiHost
      if (host !== undefined && host !== null && typeof host.speak === 'function') host.speak(answer)
    } catch (error) { void error }
  }

  const fail = (turn, message) => {
    const body = turn.querySelector('.a')
    body.classList.add('fail')
    body.textContent = message
  }

  const ask = async (question) => {
    if (question === '') return
    input.value = ''
    hint.textContent = ''
    const turn = addTurn(question)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch('/api/mind/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: question, style: 'balanced', lookup: true,
          history: conversation.slice(-6).map(turn => ({ role: turn.role, text: turn.text })),
        }),
        signal: controller.signal,
      })
      if (response.status === 401 || response.status === 403) {
        fail(turn, 'that is a question for someone who has signed in — /access')
        return
      }
      const body = await response.json()
      if (body !== null && body.ok === true && typeof body.answer === 'string') {
        fill(turn, body.answer, body.source ?? null)
        conversation.push({ role: 'user', text: question })
        conversation.push({ role: 'assistant', text: body.answer })
        while (conversation.length > 6) conversation.shift()
        return
      }
      fail(turn, body !== null && typeof body.say === 'string' ? body.say : 'the line went quiet. try again.')
    } catch (error) {
      fail(turn, error instanceof Error && error.name === 'AbortError'
        ? 'that took too long. ask me again.'
        : 'the line went quiet. try again.')
    } finally {
      clearTimeout(timer)
    }
  }

  $('askForm').addEventListener('submit', (event) => {
    event.preventDefault()
    void ask(input.value.trim())
  })

  // The assistant path: an installed host can load /ask?assist=1 and hand a heard
  // question straight in, then read the answer itself. On the web this is inert.
  window.massai = {
    ask: (text) => { if (typeof text === 'string' && text.trim() !== '') void ask(text.trim()) },
    focus: () => { input.focus() },
  }
  const params = new URLSearchParams(location.search)
  if (params.get('q') !== null && params.get('q') !== '') void ask(String(params.get('q')))
  if (params.get('assist') === '1') {
    hint.textContent = 'listening…'
    input.focus()
    $('listen').click()
  }
  $('fresh').addEventListener('click', () => {
    conversation.length = 0
    thread.innerHTML = ''
    hint.textContent = 'a fresh page. ask anything.'
    input.value = ''
    input.focus()
  })
  $('aloud').addEventListener('click', () => {
    aloud = !aloud
    $('aloud').setAttribute('aria-pressed', aloud ? 'true' : 'false')
    hint.textContent = aloud ? 'answers will be read aloud' : ''
    if (!aloud) { try { window.speechSynthesis?.cancel() } catch (error) { void error } }
  })
  $('listen').addEventListener('click', () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (typeof Ctor !== 'function') { hint.textContent = 'this browser has no ears. type instead.'; return }
    try {
      const recognition = new Ctor()
      recognition.lang = navigator.language || 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      hint.textContent = 'listening…'
      recognition.onresult = (event) => {
        const heard = event.results?.[0]?.[0]?.transcript ?? ''
        hint.textContent = ''
        if (heard !== '') void ask(heard)
      }
      recognition.onerror = () => { hint.textContent = 'i did not catch that.' }
      recognition.start()
    } catch (error) { hint.textContent = 'this browser will not let me listen.'; void error }
  })
})()
</script>
</body></html>`
}
