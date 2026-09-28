#let ink = rgb("172b3a")
#let accent = rgb("156576")
#set document(title: "The Personal Agentic OS", description: "A draft whitepaper on control planes, decision models, and human learning. Draft 0.2 · September 2026.")
#set page(paper: "us-letter", margin: (x: 0.78in, top: 0.8in, bottom: 0.78in), numbering: "1", number-align: right, header: context {
  if counter(page).get().first() > 1 {
    set text(font: "Avenir Next", size: 8pt, fill: accent)
    [PERSONAL AGENTIC OS #h(1fr) WHITEPAPER · DRAFT 0.2]
    v(5pt)
    line(length: 100%, stroke: 0.4pt + rgb("cbd8dc"))
  }
}, footer: context {
  if counter(page).get().first() > 1 {
    set text(font: "Avenir Next", size: 8pt, fill: rgb("657680"))
    [Conceptual framework · September 2026 #h(1fr) #counter(page).display("1")]
  }
})
#set text(font: "Charter", size: 10.5pt, fill: ink, lang: "en")
#set par(justify: true, leading: 0.63em, spacing: 0.85em)
#set heading(numbering: none)
#set block(spacing: 1.1em)
#show heading: set text(font: "Avenir Next", fill: accent)
#show heading.where(level: 1): it => {
  if it.body == [Notes and primary sources] { pagebreak(weak: true) }
  block(above: 20pt, below: 13pt)[#text(size: 21pt, weight: "bold", it.body)]
}
#show heading.where(level: 2): it => block(above: 16pt, below: 8pt)[#text(size: 13pt, weight: "bold", it.body)]
#show heading.where(level: 3): set text(size: 11pt, weight: "bold")
#show link: set text(fill: accent)
#show raw: set text(font: "Menlo", size: 8.4pt)
#show quote.where(block: true): it => block(fill: rgb("eef5f6"), inset: 15pt, stroke: (left: 3pt + accent), radius: 2pt)[#it.body]
#set list(indent: 12pt, body-indent: 7pt, spacing: 7pt)
#set enum(indent: 15pt, body-indent: 6pt, spacing: 7pt)
#set table(inset: 7pt, stroke: (left: none, right: none, top: none, bottom: 0.4pt + rgb("d5dfe3")), fill: (x, y) => if y == 0 { rgb("e5eff2") } else if calc.rem(y, 2) == 0 { rgb("f5f8f9") } else { white })
#show table: set text(font: "Avenir Next", size: 8.4pt)
#show table: set par(justify: false, leading: 0.52em)
#show figure.where(kind: table): set block(breakable: true)
#show figure.caption: set text(font: "Avenir Next", size: 8.5pt, fill: rgb("657680"))
#set figure(gap: 9pt)
#let horizontalRule = line(length: 100%, stroke: 0.5pt + rgb("cbd8dc"))
#let divider() = horizontalRule

// Cover: publication metadata reproduced from the Markdown.
#v(0.7in)
#text(font: "Avenir Next", size: 10pt, tracking: 2pt, fill: accent)[RESEARCH & DESIGN WHITEPAPER]
#v(0.35in)
#text(font: "Avenir Next", size: 43pt, weight: "bold", fill: ink)[The Personal\ Agentic OS]
#v(0.25in)
#text(font: "Avenir Next", size: 19pt, fill: accent)[A draft whitepaper on control planes, decision models, and human learning]
#v(0.35in)
#line(length: 22%, stroke: 3pt + accent)
#v(1fr)
#text(font: "Avenir Next", size: 12pt, weight: "bold")[Draft 0.2 · September 2026]
#v(12pt)
#text(size: 10pt)[*Scope:* Conceptual framework and exploratory design; product details reflect documentation reviewed September 28, 2026.]
#pagebreak()
#outline(title: [Contents], depth: 1, indent: 0pt)
#pagebreak()
