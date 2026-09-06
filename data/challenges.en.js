'use strict';

/* English texts for the challenge catalogue. Structure and choice order mirror data/challenges.js. */
module.exports = {
  FAMILIES: {
    dom: {
      name: 'The click never reaches the button',
      short: 'DOM & CSS',
      description: "The code is correct and the handler is properly attached, but the event never gets to it: another element catches it first, an attribute blocks it, a CSS property neutralizes it. Console empty, Network empty. The first question is always: who actually receives the click?",
      method: 'Right-click → Inspect directly on the button, Computed panel, Event Listeners panel, walk up the ancestors.'
    },
    js: {
      name: 'The click arrives, the code goes off the rails',
      short: 'JavaScript',
      description: 'The event does reach the button, and sometimes the page even reacts visually, but execution stops before the request: a swallowed exception, a listener that was never attached, propagation cut short, a whimsical timer. You have to follow the execution flow step by step.',
      method: 'Sources: Pretty print, breakpoints, Pause on caught exceptions, Event Listener Breakpoints, Call Stack, editing a variable while paused.'
    },
    net: {
      name: "The request goes out, but it's not the right one",
      short: 'Network',
      description: 'The browser does send something, but not what the server expects: wrong verb, wrong header, badly serialized body, missing or stale token, different origin, a navigation that kills the request. The server almost always explains what is wrong: read its response and compare byte for byte.',
      method: 'Network: Preserve log, Method and Status columns, Headers in raw view, Payload → view source, Response, Copy as fetch.'
    }
  },
  CHALLENGES: {
    '01': {
      title: 'Release promotion',
      subtitle: 'Deployment console: promote the release candidate to production.',
      intro: 'The most common bug in modern interfaces is not in the JavaScript: it is an invisible element lingering on top of the page. Transition screens, modals closed with opacity, toasts, loading overlays: when they are animated away instead of being removed, they keep receiving clicks. This challenge teaches you the first reflex of any front-end diagnosis: before reading a single line of code, check who actually receives the click.',
      symptom: 'The button does not react at all. No error in the Console, no request in Network, nothing in the page log.',
      learn: [
        'Use "Inspect" on the element actually under the cursor and read what DevTools selects',
        'Verify a hypothesis with document.elementFromPoint(x, y)',
        'Tell opacity: 0 / visibility: hidden (which let clicks through or not) apart from display: none and pointer-events: none',
        'Neutralize a node live from the Elements tab'
      ],
      hints: [
        'Elements tab. The rendered document contains more nodes than your eye perceives.',
        'Right-click → Inspect directly ON the button. Compare the node DevTools selects with the one you were aiming at.',
        'One element covers the whole viewport, above everything else, and catches the clicks instead of the button.'
      ],
      debrief: {
        cause: 'A <div id="view-transition"> in position: fixed covers the whole viewport with a high z-index. The script sets it to opacity: 0 on first render: it becomes invisible, but it stays in the tree and keeps receiving every click. The button\'s handler is correct, it is simply never called.',
        reflex: 'Silent button + empty Console + empty Network: start with "Inspect" on the button, not with the JS. opacity: 0 never disables events; display: none and pointer-events: none do.'
      },
      quiz: {
        question: 'Why did the click never reach the button?',
        choices: [
          'The click handler was not attached to the right element',
          'An invisible but still present element (opacity: 0) covered the page and intercepted the clicks',
          'The button had the disabled attribute',
          'A JavaScript error interrupted the handler before the fetch'
        ],
        why: "opacity: 0 makes an element transparent, not inert: it still takes part in hit-testing. Only display: none, visibility: hidden (for clicks) or pointer-events: none take it out of the pointer's path."
      }
    },
    '02': {
      title: 'Valve opening',
      subtitle: 'Industrial supervision: open valve V-204 on the primary circuit.',
      intro: 'Many interfaces manage a button\'s "ready / not ready" state in two places at once: a CSS class for the look, an HTML attribute for the behavior. When the two drift apart, the button looks active but stays inert. This challenge trains a simple, high-yield reflex: read the whole tag in the Elements tab, attributes included, instead of trusting what you see.',
      symptom: 'The button looks active (color, shadow, cursor) once the interlocks are released, but clicking it does nothing: no error, no request.',
      learn: [
        "Read all of an element's attributes (disabled, readonly, inert, hidden, aria-*) and not just its classes",
        'Understand that a disabled button receives no mouse event at all, whatever its styling',
        'Tell aria-disabled (semantics) apart from disabled (behavior)',
        'Change an attribute on the fly in Elements or with removeAttribute'
      ],
      hints: [
        "Elements tab, the button's attributes panel.",
        "Read the <button>'s ATTRIBUTES, not just its CSS classes. Appearance and actual state can diverge.",
        'The button is inert at the HTML level itself: no mouse event will ever be delivered to it.'
      ],
      debrief: {
        cause: 'The <button> ships with the disabled attribute in the HTML. The script updates aria-disabled and an .is-ready class when the interlocks are released, but never removes disabled. A disabled button receives no click event: the handler is never invoked.',
        reflex: 'A button that "looks" active is not necessarily active. The only judge is the tag itself: disabled, inert or an inert ancestor block events no matter what the CSS says.'
      },
      quiz: {
        question: 'Which statement is true about a <button disabled>?',
        choices: [
          'It receives clicks but cannot submit a form',
          'It receives no mouse event, even when styled as active',
          'It receives clicks only if aria-disabled is "false"',
          'The browser removes it from the DOM'
        ],
        why: 'disabled is a behavioral attribute: the browser does not deliver pointer events to the element. aria-disabled only affects assistive technologies, and CSS is purely cosmetic.'
      }
    },
    '03': {
      title: 'API key rotation',
      subtitle: 'Security console: trigger the rotation of the service key.',
      intro: 'CSS inherits, and sometimes that is a problem: a property set on an ancestor to handle a transient state (loading, syncing) can freeze a whole subtree long after the state has changed, if the code updates the wrong node. This challenge teaches you to read computed values rather than stylesheets, and to walk up the DOM tree when several controls die at the same time.',
      symptom: 'The button and the neighboring checkbox are both unresponsive, even once the inventory is reported as "à jour" (up to date). The cursor does not change on hover. Console and Network stay empty.',
      learn: [
        'Use the Computed panel and its arrow to trace back to the rule and the element that impose a value',
        'Understand that pointer-events is inherited and blocks every interaction on the subtree',
        'Walk up the DOM tree when several controls have died at once',
        'Check an effective value with getComputedStyle(el).pointerEvents'
      ],
      hints: [
        'Elements tab → Computed sub-panel, with the button selected.',
        'Walk up the DOM tree: an ancestor of the button carries a state that was never cleared.',
        'An inherited CSS property neutralizes every mouse interaction on that subtree.'
      ],
      debrief: {
        cause: "The .rotation-footer container carries data-state=\"syncing\", and a CSS rule applies pointer-events: none to it in that state. When the sync ends, the script updates the data-state of the header badge, not the card footer's: the container stays \"syncing\" and everything inside it remains insensitive to the pointer.",
        reflex: 'Several controls dead together = look for the common ancestor. The Computed panel filtered on pointer-events gives you the rule and the responsible node in one click.'
      },
      quiz: {
        question: 'Why was the "prévenir les propriétaires" (notify the owners) checkbox inert as well?',
        choices: [
          'It had its own disabled attribute',
          'pointer-events: none set on their common ancestor is inherited by the whole subtree',
          'The script removed its listeners during the sync',
          'An overlay covered only that area'
        ],
        why: 'pointer-events is an inherited property: applied to a container, it holds for every descendant as long as none of them redefines it. That is why a single forgotten state freezes a whole area.'
      }
    },
    '04': {
      title: 'Publishing an article',
      subtitle: 'Editorial CMS: take the draft live.',
      intro: 'The ::before and ::after pseudo-elements are used everywhere for decoration: glows, gradients, separators. They are absent from the HTML source but very much present in the rendering, with a geometry of their own, and they can overflow their parent and end up on top of whatever follows. This challenge teaches you to see them in the Elements tree and to hover nodes to discover the area they really occupy.',
      symptom: 'The button does not respond, but only in its upper part or over its whole surface depending on the window size. Nothing in the Console or in Network.',
      learn: [
        'Expand and hover the ::before / ::after pseudo-elements in the Elements tab',
        'Understand that a positioned pseudo-element can overflow its parent and catch clicks',
        'Read the stacking order: z-index, position, order in the flow',
        'Fix a CSS rule live in the Styles panel'
      ],
      hints: [
        'Elements tab. Hover the nodes one by one and watch the highlighted area in the page.',
        'The visual block just ABOVE the action bar overflows. Expand its generated nodes.',
        'A decorative pseudo-element is painted over the button and intercepts the pointer.'
      ],
      debrief: {
        cause: 'The .editor-metrics card has a decorative ::after in position: absolute, 250 px tall, starting at top: 100%: it overflows below the card and covers the actions card that follows. Since .editor-metrics has a higher z-index, the (almost transparent) gradient sits above the button and receives its clicks.',
        reflex: 'When the dead zone has an odd geometric shape, think "pseudo-element". They do not appear in the HTML source, only in the rendered tree: hover them to see their real footprint.'
      },
      quiz: {
        question: 'How do you spot a pseudo-element covering a button?',
        choices: [
          "By searching for ::after in the page's HTML source",
          'By expanding the parent node in the Elements tab and hovering ::before / ::after to see their area',
          'By reading the Console: the browser reports overlaps',
          'By disabling JavaScript'
        ],
        why: 'Pseudo-elements are generated by CSS and do not exist in the HTML. The Elements tab lists them under their parent, and hovering draws their real box in the page.'
      }
    },
    '05': {
      title: 'Sending a batch of notifications',
      subtitle: 'Delivery platform: send out the prepared campaign.',
      intro: 'Script load order is a classic source of silent bugs: a script that runs too early looks for elements that do not exist yet, and if the subscription function tolerates their absence without a word, no listener is ever attached. This challenge has you observe the difference between a script in the <head>, a defer script, and the moment the DOM is actually available.',
      symptom: "The button can be clicked (cursor, focus) but nothing happens. The button's Event Listeners panel is empty.",
      learn: [
        'Read the Event Listeners panel to know whether a handler is really attached',
        'Understand script execution order: <head> without defer, defer, DOMContentLoaded',
        'Spot a function that fails silently (returns false instead of throwing)',
        'Replay the subscription from the Console once the DOM is ready'
      ],
      hints: [
        'Elements tab → Event Listeners panel, with the button selected. Then the Sources tab.',
        "Compare the scripts' execution order with the button's position in the document.",
        'At the moment the click subscription is attempted, the target does not exist yet, and the failure is swallowed silently.'
      ],
      debrief: {
        cause: 'The 05-bindings.js file is loaded in the <head> without defer: it runs before the <button id="dispatch-batch"> has been parsed. Its on(selector, ...) helper does a querySelector, finds nothing and returns false without an error. No listener is attached; the main script (defer) only handles the display.',
        reflex: 'Empty Event Listeners on an element that should have some = the subscription never happened. Then look at WHEN the script runs relative to the DOM, and beware of helpers that tolerate a missing element.'
      },
      quiz: {
        question: 'Why was the click listener never attached?',
        choices: [
          'The subscription script ran in the <head> before the button existed, and the failure was silent',
          'addEventListener was called with the wrong event type',
          'The button was replaced by a clone after the subscription',
          'The script was loaded twice and the second load removed the listener'
        ],
        why: 'A script in the <head> with neither defer nor module runs immediately, before the <body> is parsed. querySelector returns null, and the helper returns false without throwing: nothing shows up in the Console.'
      }
    },
    '06': {
      title: 'Room booking',
      subtitle: 'Intranet: confirm the booking of the selected slot.',
      intro: 'A <button> inside a <form> is of type submit by default. If the click handler starts an asynchronous task without preventing the submission, the browser navigates, the document is destroyed and the in-flight request dies with it. It is a very common bug, and it is invisible if the Network tab is cleared on every navigation. This challenge teaches you to enable Preserve log and to read the address bar as a clue.',
      symptom: 'The page "flashes" on click, the URL fills up with parameters, the log is cleared. No solve request shows up, or it shows up for an instant and disappears.',
      learn: [
        'Enable Preserve log in Network to survive a navigation',
        'Recognize an implicit form submission (GET with a query string in the URL)',
        'Understand the default type="submit" and event.preventDefault()',
        'Tell "the request never went out" apart from "the request was cancelled by a navigation"'
      ],
      hints: [
        'Network tab, tick "Preserve log" before clicking.',
        'Look at the address bar and at the very first Network entry right after the click.',
        'The click triggers a navigation that destroys the context before the request goes out.'
      ],
      debrief: {
        cause: 'The button is inside a <form> and has no type="button": it is a submit. The click handler waits 120 ms (context collection) before calling fetch, but the form submission has already triggered a GET navigation to the same page. The document is unloaded and the promise never settles.',
        reflex: 'Flashing page + changing URL = navigation. Tick Preserve log BEFORE clicking, otherwise the evidence vanishes. A button inside a form must be type="button", or the handler must call preventDefault().'
      },
      quiz: {
        question: 'Why did the fetch request never complete?',
        choices: [
          'The server rejected the request because of a missing header',
          'The form was submitting (GET navigation) and unloading the page before the fetch went out',
          'fetch was never called because of an exception',
          'The request went out twice and the second one cancelled the first'
        ],
        why: 'A <button> inside a <form> submits by default. The resulting navigation destroys the document and all its in-flight requests. Preserve log lets you see the navigation request and then, possibly, the cancelled request.'
      }
    },
    '07': {
      title: 'Shipping an order',
      subtitle: 'Logistics WMS: release the order to the carrier.',
      intro: "Event delegation (a single listener on document that routes clicks according to a data-* attribute) is a very widespread pattern. It relies on propagation: if an intermediate ancestor calls stopPropagation() for its own needs (closing a popover, for instance), everything delegated higher up stops working. This challenge teaches you to read the ancestors' listeners, not just the target's, and to look for who cuts the bubbling.",
      symptom: 'The button does nothing, but neither do order selection in the table or the "?" tooltip. The <select> elements and the <input> work. Console and Network empty.',
      learn: [
        'Read the Event Listeners panel with the Ancestors box ticked to see the full chain',
        'Understand bubbling, delegation and the effect of stopPropagation()',
        'Notice that several delegated behaviors die together',
        'Neutralize a listener on the fly (getEventListeners, monkey-patch) to test a hypothesis'
      ],
      hints: [
        'Elements tab → Event Listeners, on the button THEN on each of its ancestors.',
        'The useful handler is not on the button: it listens much higher up. Something sits between the two.',
        "An ancestor interrupts the event's bubbling before it reaches the listener that matters."
      ],
      debrief: {
        cause: 'Everything is delegated to a listener attached to document that reads data-cmd. But the #order-panel card, an ancestor of the button, has its own click listener that calls e.stopPropagation() to handle closing popovers. The event is born on the button, bubbles up to the card and dies there: document never sees it.',
        reflex: 'When everything delegated in an area dies while native controls respond, look for a stopPropagation() on an ancestor. Event Listeners + Ancestors shows the whole chain.'
      },
      quiz: {
        question: "Which mechanism did the card's stopPropagation() break?",
        choices: [
          'The capture phase, preventing the button from receiving the event',
          'Event delegation: the listener on document no longer received the bubbling click',
          "The button's default behavior (submission)",
          'The execution of the fetch, interrupted by an exception'
        ],
        why: 'stopPropagation() stops bubbling toward the ancestors. A delegated listener on document depends precisely on that bubbling: it no longer receives anything that happens under the card.'
      }
    },
    '08': {
      title: 'Closing a ticket',
      subtitle: 'L2 support: close the incident and notify the customer.',
      intro: 'An empty try/catch is one of the worst things you can find in production code: it turns a clear error into total silence. The button reacts, the label flickers, and nothing goes out. This challenge teaches you the most underused option in DevTools, Pause on caught exceptions, as well as stepping through minified code after Pretty print.',
      symptom: 'The button briefly switches to "envoi..." (sending...) then returns to normal. No request, no visible error. The page log does not even mention an attempt.',
      learn: [
        'Enable Pause on uncaught AND Pause on caught exceptions',
        'Pretty-print a minified file before setting breakpoints',
        'Use Event Listener Breakpoints (Mouse → click) to stop without knowing the code',
        'Fix a value inside a closure from the Console while paused, or through a conditional breakpoint'
      ],
      hints: [
        'Sources tab → tick "Pause on caught exceptions" in addition to "uncaught".',
        'Event Listener Breakpoints → Mouse → click, then step through the handler.',
        'An error is thrown before the send and intercepted by a block that does nothing with it: the flow stops without leaving a trace.'
      ],
      debrief: {
        cause: 'The handler builds the payload inside a try whose catch is empty. payload() reads ss.profile.handle, but ss.profile is only defined when the session has the "supervisor" role, which is not the case: TypeError, swallowed by the catch. tx(), which contains a correct fetch, is never reached. busy(true) then busy(false) make it look like something is happening.',
        reflex: 'A handler that reacts visually but sends nothing stops halfway. Pause on caught exceptions reveals everything a catch {} hides. On minified code, Pretty print first.'
      },
      quiz: {
        question: 'Why did the Console stay empty despite the exception?',
        choices: [
          'Exceptions in event handlers are never displayed',
          'The exception was intercepted by an empty catch: nothing was logged or rethrown',
          'The Console\'s log level was set to "Errors" only',
          'The exception happened in a Web Worker'
        ],
        why: "A caught exception never reaches the Console: it is up to the catch code to report it. An empty catch makes it disappear. Only the debugger's Pause on caught exceptions option lets you see it."
      }
    },
    '09': {
      title: 'Firmware update',
      subtitle: 'IoT fleet: push the firmware to the pilot group.',
      intro: 'Small abstraction layers around fetch (api.request, http.post...) have defaults, and those defaults always end up biting: here, an implicit HTTP method. This challenge teaches you never to assume what the code sends, to read the Method column and the General section of the actual request in Network, then to go back into the wrapper to understand where the default comes from.',
      symptom: 'A request goes out, the server answers 405 with a precise message. The page log shows the error response.',
      learn: [
        'Show and read the Method column in Network',
        "Read a request's General / Request Method section",
        'Trace a network symptom back to the line of code in an HTTP wrapper',
        'Fix the call on the fly with a breakpoint, or replay it with Copy as fetch'
      ],
      hints: [
        'Network tab, Method column of the row that appears on click.',
        'Open the request → Headers → "Request Method", and compare with the "Objectif" (Goal) box.',
        'The request goes out with an HTTP verb the endpoint refuses.'
      ],
      debrief: {
        cause: "api.request(url, opts) uses GET by default and the push() call does not pass method: 'POST'. Since the method is GET, the wrapper attaches neither Content-Type nor body. The server receives GET /api/challenge/09/solve and answers 405.",
        reflex: 'Always look at the Method column. HTTP wrappers have implicit defaults; the actual request in Network is the only truth.'
      },
      quiz: {
        question: 'What did the Method column of the sent request reveal?',
        choices: [
          'POST, but to the wrong URL',
          'GET, because the HTTP wrapper used GET by default and the call did not specify the method',
          'OPTIONS, because of a CORS preflight request',
          'PUT, because of a mix-up between creation and update'
        ],
        why: "The wrapper read opts.method || 'GET'. The call did not provide method, so the request went out as GET with no body, which the endpoint refuses with 405."
      }
    },
    '10': {
      title: 'Internal transfer',
      subtitle: 'Banking back office: execute the transfer between two internal accounts.',
      intro: 'The browser completes your requests: if Content-Type is missing and the body is a string, it adds text/plain;charset=UTF-8 on its own. The JSON is perfect, the verb is right, and yet the server refuses. This challenge teaches you to read the headers actually sent (raw view), to tell those the code provided apart from those the browser added, and not to confuse "the body is JSON" with "the body is declared as JSON".',
      symptom: 'The request goes out as POST with a correct JSON body, but the server answers 415.',
      learn: [
        'Read Request Headers in raw view and spot the headers added by the browser',
        "Understand the role of Content-Type and fetch's text/plain default with a string body",
        'Find the shared headers object and its gap in minified code',
        'Replay with Copy as fetch, changing only one thing'
      ],
      hints: [
        'Network tab → the request → Headers → "Request Headers" section.',
        'The browser fills in some headers itself when the code does not provide them. Find which one it chose for you.',
        'The body sent is correct, but the header describing its type is not.'
      ],
      debrief: {
        cause: 'The shared headers object E.hdr contains Accept, X-Client and X-Request-Id, but no Content-Type. fetch receives a string as body and applies its default: text/plain;charset=UTF-8. The server, which only accepts application/json, answers 415 and quotes the type it received.',
        reflex: '"The body is JSON" is not enough: it has to be declared. Compare the Request Headers with the code; any header present in Network but absent from the code was added by the browser.'
      },
      quiz: {
        question: 'What does fetch do when given a string as body with no Content-Type header?',
        choices: [
          'It refuses to send the request and throws an error',
          'It guesses application/json if the string starts with "{"',
          'It sends Content-Type: text/plain;charset=UTF-8 by default',
          'It sends no Content-Type at all'
        ],
        why: 'The Fetch specification assigns text/plain;charset=UTF-8 to a string body when no Content-Type is provided. The server therefore sees text, not JSON.'
      }
    },
    '11': {
      title: 'Importing a CSV file',
      subtitle: 'Data tool: start the import of the contacts batch.',
      intro: 'Forgetting JSON.stringify is a one-line mistake with baffling consequences: fetch converts the object to a string with toString(), and the server literally receives "[object Object]". This challenge teaches you to look at the bytes actually transmitted (Payload → view source) rather than the prettified view, and to compare what the code manipulates with what goes over the wire.',
      symptom: 'The request goes out as POST with the right Content-Type, but the server answers 400: the body cannot be read as JSON.',
      learn: [
        'Read Payload → view source to see the raw bytes',
        'Understand the implicit serialization of an object passed as body (toString)',
        'Set a breakpoint right before fetch to inspect the actual argument',
        'Use the server log (size in bytes, start of the body) as a mirror'
      ],
      hints: [
        'Network tab → the request → Payload (or Request) tab.',
        'Compare byte for byte what is actually transmitted with the object manipulated in the code (Sources, pretty print, breakpoint).',
        'What goes over the network is the default text representation of a JavaScript object, not JSON.'
      ],
      debrief: {
        cause: 'tx() passes the object built by bld() directly as body instead of JSON.stringify(p). fetch converts it to a string via toString(): "[object Object]", 15 bytes. The Content-Type announces JSON, the server tries JSON.parse and fails.',
        reflex: 'Payload → view source shows the real bytes. A 15-byte body for an object that should weigh hundreds is an immediate signal. The server log shows the same thing.'
      },
      quiz: {
        question: 'Why did the server receive "[object Object]"?',
        choices: [
          'The Content-Type was text/plain, so the browser converted the JSON',
          'The object was passed as-is to body; fetch converted it to a string with toString()',
          'The server did not support nested objects',
          'The CSV contained an invalid character'
        ],
        why: 'body accepts strings, FormData, Blob, etc. A plain object is not on the list: it gets converted to a string, which yields "[object Object]". JSON.stringify is indispensable.'
      }
    },
    '12': {
      title: 'Opening the vault',
      subtitle: 'Secrets manager: unlock the application vault.',
      intro: "In production, an endpoint's documentation is often incomplete and it is the 401 response that tells you what it requires. The secret you need is almost always already somewhere in the page: a response received at load time, a variable in a closure, local storage. This challenge teaches you to look at all the page's requests and not just the failing one, and to replay a request adding a single thing.",
      symptom: 'The request is impeccable (POST, JSON, valid body) but the server answers 401, naming a missing header that the "Objectif" (Goal) box does not mention.',
      learn: [
        'Read a 401/403 response as "a secret is missing", not "a format is missing"',
        "Explore all the page's requests, including those sent at load time",
        'Extract a value from a network response or from a closure via a breakpoint',
        'Replay with Copy as fetch + one header, or wrap window.fetch to fix the page'
      ],
      hints: [
        "Network tab: look at ALL the page's requests, not just the button's.",
        'A response received when the page loads contains a value that the send request never reuses.',
        'The endpoint requires an authentication header that the code does not attach to its request.'
      ],
      debrief: {
        cause: 'At load time, the page calls GET /api/session and receives a token that it stores in a closure and displays masked. The opening request never sends it: the X-Api-Token header required by the endpoint is missing, hence the 401. The full token can be read in the /api/session response, or in the K.t variable on a breakpoint.',
        reflex: '401/403 on an otherwise correct request = a secret is missing. The authentication context is set up at load time: do not filter Network down to the single failing request.'
      },
      quiz: {
        question: "Where could the required token's value be found?",
        choices: [
          "In the page's HTML source, in plain text",
          'In the response of the GET /api/session request sent at load time (or in a variable on a breakpoint)',
          "In the server's 401 response",
          'Nowhere: you had to guess it'
        ],
        why: 'The page negotiates its session at load time: the full response is in Network. The masked display (ops_....xxxx) only shows the ends, but the raw response contains the whole token.'
      }
    },
    '13': {
      title: 'Blocking a merchant account',
      subtitle: 'Anti-fraud console: suspend a suspicious merchant account.',
      intro: 'Before any advanced technique, there is a skill many people neglect: reading an error. A stack trace says which file, which line, which value was null, and the link is clickable. This challenge teaches you to use the Console as your first source of information: read the message, follow the link to Sources, understand what the code was looking for and why it did not find it.',
      symptom: 'On click, a red error appears in the Console. No request goes out.',
      learn: [
        'Read an error message and its stack trace, click the link to the source',
        'Interpret "Cannot read properties of null": which call returned null and why',
        'Compare the identifier the code looks for with the one present in the DOM',
        'Fix the DOM on the fly in Elements and test again'
      ],
      hints: [
        'Console tab: read the whole red error, then click the file:line link on the right.',
        'On the line it points to, a function returns null. Look at which identifier it looks for, then search for it in the Elements tab.',
        'The identifier written in the HTML does not match the one the code asks for: one letter differs.'
      ],
      debrief: {
        cause: 'The handler reads the "seuil" (threshold) field with document.getElementById(\'threshold\'), but the HTML declares id="treshold" (without the h). getElementById returns null, and accessing .value throws a TypeError before the fetch. The Console shows the error with the exact line.',
        reflex: 'A red error is a gift: read it to the end, click the link, look at the offending value. "null (reading \'value\')" almost always means a selector found nothing.'
      },
      quiz: {
        question: 'What does "Cannot read properties of null (reading \'value\')" mean?',
        choices: [
          'The field exists but its value is empty',
          'The expression before .value is null: the selector found no element',
          'The value property is private',
          'The browser blocks access to the form'
        ],
        why: 'The message describes the object the property is being read from: it is null. With getElementById, that means no element has that id.'
      }
    },
    '14': {
      title: 'Pausing an advertising campaign',
      subtitle: 'Ad network: pause the campaign that is exceeding its budget.',
      intro: 'Unit errors (seconds versus milliseconds, cents versus euros) are among the most frequent and the hardest to see: the code is syntactically perfect, it just does something absurd. Here, a confirmation that should be almost immediate is scheduled a quarter of an hour later. This challenge teaches you to follow a deferred flow (setTimeout) with the debugger and to change a local variable while paused to test a hypothesis.',
      symptom: 'The button switches to "mise en pause programmée..." (pause scheduled...) and stays that way. No request, no error. If you wait long enough, it eventually goes out.',
      learn: [
        'Set a breakpoint in a handler and read the arguments of a setTimeout',
        'Change a local variable in the Console while paused, then resume',
        'Use a conditional breakpoint to fix on the fly without stopping',
        'Recognize a unit error (s / ms) in a delay computation'
      ],
      hints: [
        'Sources tab: set a breakpoint in the click handler (or Event Listener Breakpoints → Mouse → click).',
        'Step through to the call that schedules the send. Look at the numeric value passed as the second argument.',
        'The delay is computed in the wrong unit: what should be milliseconds is multiplied as if it were seconds.'
      ],
      debrief: {
        cause: "The configuration declares confirmDelay: 900 with unit: 's'. The delay() function multiplies by 1000 when the unit is \"s\": setTimeout(send, 900000), i.e. 15 minutes. The interface shows \"programmée\" (scheduled) and waits. Nothing is broken, everything is just absurdly slow.",
        reflex: 'When nothing goes out and nothing breaks, look for a delay. While paused in the handler, the Console evaluates in the current scope: you can read and fix the value before resuming.'
      },
      quiz: {
        question: 'Which technique fixes the delay without editing the file?',
        choices: [
          'Reload the page with the cache disabled',
          'Stop on a breakpoint before setTimeout and reassign the delay variable in the Console (or through a conditional breakpoint)',
          'Disable JavaScript then re-enable it',
          'Change the Time column in Network'
        ],
        why: 'While paused, the Console runs in the scope of the stopped function: changing a local variable changes the rest of the execution. A conditional breakpoint such as (ms = 10) && false does the same thing without ever stopping.'
      }
    },
    '15': {
      title: 'Signing a purchase order',
      subtitle: 'Procurement: electronically sign the supplier purchase order.',
      intro: 'CORS is the network topic that the most front-end developers suffer through without understanding it. An origin is scheme + host + port: localhost:3000 and 127.0.0.1:3000 are two different origins, just like two ports on the same host. For a JSON POST to another origin, the browser first sends, all by itself, an OPTIONS request (preflight) that you never wrote. This challenge shows you that ghost request in the server log and teaches you to read a CORS message instead of fearing it.',
      symptom: 'Red "blocked by CORS policy" error in the Console. In Network, the request is marked "CORS error" and the server log receives an OPTIONS you did not send.',
      learn: [
        'Define an origin (scheme + host + port) and recognize a cross-origin request',
        'Understand the OPTIONS preflight request and why the browser sends it',
        'Read a CORS error message and the server log as a mirror',
        'Identify in the code where the faulty absolute URL comes from and replay with a relative one'
      ],
      hints: [
        "Console tab first: read the CORS message to the end, it names the page's origin and the target URL. Then the Network tab.",
        'Compare the host and port of the called URL with those in the address bar. Also look at what the server log received (verb).',
        'The code builds an absolute URL to another origin (another port). The browser sends an OPTIONS preflight, the server does not allow it, and the POST is never sent.'
      ],
      debrief: {
        cause: 'The code picks a "fallback gateway" on the next port: http://<host>:<port+1>/api/... . That is another origin. For an application/json POST, the browser first sends OPTIONS (preflight). The server answers 405 without any Access-Control-Allow-* headers, so the browser blocks and never sends the POST. The server log does show the OPTIONS arriving.',
        reflex: '"blocked by CORS policy": compare the two origins quoted in the message. An OPTIONS you did not write in the server log = preflight. The client-side fix is almost always to call the same origin (relative URL).'
      },
      quiz: {
        question: 'Why did the server receive an OPTIONS request?',
        choices: [
          "The code explicitly called fetch with method: 'OPTIONS'",
          'The browser sends an OPTIONS preflight before a JSON POST to a different origin',
          'Express converts invalid POSTs into OPTIONS',
          'It is a keep-alive request from the browser'
        ],
        why: 'A "non-simple" cross-origin request (POST with Content-Type application/json) triggers an OPTIONS preflight. If the response does not contain the expected CORS headers, the browser never sends the real request.'
      }
    },
    '16': {
      title: 'Publishing a price list',
      subtitle: 'Pricing: publish the new price list.',
      intro: 'Caching a token in localStorage is a common optimization, and a classic source of ghost bugs: the cache survives redeployments, new sessions, server changes. The application then prefers a stale token to a fresh one, and the server answers 403 on a request that nevertheless has everything it needs. This challenge teaches you to open the Application tab, to inspect and edit local storage, and to reason about the order of precedence between cache and source of truth.',
      symptom: 'The request goes out with an X-Api-Token header, but the server answers 403: the token is present but does not match the current session.',
      learn: [
        'Inspect localStorage / sessionStorage in the Application tab',
        'Tell 401 (secret missing) apart from 403 (secret present but refused)',
        'Find the "cache first" logic in the code and understand why it never expires',
        'Delete or expire a storage entry to force the code to request a fresh session again'
      ],
      hints: [
        'Network tab: read the whole 403 response. Then Application tab → Local Storage.',
        'A local storage entry contains a token and an issue date. Compare that date with today, and compare the end of the token with the one the server issues on /api/session.',
        'The code prefers the cached token, whose expiry is far in the future, and never requests a fresh session again.'
      ],
      debrief: {
        cause: 'At load time, an "SSO handoff" block embedded in the page is copied into localStorage under the pricing.session key if it is not already there. That block contains a token from a past session, with an expiry in 2027. getToken() reads the cache first, finds it "valid", and never calls /api/session. The server compares it with the current session\'s token: 403.',
        reflex: '403 with a token present = wrong value, not wrong format. Open Application → Local Storage: a session cache is the first suspect. Deleting the entry (then clicking, without reloading: a reload re-injects it) or moving its expiry date into the past forces the code to go back through the source of truth.'
      },
      quiz: {
        question: "What is the difference between challenge 12's 401 and this one's 403?",
        choices: [
          'None, they are synonyms',
          '401: the authentication header is missing; 403: it is present but its value is refused',
          '401 is about GETs, 403 is about POSTs',
          '403 means the server is under maintenance'
        ],
        why: "The dojo's server answers 401 when X-Api-Token is missing and 403 when it is there but does not match the session. The distinction immediately steers the diagnosis: format vs value."
      }
    },
    '17': {
      title: 'Exporting accounting entries',
      subtitle: "Accounting: send the month's entries to the accounting firm.",
      intro: 'Third-party scripts (analytics, consent, security "guardrails") love wrapping window.fetch. When one of them decides to hold a request back and answer in its place, the application believes it succeeded while the server saw nothing. The trap is twofold: the Console is empty at the default level, and replaying the request from the Console goes through the same replaced fetch. This challenge teaches you to cross-check three mirrors (page log, Network panel, server log), to verify the identity of a native function, to use the Verbose level, and to block a script at load time from DevTools.',
      symptom: 'The page log announces a 202 "mise en quarantaine" (quarantined) response. Yet Network shows no solve request and the "Journal du serveur" (server log) panel stays empty.',
      learn: [
        "Cross-check the application log, Network and the server log: when they diverge, something is answering in the server's place",
        'Verify that a function is native (fetch.toString(), [native code]) and spot a monkey-patch',
        "Show the Console's Verbose level",
        'Block a script URL (Network → Block request URL) or restore the native function while paused'
      ],
      hints: [
        'Compare the three mirrors: the page log says 202, but Network and the "Journal du serveur" panel see nothing. Something in the page is answering in the server\'s place.',
        'Console: simply type fetch and read what is displayed. Also switch the log level to "Verbose" and click again.',
        'A third-party script loaded in the <head> has replaced window.fetch and quarantines POSTs to the API without sending them. Replaying from the Console goes through that same fetch.'
      ],
      debrief: {
        cause: '17-guard.js, loaded before the page\'s code, replaces window.fetch with a wrapper: any POST to /api/ outside the allowlist is "quarantined", that is, never sent, and the wrapper returns a fake 202 Response. The page displays that response as if it came from the server. A console.debug (Verbose level, hidden by default) gives the operation away.',
        reflex: "When the app log and Network contradict each other, the page is lying. Type fetch in the Console: a native function displays [native code]. Blocking the third-party script's URL in Network and reloading is the cleanest way to test the hypothesis."
      },
      quiz: {
        question: 'Why did replaying the request from the Console not work in this page?',
        choices: [
          'The Console is not allowed to call the API',
          "The page's window.fetch had been replaced by the third-party script's wrapper; the Console uses that same fetch",
          'The server blocked requests without a Referer header',
          'The session token had expired'
        ],
        why: "The Console runs in the page's context: it sees the same window.fetch, hence the same wrapper. You have to either go through a native function (iframe, XMLHttpRequest) or prevent the third-party script from loading."
      }
    },
    '18': {
      title: 'Re-arming an alarm',
      subtitle: 'Datacenter supervision: re-arm the temperature alarm after maintenance.',
      intro: "The addEventListener options (once, passive, capture, signal) change a listener's behavior in a way that is invisible in the HTML. A once listener disappears after its first execution, whatever triggered it: if a self-test dispatches a synthetic event at startup, the listener is consumed before the first human click. This challenge teaches you to tell a trusted event apart from a synthetic one (isTrusted), to read a listener's options, and to reach a closure from the debugger to repair a state without touching the file.",
      symptom: 'The button does not react. Yet the page log mentions an "auto-test du bouton OK" (button self-test OK) at load time. The button\'s Event Listeners panel lists no click.',
      learn: [
        "Read a listener's options (once, passive, capture) and understand once",
        'Tell a trusted event (isTrusted) apart from a synthetic one (dispatchEvent)',
        'Interrupt startup with a breakpoint and neutralize a call before it happens',
        'Re-attach a listener from the Console by reaching a closure while paused'
      ],
      hints: [
        'Elements tab → Event Listeners on the button: there is no click. Yet the code registers one. So it was removed.',
        'Sources tab, pretty print: look at the OPTIONS passed to addEventListener, and at what the "auto-test" log does at load time.',
        'A synthetic event fired at startup consumed the single-use listener before your first click.'
      ],
      debrief: {
        cause: "The listener is attached with { once: true } (\"to avoid double re-arming\"). At startup, a self-test calls E.go.dispatchEvent(new MouseEvent('click')); the handler sees isTrusted === false, logs \"auto-test OK\" and returns, but once has already removed the listener. The human click has nobody left to hear it.",
        reflex: 'Empty Event Listeners + a listener that is definitely in the code = it was removed. once and AbortSignal are the suspects. While paused in the closure, the Console can re-attach the listener or neutralize the faulty dispatch.'
      },
      quiz: {
        question: 'Why had the listener disappeared before the first human click?',
        choices: [
          'The button had been replaced by a clone',
          "The once option removed it after the self-test's synthetic event, even though the handler ignored that event",
          'removeEventListener was called in a setTimeout',
          'The browser removes passive listeners after 1 second'
        ],
        why: 'once removes the listener as soon as it has been invoked once, regardless of what the handler does or where the event came from. dispatchEvent counts as an invocation.'
      }
    }
  }
};
