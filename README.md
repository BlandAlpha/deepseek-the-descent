# DEEPSEEK — THE DESCENT / 深潜

**Field Note 001** — an immersive, single-page concept experience from the deep.

Open **`index.html`** in a modern browser. No build step, no server, no network required — every texture, shader, particle, typeface and sound is generated or self-hosted locally.

## The experience
A cinematic descent from the surface of a question to the floor of an answer, in six chapters:

- **00 / SURFACE** — the hero. *The deep is not silent.*
- **01 / PHOTIC** — the thesis, illuminated word by word as you descend.
- **02 / TWILIGHT** — six interactive capability specimens drawn live on canvas.
- **03 / MIDNIGHT** — a reasoning console that streams four scripted, locally simulated traces.
- **04 / ABYSSAL** — a 256-expert mixture-of-experts routing field, 8 awake at a time.
- **05 / HADAL** — scale, telemetry, a descent profile, and *to reason is to refuse the first answer.*
- **06 / ASCENT** — ask the deep a question and receive a locally generated descent record. *There is no floor.*

## Controls / details
- Scroll to descend; click the right rail to move between chapters.
- **⌘K / Ctrl+K** or **INDEX** opens the command palette (chapters, sound, film grain, sonar).
- **SOUND OFF** enables an entirely synthesised underwater ambience (Web Audio). Off by default.
- The rotating **sonar stamp** in the hero is a button.
- Hover the routing field in 04 to inspect experts; click to pin one. Keyboard: focus the field, use **← ↑ ↓ →** to inspect experts, **Enter** to pin/unpin, **Esc** to clear.
- All reasoning traces and answers are **scripted or generated locally**. No live model is contacted and no data leaves the page.

## Accessibility
- Keyboard-operable capabilities, routing field, palette, console and form.
- Live regions for reasoning status, expert inspection and the descent record; scrollable answer region is focusable.
- Visible focus states, a working skip link, reduced-motion support, and a fully readable no-JavaScript / no-WebGL fallback.
- Audited with axe-core against WCAG 2.0/2.1 A & AA in the main interactive states (0 violations found).

## Technical notes
- Vanilla HTML/CSS/JS; classic scripts for `file://` compatibility.
- Custom WebGL fragment-shader abyss, Canvas 2D specimen fields, Canvas 2D MoE routing field, Canvas 2D signal trace.
- Self-hosted variable/static webfonts: Instrument Serif, Space Grotesk, JetBrains Mono, and a Noto Serif SC display subset.
- Responsive from 320 px to ultrawide; reduced-motion and keyboard support; graceful WebGL fallback.
- No trackers, no external requests at runtime, no frameworks. Links to DeepSeek open only when you click them.
- Runs at 60 fps on Apple M4 hardware (headless ANGLE/Metal); adaptive WebGL resolution for slower GPUs.

## Files
```
index.html
css/main.css
js/app.js          experience orchestration
js/abyss.js        WebGL abyss
js/specimen.js     generative capability canvases
js/moe.js          256-expert routing field
js/audio.js        generative ambient engine
js/cursor.js       custom cursor / magnetism
assets/fonts/      self-hosted woff2
```

## Preview
- [Hero](preview/hero.png)
- [Nine-frame journey contact sheet](preview/contact-sheet.jpg)
- [Mobile hero](preview/mobile.png)

A speculative concept experience. Model figures reflect publicly described DeepSeek architecture; all traces, telemetry and responses are illustrative.

© 2026 DeepSeek.
