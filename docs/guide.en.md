# DevTools guide

This guide is the companion to the Debug Frontend challenges. It gives no solutions: it reminds you **where to look,
in what order, and with which move**. It is the natural path of a front-end diagnosis,
the one expected from an engineer in an interview as much as on call.

## 0. Triage before you search

The first minute decides everything. Three questions, in this order:

1. **Does the click reach the button?** (Elements)
2. **Does the code run all the way through?** (Sources / Console)
3. **Is the request that goes out the one you expect?** (Network)

| Symptom | Where to go first |
|---|---|
| Nothing happens, Console empty, Network empty | **Elements**: who receives the click? |
| The button reacts visually but nothing goes out | **Sources**: the handler stops midway |
| The page log announces a success the server never saw | **Network** + **Console**: something is answering in place of the server |
| The page flashes, the URL changes | **Network** with *Preserve log* |
| A request goes out but fails | **Network**: Method, Status, Headers, Payload, Response |
| Red error in the Console | **Console**: read the stack, click the source link |
| A token is there but gets rejected | **Application**: local storage, cookies |

## 1. Elements

- [ ] **Right-click the element → Inspect**: DevTools selects what is *actually*
      under the cursor. If it is not the button, you already hold the cause.
- [ ] Read the tag **in full**: `disabled`, `readonly`, `inert`, `hidden`, `aria-*`,
      `data-*`, not just `class`.
- [ ] **Computed** panel + filter: `pointer-events`, `display`, `visibility`, `opacity`,
      `z-index`, `position`. The arrow next to the value leads back to the rule and to the element
      that imposes it.
- [ ] **Walk up the tree**: several controls dead at once = an ancestor is to blame.
- [ ] Expand the **pseudo-elements** `::before` / `::after` and hover them to see the area
      they really occupy. They are clickable and absent from the HTML source.
- [ ] **Event Listeners** panel, with and without *Ancestors*. Empty = the problem is upstream
      of the handler (never attached, or removed); on an ancestor = delegation. The options
      (`once`, `passive`, `capture`) are visible there.
- [ ] Edit / delete a node, force a state (`:hover`, `:focus`), add a CSS rule
      on the fly, drag a node elsewhere in the tree.

## 2. Console

- [ ] **Read the error to the end**: `Cannot read properties of null (reading 'value')` tells you
      *which* object is null. Clicking the `file:line` link opens Sources at the right spot.
- [ ] Check the **log level**: *Verbose* is hidden by default, *Preserve log*, active
      filters. An "empty" Console is sometimes empty because of a filter.
- [ ] `document.elementFromPoint(x, y)`: who captures the click at that spot.
- [ ] `getComputedStyle(el).pointerEvents`: the effective value, not the one in the CSS file.
- [ ] `getEventListeners(el)` (Chrome): the handlers, their options and their exact reference.
- [ ] `monitorEvents(el, 'click')` (Chrome): see whether the event arrives at all, plain and simple.
- [ ] `$0` = the element selected in Elements, `$$('sel')` = `querySelectorAll`.
- [ ] Type `fetch`: a native function displays `ƒ fetch() { [native code] }`. If you see
      code, someone replaced it.
- [ ] Replay a request with `fetch`: the move that unblocks everything, unless `fetch` itself
      is compromised in the page (then `XMLHttpRequest`, another tab, or `curl`).
- [ ] Monkey-patch to test a hypothesis:
      `Event.prototype.stopPropagation = function(){}`, or wrap `window.fetch`.

## 3. Network

- [ ] **Preserve log** checked by default. Without it, a navigation wipes the evidence.
- [ ] Did the request even **go out**? That is the question that separates the families
      of bugs.
- [ ] **Method** and **Status** columns (right-click the header to show them). A
      `(canceled)`, `CORS error` or `(blocked)` status is information, not noise.
- [ ] **Headers → Request Headers**, in **Raw** view: a header present here but absent from the
      code was added by the browser (`Content-Type`, `Content-Length`, `Origin`,
      `Sec-Fetch-*`).
