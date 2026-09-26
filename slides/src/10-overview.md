---

<!-- _class: section -->

# Overview

## The shape of the system

---

<!-- _class: concept -->

## The stack, in one picture

![bg right:52% contain](assets/diagrams/01-the-stack.svg)

- One workspace, one gateway
- Providers behind a single API
- Private by default

<!--
Presenter notes:
- Orient the room before any setup.
- Experience, gateway, compute: three layers.
- Do not read the diagram aloud; let it land.
-->

---

<!-- _class: concept -->

## What makes an agent

![bg right:52% contain](assets/diagrams/02-anatomy-of-an-agent.svg)

- A model plus context, tools, and boundaries
- The model is replaceable
- Permissions define the edge

<!--
Presenter notes:
- Anchor: a model is not an agent.
- Point at Permissions; that is where safety lives.
-->

---

<!-- _class: concept -->

## From answer to action

![bg right:52% contain](assets/diagrams/03-agentic-loop.svg)

- Chat produces an answer
- Agents pursue a goal
- Feedback closes the loop

<!--
Presenter notes:
- Contrast one pass versus a cycle.
- Note that tool actions stay within configured permissions.
-->

---

<!-- _class: checkpoint -->

## Why we build it this way

- Configuration lives in the browser, not in a repo
- Credentials live in the gateway, not in `.env`
- Access is private to your tailnet

<!--
Presenter notes:
- Connect these three to the upcoming phases.
-->
