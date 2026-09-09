# DSH Desktop plugin topology and load chain

[中文](plugin-topology.md) | English

> A "show-with-pictures" explainer for teammates. It documents the actual topology of plugins like `dsh-image-video` inside the desktop project: how they are loaded, in what order, and how API keys are filled in. Assumes you've already read [plugin-development.md](plugin-development.md) and [architecture.md](architecture.md).

## 1. TL;DR

**There is exactly one `dsh-image-video` in the entire project. There are no "two copies" or "two coexisting versions".** Here is what it looks like:

| Dimension | Value |
|---|---|
| Path | `./dsh-image-video/` (a sibling of the repo root) |
| Source | Git submodule; `.gitmodules` points at `https://github.com/ihero3/dsh-image-video.git` |
| Form | An independent npm package (`name: dsh-image-video`, `version: 0.3.0`) and a Yarn workspace |
| Build | Self-hosted `tsdown` build emits `lib/index.js` + `lib/types/index.d.ts` |
| Registration entry | Its own `cordis.patch.yml` uses `- insert: image-video` to attach to the DSH profile |
| Position inside desktop | The desktop plugin's `dsh-plugin-desktop/cordis.patch.yml` overrides config via `- id: image-video` so users can fill in their own API keys; the two layers do not conflict |

**The default `provider` is `threerouter`, not `wanx`** — both the desktop profile and the plugin patch explicitly write `provider: threerouter`. If you saw or used `wanx`, it was because you passed it manually, or you filled your key into the `wanx` block.

## 2. Why it might look like "two copies"

Earlier you called `provider: "wanx"` and pulled `DASHSCOPE_API_KEY` from `~/.dsh/.env`. That was the **DSH installation's built-in image-video (older version)**, which **shares no code** with this desktop project:

| Source | Location | Provider union | Default provider |
|---|---|---|---|
| DSH installed copy (older) | `~/.dsh/.../dsh-image-video` (unrelated to your desktop checkout) | `'bxinle' \| 'wanx' \| 'seedance'` | Depends on profile; often `wanx` |
| Desktop project's independent plugin | `./dsh-image-video/` (git submodule + Yarn workspace) | `'threerouter' \| 'wanx' \| 'seedance'` | `threerouter` (written in both patches) |

The path `deepseek-harness/dsh-image-video` **does not exist in the current repo** (`find deepseek-harness -maxdepth 2 -name "dsh-image-video"` returns empty). The "other copy" you used earlier was the DSH installation, not this project's submodule.

## 3. How a teammate's clone auto-loads the plugin

The load chain is five steps, and every step is **already wired up** in the repo:

1. **Git submodule pulls source**
   - `.gitmodules` declares:
     ```
     [submodule "dsh-image-video"]
         path = dsh-image-video
         url = https://github.com/ihero3/dsh-image-video.git
     ```
   - `git submodule update --init --recursive` fetches it
   - Root `package.json#scripts.dev` starts with that exact command

2. **Yarn workspace links it**
   - Root `package.json#workspaces` includes `dsh-image-video`
   - `corepack yarn install --immutable` symlinks the submodule into root `node_modules`

3. **Build the dsh-image-video submodule artifacts**
   - **`dsh-image-video/.gitignore` excludes `lib/`** — the build artifacts are **not** checked in, and the submodule only ships source.
   - Right after a teammate's `git submodule update`, `lib/index.js` is missing.
   - Fix: the root `package.json#scripts` now prepends `yarn workspace dsh-image-video build` to every `build` / `dev` / `package:dir` / `dist:*` command that needs it.
   - Translation: a teammate only needs to run the boot commands below — **no manual `cd` into the submodule**.

4. **Plugin self-registers into the DSH profile**
   - `dsh-image-video/package.json#dsh.bundle.patch = ./cordis.patch.yml`
   - That `cordis.patch.yml` uses `- insert: image-video` to add a row to the profile root (without overwriting any existing plugin row)
   - Default `provider: threerouter`; apiKey for threerouter/wanx/seedance is left empty so the user fills it via the desktop profile override

5. **Desktop profile overrides config (for user-filled keys)**
   - `dsh-plugin-desktop/cordis.patch.yml` line 33:
     ```yaml
     - id: image-video
       config:
         provider: threerouter
         threerouter:
           apiKey: ''
           baseURL: ''
         ...
     ```
   - The comment in that file reads:
     > The entry itself is registered by dsh-image-video's bundle patch; this row only overrides config so updating the plugin via `git pull` won't conflict.
   - This way `git pull` upgrades of the plugin never conflict; user keys only touch the desktop patch

