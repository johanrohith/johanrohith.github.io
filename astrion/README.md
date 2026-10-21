# Astrion — Johan Rohith

Astrion is a personal website designed as a journey rather than a conventional portfolio grid. Visitors move through three connected worlds — the universe, digital making, and literature — before returning to the star where they began.

## Experience

- **One continuous journey:** natural scroll, touch, keyboard scrolling, and chapter markers move through five story beats. Background visuals transition continuously between them instead of switching between cards or slides.
- **A procedural visual world:** `world.js` draws a deep star field and spiral galaxy, a perspective data grid and network, warm moving ink paths, and a final star/orbit. The compositions are generated in canvas; no large background video or image bundle is needed.
- **Content in the world:** Uravu appears in the universe chapter; Liora, MCC ReLoop, and Forest Explorer appear as editorial project lines in the digital chapter; Echoes of the End and Astrion worldbuilding appear in literature.
- **A loop:** the final scene returns to a single star and repeats the opening idea.
- **ASTRA:** a very small recurring signal, presented as an imagined concept rather than a finished product.
- **Controls:** ambient tone is opt-in and off by default. A motion control and the system `prefers-reduced-motion` setting are supported.

## Files

- `index.html` — semantic chapter content and controls
- `style.css` — typography, responsive layouts, transitions, and accessibility styles
- `world.js` — canvas rendering, scroll-linked scene blending, navigation, and optional ambient audio
- `favicon.svg` — the small star-and-orbit mark

The page is static and has no build step or JavaScript framework requirement. The three fonts are progressive enhancements; system fallbacks remain available if external fonts cannot load.

## Links

- [Live website](https://johanrohith.me/astrion/)
- [Source files](https://github.com/johanrohith/johanrohith.github.io/tree/main/astrion)
- [GitHub profile](https://github.com/johanrohith)
