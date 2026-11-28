/**
 * The assistant surface: the mind, full screen, with a box.
 *
 * This is what a held button opens. There is no app chrome — the mind is the interface — and
 * an answer is not printed into a card but given to the mind to say, so the breathing sphere
 * delivers the sentence with its own rings and voice.
 *
 * @module @deepseek-ai/dsh-hosted-signin/assist-page
 */

/** Questions worth showing as the rotating placeholder. */
const PROMPTS: readonly string[] = [
  'what do I need for tonight?',
  'how long does cooked rice keep?',
  'what is the fastest way to chill a drink?',
  'why is my sourdough flat?',
  'what should I ask the mechanic?',
]

/**
 * The assist page.
 * @param signedIn - whether this browser may spend the mind's answers.
 * @returns a complete HTML document.
 */
export function assistPageHtml(signedIn: boolean): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Massai</title>
<link rel="icon" type="image/svg+xml" href="/massai-crest.svg">
<link rel="search" type="application/opensearchdescription+xml" title="Massai" href="/opensearch.xml">
<meta name="theme-color" content="#0b0a09">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;overflow:hidden;background:#0b0a09;color:#EDE7DA;
    font:16px/1.6 ui-sans-serif,system-ui,-apple-system,sans-serif}
  #mind{position:fixed;inset:0;width:100%;height:100%;border:0;z-index:0}
  .stage{position:fixed;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;
    padding:0 1rem calc(1.1rem + env(safe-area-inset-bottom));pointer-events:none}
  .stage > *{pointer-events:auto}
  .answer{margin:0 0 .9rem;max-width:34rem;align-self:center;text-align:center;
    font:italic 400 clamp(15px,2.2vw,20px)/1.55 Georgia,'Times New Roman',serif;color:#f7ead2;
    text-shadow:0 0 24px rgba(255,198,120,.28);opacity:0;transition:opacity .5s ease}
  .answer.show{opacity:1}
  .source{align-self:center;margin:0 0 .8rem;font-size:.72rem;color:rgba(247,234,210,.42);opacity:0;transition:opacity .5s ease}
  .source.show{opacity:1}
  .source a{color:rgba(201,179,137,.8)}
  form{width:min(30rem,92vw);margin:0 auto;display:flex;gap:.45rem}
  input{flex:1;min-width:0;background:rgba(12,11,10,.62);border:1px solid rgba(247,205,140,.2);
    border-radius:999px;color:#f6ead6;padding:.8rem 1rem;font:inherit;font-size:.98rem;outline:none;
    backdrop-filter:blur(8px);text-align:center;transition:border-color .2s ease,background .2s ease,text-align .2s ease}
  input:focus{text-align:left;background:rgba(12,11,10,.92);border-color:rgba(247,205,140,.5)}
  input::placeholder{color:rgba(247,234,210,.34)}
  button{border-radius:999px;border:1px solid rgba(247,205,140,.24);background:rgba(12,11,10,.68);
    color:#f6ead6;padding:.7rem .9rem;font:inherit;cursor:pointer;backdrop-filter:blur(8px)}
  button.primary{background:linear-gradient(180deg,#c1440e,#96330a);border-color:#c1440e;color:#fff;font-weight:600}
  .row{display:flex;gap:.45rem;justify-content:center;margin-top:.55rem}
  .hint{min-height:1.1em;margin:.5rem 0 0;text-align:center;font-size:.74rem;color:rgba(247,234,210,.4)}
  body.sleep .stage{opacity:0;transition:opacity .6s ease}
</style></head><body>
<iframe id="mind" src="/mind?embed=1&quiet=1&speak=1&voice=0" title="The Massai mind" allow="autoplay"></iframe>
<div class="stage">
  <p class="answer" id="answer" aria-live="polite"></p>
  <p class="source" id="source"></p>
  ${signedIn ? '' : '<p class="hint" id="guest">eight questions a day as a guest · <a href="/access" style="color:rgba(201,179,137,.85)">sign in</a> for more</p>'}
  <form id="form">
    <input id="q" type="text" autocomplete="off" placeholder="${PROMPTS[0]}">
    <button class="primary" type="submit">Ask</button>
  </form>
  <div class="row">
    <button id="speak" type="button">Speak</button>
    <button id="again" type="button">Again</button>
  </div>
  <p class="hint" id="hint"></p>
</div>
<script>
(() => {
  const PROMPTS = ${JSON.stringify(PROMPTS)}
  const signedIn = ${signedIn ? 'true' : 'false'}
  const $ = (id) => document.getElementById(id)
  const input = $('q')
  const mind = $('mind')
  let last = ''
  let promptIndex = 0

  setInterval(() => {
    if (input.value.trim() !== '') return
    promptIndex = (promptIndex + 1) % PROMPTS.length
    input.placeholder = PROMPTS[promptIndex]
  }, 5200)

  /** Hand a sentence to the mind: it types it, rings, and speaks it if told to. */
  const mindSays = (text) => {
    try { mind.contentWindow?.postMessage({ type: 'massai:say', text }, '*') } catch (error) { void error }
  }

  const show = (text, source) => {
    const answer = $('answer')
    answer.textContent = text
    answer.classList.add('show')
    const line = $('source')
    if (source) {
      line.innerHTML = 'source: <a href="' + source.url + '" target="_blank" rel="noreferrer">' + source.title + '</a>'
      line.classList.add('show')
    } else {
      line.textContent = ''
      line.classList.remove('show')
    }
    mindSays(text)
    try {
      const host = window.MassaiHost
      if (host !== undefined && host !== null && typeof host.speak === 'function') host.speak(text)
    } catch (error) { void error }
  }

  const ask = async (question) => {
    if (question === '') return
    last = question
    input.value = ''
    $('hint').textContent = 'thinking…'
    try {
      const response = await fetch('/api/mind/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: question, style: 'balanced', lookup: true, history: [] }),
      })
      const body = await response.json()
      if (body !== null && body.ok === true && typeof body.answer === 'string') {
        show(body.answer, body.source ?? null)
        $('hint').textContent = ''
        return
      }
      const said = body !== null && typeof body.say === 'string' ? body.say : 'the line went quiet.'
      $('hint').textContent = said
      mindSays(said)
    } catch (error) {
      $('hint').textContent = 'the line went quiet. try again.'
      void error
    }
  }

  $('form').addEventListener('submit', (event) => { event.preventDefault(); void ask(input.value.trim()) })
  $('again').addEventListener('click', () => { if (last !== '') void ask(last) })
  $('speak').addEventListener('click', () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (typeof Ctor !== 'function') { $('hint').textContent = 'this browser has no ears. type instead.'; return }
    try {
      const recognition = new Ctor()
      recognition.lang = navigator.language || 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      $('hint').textContent = 'listening…'
      recognition.onresult = (event) => {
        const heard = event.results?.[0]?.[0]?.transcript ?? ''
        $('hint').textContent = ''
        if (heard !== '') void ask(heard)
      }
      recognition.onerror = () => { $('hint').textContent = 'i did not catch that.' }
      recognition.start()
    } catch (error) { $('hint').textContent = 'this browser will not let me listen.'; void error }
  })

  // An installed host can hand a heard question in straight away.
  window.massai = { ask: (text) => { if (typeof text === 'string') void ask(text.trim()) } }
  const params = new URLSearchParams(location.search)
  if (params.get('q')) void ask(String(params.get('q')))
  if (params.get('speak') === '1') $('speak').click()
})()
</script>
</body></html>`
}
