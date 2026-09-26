---

<!-- _class: section -->

# Provider Setup

## One gateway, one provider key

---

<!-- _class: demo -->

## The Bifrost checklist

![shot right:46%](assets/screenshots/50-bifrost-checklist.png)

1. Do: **Add a provider key**
2. Skip: Restrict CORS origins
3. Skip: Set up dashboard auth
4. Skip: Enforce auth on inference

<!--
TODO: capture assets/screenshots/50-bifrost-checklist.png
Presenter notes:
- Skipping is acceptable: localhost-only ports, private tailnet, personal workspace.
- Choose "Remind me later" to keep items visible.
-->

---

<!-- _class: pitfall -->

## Do not enable inference auth early

**Enforce auth on inference** requires a Bifrost virtual key.

Open WebUI's seeded connection uses `not-required`, so enabling this first breaks the link.

<!--
Presenter notes:
- Correct order lives in the hardening track in docs/04.
-->

---

<!-- _class: demo -->

## Add the provider key

![shot right:46%](assets/screenshots/51-bifrost-provider.png)

1. Bifrost → sidebar → **Model Providers**
2. Select **OpenRouter**
3. Add one key, name it `workshop-openrouter`
4. Paste the key here only, then save

<!--
TODO: capture assets/screenshots/51-bifrost-provider.png (redact the key)
Presenter notes:
- Bifrost owns the credential. Open WebUI never sees it.
-->

---

<!-- _class: demo -->

## Verify Bifrost directly

![shot right:46%](assets/screenshots/52-bifrost-logs.png)

1. `curl -fsS http://localhost:8081/v1/models`
2. Send one completion to a listed model
3. Open **Logs** and confirm the request

<!--
TODO: capture assets/screenshots/52-bifrost-logs.png
Presenter notes:
- Keep the first test boring: one provider, one model, one request.
- Models are addressed as provider/model.
-->

---

<!-- _class: checkpoint -->

## You should now have

- One provider key saved in Bifrost
- Models listed by `/v1/models`
- A request visible in Bifrost logs

<!--
Presenter notes:
- Bridge: now connect Open WebUI to this gateway.
-->
