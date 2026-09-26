---

<!-- _class: section -->

# The Stack

## Three services, one private workspace

---

<!-- _class: concept -->

## What runs where

- **Open WebUI** — chats, models, knowledge, tools
- **Bifrost** — providers, keys, routing, logs
- **TSDProxy + Tailscale** — private HTTPS access

<!--
Presenter notes:
- Map each service to a responsibility.
-->

---

<!-- _class: concept -->

## Ownership boundaries

![bg right:46% contain](assets/diagrams/01-the-stack.svg)

- Compose owns lifecycle and secrets
- Bifrost owns provider credentials
- Open WebUI owns the workspace

<!--
Presenter notes:
- The diagram repeats from the overview on purpose: this is the buildable view.
-->

---

<!-- _class: demo -->

## Start it

![shot right:46%](assets/screenshots/30-setup-run.png)

1. Clone the repo
2. Run `./scripts/setup.sh`
3. Wait for images to pull
4. Confirm three containers are running

<!--
TODO: capture assets/screenshots/30-setup-run.png
Presenter notes:
- The script creates .env, generates secrets, starts the stack.
-->

---

<!-- _class: pitfall -->

## Keep secrets stable

- Do not change `BIFROST_ENCRYPTION_KEY` after Bifrost stores configuration
- Keep `WEBUI_SECRET_KEY` stable across container recreation
- Never commit `.env`

<!--
Presenter notes:
- Changing these breaks encrypted state or invalidates sessions.
-->

---

<!-- _class: checkpoint -->

## You should now have

- Three containers running
- A private `.env` with generated secrets
- Nothing sensitive in Git

<!--
Presenter notes:
- Quick poll: everyone see three running containers?
-->