## 4. Filling in the threerouter API key

The desktop profile leaving keys blank is a convention — on first `yarn dev`, `dsh-image-video` will throw "API Key not configured" from `resolveActiveProvider`. We added a **bootstrap script** to handle this:

### Automatic path (recommended)

`scripts/bootstrap-image-video-keys.mjs` runs before `yarn dev`:

1. Parse the `image-video` block of `cordis.patch.yml`
2. If `threerouter.apiKey` is still the placeholder `''`:
   - Read `~/.dsh/.env` then `~/.dsh/.eee` (in that order — to support users who historically renamed `.env` to `.eee`)
   - Look up `THREEROUTER_MEDIA_API_KEY` then `THREEROUTER_API_KEY` (in that order)
   - If found → write back to `cordis.patch.yml`'s `threerouter.apiKey` (preserves comments and ordering)
   - If not found → print a banner explaining how to fill it; do **not** block startup (exit 0)
3. If `threerouter.apiKey` is already filled → skip, respecting the user's manual override

### Manual path

**Option A: Add a line to `~/.dsh/.env`** (recommended)

```sh
THREEROUTER_MEDIA_API_KEY=sk-your-key-here
```

Then run `yarn dev` once; the script auto-writes `cordis.patch.yml`.

**Option B: Edit `cordis.patch.yml` line 36 directly**

Change:

```yaml
threerouter:
  apiKey: ''
  baseURL: ''
```

to:

```yaml
threerouter:
  apiKey: 'sk-your-key-here'
  baseURL: ''
```

**Option C: Switch providers**

Change `provider: threerouter` on line 35 of `cordis.patch.yml` to `wanx` or `seedance`, then fill the apiKey in the matching block.

### Skip the bootstrap

For CI or when you don't want `cordis.patch.yml` to be auto-modified:

```sh
SKIP_IMAGE_VIDEO_BOOTSTRAP=1 yarn dev
```

### First-time clone commands for a teammate

```sh
git clone <repo>
cd deepseek-harness-desktop
git submodule update --init --recursive
corepack yarn install --immutable
corepack yarn dev
```

`yarn dev` runs in this order:
1. `git submodule update --init --recursive` (re-confirm submodules are present)
3. `yarn workspace dsh-image-video build` (produces `lib/index.js`)
4. `yarn workspace dsh-community-market build`
5. `yarn workspace dsh-plugin-desktop dev` (internally runs `yarn run build && node scripts/bootstrap-image-video-keys.mjs && node lib/bin.js`)
6. `bootstrap` script auto-fills `THREEROUTER_MEDIA_API_KEY` / `THREEROUTER_API_KEY` from `~/.dsh/.env` into `cordis.patch.yml`
7. Electron GUI launches

### Why `cordis.patch.yml` ends up dirty

This is **expected**: every developer has a different API key, and after the script writes the file, `git status` will show it as modified. Recommended handling:

- Add `cordis.patch.yml` to `.git/info/exclude` (local-only; team unaffected)
- Or `git add cordis.patch.yml && git commit` once and never modify it again
- Do **not** push a `cordis.patch.yml` containing a real key to the remote

## 5. Version upgrades

`dsh-image-video` is an independent npm package with its own version (currently `0.3.0`). `yarn workspace dsh-image-video build` runs inside the submodule. To upgrade:

```sh
cd dsh-image-video
git pull        # pull new version
yarn install    # install new deps
yarn build      # rebuild lib/index.js
cd ..
yarn dev        # restart desktop
```

The desktop repo **needs no changes** — submodule pin updates stay independent of desktop behavior changes (see [AGENTS.md §Commit conventions](../AGENTS.md)).

## 6. Related documents

- [plugin-development.md](plugin-development.md) — how to write a new plugin
- [plugin-ecosystem.md](plugin-ecosystem.md) — high-level ecosystem vision
- [architecture.md](architecture.md) — overall architecture
- [AGENTS.md §Prerequisites and setup](../AGENTS.md) — Yarn 4 + Corepack + submodule init conventions
- `dsh-image-video/README.md` — the plugin's own full documentation