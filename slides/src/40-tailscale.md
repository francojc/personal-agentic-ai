---

<!-- _class: section -->

# Private Access

## TSDProxy and Tailscale

---

<!-- _class: concept -->

## What TSDProxy does

- Watches Docker for labeled services
- Publishes them inside your tailnet
- Adds TLS automatically via Tailscale

<!--
Presenter notes:
- TSDProxy has Docker socket access. Treat it as trusted infrastructure.
- Expected names: webui and gateway.
-->

---

<!-- _class: demo -->

## Authenticate the nodes

![shot right:46%](assets/screenshots/40-auth-helper.png)

1. Run `./scripts/tsdproxy-auth.sh`
2. Open each link and sign into your tailnet
3. Approve `webui` and `gateway`
4. Re-run the script to confirm none are pending

<!--
TODO: capture assets/screenshots/40-auth-helper.png
Presenter notes:
- Auth URLs are single-use and regenerate on restart. Click promptly.
-->

---

<!-- _class: demo -->

## Find your private URLs

![shot right:46%](assets/screenshots/41-tsdproxy-dashboard.png)

1. Open `http://localhost:8080`
2. Note the `webui` and `gateway` hostnames
3. These are your normal-use addresses

<!--
TODO: capture assets/screenshots/41-tsdproxy-dashboard.png
Presenter notes:
- Copy the exact names from the dashboard. Do not invent the tailnet suffix.
-->

---

<!-- _class: demo -->

## Prove it is private

1. On a second device, open both URLs
2. Confirm they load
3. Turn Tailscale off on that device
4. Confirm they no longer load

<!--
Presenter notes:
- This is the useful test. Reconnect Tailscale when done.
-->

---

<!-- _class: pitfall -->

## Two traps

- Running `latest` TSDProxy pulls the v3 beta and changes naming
- Restarting TSDProxy regenerates the auth links

<!--
Presenter notes:
- We pin 2.3.4 for this reason. See docs/RESEARCH-NOTES.md.
-->

---

<!-- _class: checkpoint -->

## You should now have

- Both nodes authenticated
- `webui` and `gateway` reachable from a second device
- Localhost still available as a recovery path

<!--
Presenter notes:
- Bridge to the provider phase.
-->
