---

<!-- _class: section -->

# Appendix · Advanced

## Decision models and local inference

---

<!-- _class: concept -->

## Decision models: decide, then generate

- Jev / Ollaya answer typed questions with labels and probabilities
- Not chat models: no generated response
- Use for classification, triage, routing, and workflow selection
- CPU-only Ollaya service can run beside the core stack

<!--
Presenter notes:
- Ollaya exposes TypeSafe System One API at http://ollaya:11435 on the Compose network.
- Its CPU container was tested locally with laya:en.
- Bifrost handles chat-model inference; it does not natively consume Ollaya's decision API. A separate caller or adapter is needed to connect decisions to generation.
- Compose service is intentionally commented out. Keep advanced service disabled for participant setup unless explicitly enabling this optional demo.
- Example flow: request → decision model returns typed judgment → application/pipeline selects workflow or model → Bifrost routes chat completion.
- Treat scores as judgments, not proof or authorization for consequential actions.
- Ollaya project: https://github.com/ollaya-dev/ollaya
-->