- [ ] **Payload → view source**: the bytes actually transmitted, not the prettified view.
- [ ] **Response**: the server often explains exactly what is wrong.
- [ ] **Copy → Copy as fetch**: start from the real request and change only one thing at a
      time. The most profitable move in an interview.
- [ ] Look at **all** the requests of the page, not only the one that fails:
      a response received at load time often contains what the next one is missing.
- [ ] An `OPTIONS` you did not write = **CORS preflight**. Compare the two origins
      (scheme + host + port) quoted in the Console message.
- [ ] **Block request URL** (right-click a resource): stop a third-party script from
      loading on the next reload to test a hypothesis.
- [ ] **Initiator** column: which script triggered the request.

## 4. Sources

- [ ] **Pretty print `{}`** first of all on minified code. Without it, everything is on line 1.
- [ ] **Pause on uncaught exceptions** AND **Pause on caught exceptions**: the second reveals
      everything an empty `try/catch` hides. Almost nobody checks it.
- [ ] **Event Listener Breakpoints** → *Mouse → click*, *Control → submit*, *Timer →
      setTimeout*: stop on the event without knowing where the code is. A synthetic
      event (`dispatchEvent`) also triggers the pause: look at `event.isTrusted`.
- [ ] Step by step: `F9` (step), `F10` (over), `F11` (into), `F8` (resume). Follow the flow
      up to the point where it deviates.
- [ ] While paused, the **Console evaluates in the current scope**: read and **modify**
      closure variables that are otherwise unreachable, reattach a listener, restore a
      native function.
- [ ] **Conditional breakpoints** and **Logpoints**: instrument without modifying the file.
      Tip: a condition `(x = valeurCorrigee) && false` (x = correctedValue) fixes on the fly without ever
      stopping.
- [ ] **Call Stack**: where the call comes from, who triggered what. Asynchronous frames
      (`setTimeout`, promises) appear under *Async*.
- [ ] **XHR/fetch Breakpoints**: stop when a URL containing a pattern is requested.
- [ ] **Overrides** (Local overrides): serve a corrected version of a file on the next
      reload, without touching the server.

## 5. Application

- [ ] `localStorage`, `sessionStorage`, cookies, IndexedDB: a token or a state flag often
      hides there. Compare its issue date and its value with the source of truth.
- [ ] Delete or edit an entry, then watch whether the code regenerates it on load.
- [ ] Service workers: a SW can intercept and respond in place of the network.

## 6. The server log, your mirror

Every challenge page has a **"Journal du serveur"** (server log) panel: for each request received on its
endpoint, the verb, the port, the relevant headers, the raw body in bytes and the verdict. (When
running locally, the terminal where `npm start` runs displays the same thing.) It is the only source that tells you
**what actually arrived**:

- Nothing in the log = the request did not go out, or not to this server.
- An unexpected verb (`GET`, `OPTIONS`) = the code or the browser chose for you.
- `content-type : (absent)` or `text/plain` = the browser filled it in.
- `body brut : "[object Object]" [15 octets]` (raw body, 15 bytes) = missing serialization.

## 7. The three families of Debug Frontend bugs

| Family | Question | Tools |
|---|---|---|
| The click does not reach the button | Who really receives the event? | Elements, Computed, Event Listeners |
| The click arrives, the code goes off the rails | Where does execution stop? | Sources, breakpoints, Console |
| The request goes out, but it is not right | What is actually transmitted? | Network, Application, server log |

What matters is not succeeding, it is knowing **why** it was broken. After each
challenge, the debrief and the quiz are there for that.

## 8. Around the challenges

- This guide and the leaderboard can be read without an account; the challenges themselves
  require you to be signed in: the session cookie is what lets the server credit your requests,
  including the ones replayed from the Console.
- The **Profile** page gathers the rules, the scoring (hints, opened solution, quiz), the belts,
  the interface language, the export of your results and the reset.
- A card's **reset** button resets the challenge for your account only, and purges whatever the
  challenge may have left in the browser (local storage).
- Solutions only open after solving, or explicitly through "I give up" (the challenge is then
  worth half the points).
