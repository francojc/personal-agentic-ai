# Architecture

```text
Your devices
    |
Tailscale
    |
TSDProxy  -- private service publication
    |
    +--> Open WebUI --http://bifrost:8080/v1--> Bifrost --> model providers
    |
    +--> Bifrost UI (owner administration)
```

## Ownership boundaries

**Docker Compose** owns lifecycle, networking, volumes, image versions, and the two stable infrastructure secrets.

**TSDProxy** owns private Tailscale publication of selected containers. It watches Docker labels and therefore has privileged Docker socket access.

**Open WebUI** owns the user's workspace. Its Bifrost OpenAI-compatible connection is seeded at first launch and then persists in Open WebUI's database.

**Bifrost** owns provider credentials and model/routing configuration. Its UI configuration persists in `/app/data`.

## Why localhost ports remain in V1

They provide a predictable bootstrap and recovery path before Tailscale is authenticated. They bind to `127.0.0.1`, not the LAN. A later hardened profile can remove them after setup.
