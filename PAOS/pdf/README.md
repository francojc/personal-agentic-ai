# Whitepaper PDF

Output: `../paos.pdf`.

## Rebuild

Requires Python 3, Pandoc, Typst, and locally installed Charter, Avenir Next, Arial, and Menlo fonts.

```bash
python3 PAOS/pdf/build.py
```

Run from the repository root, or invoke `build.py` by its absolute path from elsewhere.

The build reads `../Agentic_Work_Control_Planes_Whitepaper_Draft.md` without modifying it. Pandoc preserves document content, tables, links, and numbered references. Original title, subtitle, version, and scope move to a dedicated cover. Typst adds a linked contents page, running headers, page numbers, table styling, and PDF bookmarks.

The three simple Mermaid diagrams are redrawn as local SVGs, preserving their node labels and directed connections. Diagram rendering is tailored to this whitepaper's current graphs, not a general Mermaid renderer. No external rendering service is used. Generated Typst and SVG files live in ignored `build/`.

Edit `template.typ` to adjust typography and layout. Product descriptions and source claims are reproduced, not independently verified by this conversion.
