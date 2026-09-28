# Beyond Chat

Standalone Marp deck for an informal, 30-minute faculty discussion, followed by questions. Separate from the hands-on workshop in `../../slides/`.

## Present

```bash
cd PAOS/slides
./build.sh --pdf
open dist/deck.html
```

HTML provides presenter mode with timed speaker notes. Share the audience window in Zoom, not the notes window. PDF is a backup; it also includes notes as PDF annotations, so distribute a notes-free export if needed. `./build.sh --html-only` builds without a browser. PDF defaults to browser discovery, with Helium supported on macOS; override using `MARP_BROWSER_PATH`.

Share the entire `dist/` folder for HTML use: images are local assets, not embedded in HTML. PDF is standalone.

## Structure

- Slides 1–2: familiar frustration, 0–3 minutes.
- Slide 3: chat, agents, and persistent work, 3–6 minutes.
- Slides 4–5: one research example, 6–11 minutes.
- Slide 6: responsibilities diagram, 11–16 minutes.
- Slides 7–8: research loop and learning, 16–22 minutes.
- Slide 9: failure modes and boundaries, 22–26 minutes.
- Slides 10–11: pilot and discussion, 26–30 minutes.
- Slides 12–15: optional reference images; outside the timed talk.

Slides use large type, minimal text, and full-slide diagrams. The dense original graphics appear only in the appendix. Main research-loop image enlarges the center of `../paos-research-loop.png`; the new responsibilities SVG presents a simplified, non-linear architecture. These are conceptual proposals, not demonstrations of working integrations. Product claims have not been independently reverified for this deck.

## Edit

Edit `deck.md`; speaker notes are HTML comments. Edit `assets/responsibilities.svg` for the simplified diagram. Build copies the original appendix images from `../`.

Regenerate the learning-loop crop after changing the original:

```bash
magick ../paos-research-loop.png -crop 670x790+380+110 +repage assets/research-loop-detail.png
```

Source argument: `../Agentic_Work_Control_Planes_Whitepaper_Draft.md`. Existing whitepaper and images remain unchanged.
