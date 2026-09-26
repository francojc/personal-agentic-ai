---

<!-- _class: section -->

# Optional: Dev Container

## A place to build and run project files

---

<!-- _class: concept -->

## What the dev layer adds

- `devbox` — VS Code in the browser
- `mcp` — an agent tool bridge
- A shared host workspace, mounted into both
- Neither service gets the Docker socket

<!--
Presenter notes:
- Keep this optional on workshop day; it is a stretch goal.
-->

---

<!-- _class: demo -->

## Start it

![shot right:46%](assets/screenshots/70-devbox.png)

1. Run `./scripts/dev.sh`
2. Open `http://localhost:8443`
3. The workspace maps to a folder on the host

<!--
TODO: capture assets/screenshots/70-devbox.png
Presenter notes:
- set DEV_WORKSPACE to keep projects outside the repo.
-->

---

<!-- _class: pitfall -->

## Not a security boundary

- The workspace is writable host files
- The command allowlist is defense in depth, not a sandbox
- Prefer a dedicated folder, not all of `$HOME`

<!--
Presenter notes:
- Be explicit: this is a convenience boundary.
-->

---

<!-- _class: checkpoint -->

## You should now have

- A browser IDE bound to a host folder
- Optionally, an agent tool bridge registered in Open WebUI
- No Docker socket exposure

<!--
Presenter notes:
- Bridge to wrap-up.
-->
