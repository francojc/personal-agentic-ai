---

<!-- _class: section -->

# Prerequisites

## Done before workshop day

---

<!-- _class: concept -->

## What you need installed

- A container runtime: OrbStack or Docker Desktop
- Docker Compose
- Tailscale, joined to your own tailnet
- An OpenRouter account with $5 credit

<!--
Presenter notes:
- Emphasize this is pre-work. Workshop time is for building and using.
-->

---

<!-- _class: demo -->

## Prove your runtime works

![shot right:46%](assets/screenshots/20-docker-version.png)

1. Open a terminal
2. Run `docker version`
3. Run `docker compose version`
4. Both must succeed before continuing

<!--
TODO: capture assets/screenshots/20-docker-version.png
Presenter notes:
- Stop here if either command fails.
-->

---

<!-- _class: pitfall -->

## The most common blocker

**No running Docker daemon.**

Start OrbStack or Docker Desktop, then rerun the check.

<!--
Presenter notes:
- This is the single most common stall on workshop day.
-->

---

<!-- _class: checkpoint -->

## Pre-work checklist

- Container runtime running
- Tailscale joined to your tailnet
- Second device joined (recommended)
- OpenRouter key created, $5 limit, stored securely

<!--
Presenter notes:
- If any item is missing, participants can observe today and complete later.
-->
