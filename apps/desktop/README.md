# DeepSeek Harness Desktop

English | [中文](README.zh.md)

The desktop app supervises the existing loopback Web Host and keeps it alive from the system tray when its window is closed.

## Development

Build the repository once, then launch Electron:

```sh
pnpm run build
pnpm run dev:desktop
```

Closing the window hides it. Use the tray menu to restore the window or quit the application. Explicit quit waits for the Host process to stop and escalates termination after the bounded Host grace period.

The desktop app accepts only the readiness URL emitted by `dsh web` for `127.0.0.1` or `localhost`. Navigation stays on that origin; HTTP and HTTPS links open in the system browser.

The native window is frameless. macOS keeps its traffic lights and uses sidebar vibrancy; Windows keeps title-bar overlay controls and uses acrylic. The client reserves the native title-bar area, makes only the sidebar translucent, and keeps the conversation and details surfaces opaque. The macOS collapsed sidebar is 88px wide; its controls are centered and its top control aligns with the expanded logo row below the traffic lights. The center title-bar band remains draggable with or without a visible Session header, while controls inside a visible header remain clickable. Linux uses the same frameless layout with an opaque sidebar fallback.

## Known limitations

The first desktop assembly uses a loopback HTTP Host. The renderer and Host protocol remain unchanged so the application can replace the transport with the IPC carrier reserved by the GUI architecture without changing product features.

Packaging currently creates an unpacked application for the local platform. Signed installers, a bundled Node runtime, and the complete production dependency staging tree are separate release work.

## Model Experience

The desktop shell does not add model-visible input. The reused Web profile continues to own its existing Web runtime context.
