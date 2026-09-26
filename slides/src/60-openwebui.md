---

<!-- _class: section -->

# The Workspace

## Connect and use it in Open WebUI

---

<!-- _class: concept -->

## The connection is seeded

- URL: `http://bifrost:8080/v1`
- Key: `not-required`
- Internal Docker name, not `localhost`

<!--
Presenter notes:
- Compose seeded this at first launch. It now persists in Open WebUI's database.
-->

---

<!-- _class: demo -->

## Confirm the connection

![shot right:46%](assets/screenshots/60-webui-connection.png)

1. Open WebUI → **Admin Settings → Connections → OpenAI**
2. Confirm the URL is `http://bifrost:8080/v1`
3. Save, then verify
4. Optionally add **Model IDs (Filter)** entries

<!--
TODO: capture assets/screenshots/60-webui-connection.png
Presenter notes:
- Filter format is provider/model, e.g. openrouter/<model-id>.
-->

---

<!-- _class: demo -->

## Send the first request

![shot right:46%](assets/screenshots/61-webui-chat.png)

1. Start a new chat
2. Choose a Bifrost-backed model
3. Send a short message
4. Confirm the reply, and the request in Bifrost logs

<!--
TODO: capture assets/screenshots/61-webui-chat.png
Presenter notes:
- This closes the loop: Open WebUI, Bifrost, provider, model, back.
-->

---

<!-- _class: concept -->

## The path a request takes

```
Open WebUI --> bifrost:8080/v1 --> Bifrost --> OpenRouter --> model
```

<!--
Presenter notes:
- Say it once, slowly. This is the mental model for everything after.
-->

---

<!-- _class: checkpoint -->

## You should now have

- A working connection to Bifrost
- A model selected and replying
- Requests visible in Bifrost logs

<!--
Presenter notes:
- Celebrate; this is the milestone.
-->

---

<!-- _class: lab -->

## Try it yourself

- Add a second model to the selector
- Ask a question about a file you upload
- Check the Bifrost log entry for that request

<!--
Presenter notes:
- Give participants a few minutes. Circulate.
-->
