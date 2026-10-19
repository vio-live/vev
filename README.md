# Vio × Vev — Shoppable Blocks

Native [Vev](https://www.vev.design) components that make any Vev article **shoppable**
with the Vio commerce platform: product cards, carousels and grids with live catalog
data, variant-aware product detail, cart and checkout (Apple Pay / Klarna) — all powered
by the [`vio-web-sdk`](https://github.com/vio-live/vio-web-sdk) core.

This repo is the source of the Vev **component package `cq1lXld-TA9`**.

---

## How component installation works in Vev

Vev components are not installed per-project like an npm package — they are **deployed
to a component package** that lives in the Vev account, and then appear in the editor
for everyone with access:

1. A developer deploys this repo with `vev deploy`. That builds one optimized JS/CSS
   bundle for the whole package and publishes it to the package key in
   [`vev.json`](./vev.json) (`cq1lXld-TA9` — never delete or change this file).
2. After deploy, the components show up in the **Add menu** (left sidebar, or press `A`)
   of the Vev Design Editor, under the custom/coded components section. Designers just
   **search or browse, then click or drag** them onto the canvas like any built-in
   element — no install step on their side.
3. Who sees them is controlled by `vev.json`. This package sets
   `"shareWithAccount": true`, so after deploy the components appear in the Add menu
   for **every member of the account/workspace** — designers need zero setup.

> Docs: [CLI getting started](https://developer.vev.design/cli/getting-started/) ·
> [CLI commands](https://developer.vev.design/cli/commands/) ·
> [`vev.json` configuration](https://developer.vev.design/cli/configuration/) ·
> [Adding components (editor)](https://help.vev.design/en/articles/8892108-adding-components)

## Using the blocks (designer workflow)

1. Open the article project in the Vev editor.
2. Add **one** `Vio Config (SDK)` block anywhere on the page. It boots the SDK, mounts
   the global cart/checkout/product-detail overlays and the floating cart button. In
   the editor it shows a connection panel (status + Vio API key + Save/Disconnect);
   on the published page it renders nothing visible except the cart button.
3. Add product surfaces where the content needs them:

| Block | What it does |
|---|---|
| **Vio Config (SDK)** | Required, once per page. SDK init + cart/checkout/detail overlays + cart FAB. |
| **Vio Product Card** | Single product card. Pick the product in a modal (live catalog). |
| **Vio Product Carousel** | Horizontal scroll-snapped row of cards. Multi-select products, heading/kicker, arrows. |
| **Vio Product Grid** | Responsive grid of cards (2–5 columns, collapses to 2 on mobile). |
| **Vio · Open Product Info** | Action addon: click opens the product detail drawer. |

Card/carousel/grid share one card view — layouts (`standard`, `image-only`, `overlay`,
`horizontal`), button styles, badge/discount options and `editableCSS` styling are
identical everywhere.

4. Pick products in the block panel (modal picker with the sponsor's live catalog),
   style via the Design tab, publish. Checkout works end-to-end on the published page
   (Apple Pay requires the publish domain to be registered in Stripe).

## Component reference

Every product surface (Card / Carousel / Grid) shares the same **card options**:

| Prop | Values | Default |
|---|---|---|
| Card layout | Standard (image + info) · Image only · Info over image · Horizontal | Standard |
| Button | Icon (+) · Text (pill) · Full-width bar · No button | Icon |
| Button label | text | `Kjøp` |
| Button action | Add to cart · Open detail | Add to cart |
| Image click | Product info · Add to cart | Product info |
| Accent color | CSS color | — |
| Show brand / name / price / retailer | boolean each | all on |
| Discount badge | Off · Auto (from sale price) · Manual (text) | Off |
| 'Annonse' label | boolean + text | off / `Annonse` |
| Slot | text (optional) | — |
| Slot name | text (optional) | — |

Plus **editableCSS** styling (Design tab) for card, image, buttons, badge, brand,
name, price and retailer. Products with variants always open the detail drawer on
add (the buyer must pick a variant); sold-out combinations are disabled there.

Per block:

- **Vio Config (SDK)** — `Vio API Key`, `Active Sponsor`, `Campaign` (see below), `API Base`, `GraphQL Base`, `Stripe PK`
  (publishable, enables card + Apple Pay), cart button (`show`, `position` 4 corners,
  `icon` bag/cart/basket, `color`, `hover effect`, `size`). Ships with working
  staging defaults, so dropping the block needs zero config.
- **Vio Product Card** — product picker (single) + card options.
- **Vio Product Carousel** — product picker (multi), `Kicker`, `Heading`,
  `Disclaimer` (default `annonselenker`), `Visible at once` (2–5), `Gap`,
  `Show arrows` + card options.
- **Vio Product Grid** — product picker (multi), `Kicker`, `Heading`,
  `Columns` (2–5, collapses to 2 on mobile), `Gap` + card options.
- **Vio · Open Product Info** — product picker, `Slot`, `Slot name`. Attach to any element.

### Slots — one campaign per block (ADR-0027 / ADR-0034)

A **slot** is a place on a page the Vio dashboard can assign a campaign to, with a
date window; whatever no slot names shows the surface's default campaign. **Every
Vio block registers its own slot automatically** — nobody has to fill anything.

**Id.** The block's `Slot` field when set — several blocks with the same value are
**one** slot in the dashboard — else `<kind>-<instance key>` (`card-…`, `carousel-…`,
`grid-…`, `open-…`): the block's Vev instance key chain (`model.virtualKey || model.key`,
what Vev itself ids the element with), which survives republishing and is distinct for
every instance of a master component (thirty articles built from one template are
thirty slots).

**Name** (how the dashboard lists it): the `Slot name` field; else the block's heading
(carousel/grid `Heading`, then `Kicker`; a card: its product's title); else its kind and
position among its kind on the page (`Carousel 2`). Followed by ` · <page title>` so the
dashboard can tell which article a block belongs to — except for blocks in a **header or
footer section** or a **fixed** element, which every page shows (no page suffix; give
those a `Slot name` if the default reads poorly). An explicit `Slot` with no `Slot name`
stays **unnamed**: the server keeps the name that slot already has (another block may
have named it).

**Registration.** `Vio.registerSlot()` on mount (a card: once its product is known); the
SDK declares the page's slots once per load after the bootstrap (`mode: merge`,
`platform: vev`) and skips a set it declared from that browser in the last 24 h. The
editor's canvas counts as a page: a block shows up in the dashboard as soon as it exists
on the canvas, with Vio Config connected.

**Campaign of the page** (ADR-0034, amendments 3 and 4). Vio Config has a `Campaign` field: one
of the surface's campaigns, listed by name from the connected key's bootstrap
(`availableCampaigns[]`: every campaign that has not ended, active ones first, the others
with their status — `Navidad · scheduled`; an older micro gives only `campaigns[]`, the
active ones) the way `Active Sponsor` lists its sponsors — the field
reads what the Config wrote after connecting, so it says so until the key is connected.
The choice is saved as the block's `campaignId` (empty = the default campaign) and goes
into `Vio.init({ campaignId })`: the SDK (0.25.0, vendored) applies it wherever a slot has no
assignment from the dashboard — **assignment > page campaign > default** — for the
products a block fetches (that campaign's primary sponsor, when the key knows it), for
every event's `campaign_id`, and for the declaration of the page's slots, which carries
the campaign. Changing it re-initialises the SDK like changing the key (bootstrap again,
slots declared again under the new campaign, blocks re-resolved) — in the editor's
properties panel too, which learns the new value through `localStorage` (`vio.campaignId`,
written only in the editor) and re-inits its own SDK, so the picker lists that campaign's
catalog and the Vipps check queries that sponsor. Any campaign that has **not ended** can be
chosen, paused or scheduled too: the page's slots register under it right away (the editor
prepares the article before the window opens) and blocks keep using Active Sponsor until it
is active; a saved one that is not available for the key any more (ended, removed) counts as
none and the panel says so, like a saved sponsor the key lacks. "The default campaign" is
only the one the backend marks `isDefault`; the bootstrap's `campaign` is whatever the key
serves now (the default while active, else the most recent active one) and never stands in
for it. Blocks have no field of their own for this; the panel says it plainly: "Blocks sell
through this campaign's primary sponsor, overriding Active Sponsor; products picked under
another sponsor show as unavailable. The dashboard can still reassign any slot."

**Campaign per block.** A block whose slot has a campaign assigned (and open now) fetches
its products with that campaign's primary sponsor — instead of the page's Active Sponsor
— when the connected key knows that sponsor in **any** of its campaigns (`campaigns[]`
of the bootstrap, not only the default one); otherwise it falls back to the page
campaign's primary sponsor (so sponsor and campaign agree), else the page's sponsor, says
so once in the console, and attributes without that slot's campaign. With nothing
assigned: the page campaign's primary sponsor when a campaign is chosen in Vio Config,
else the page's Active Sponsor, as before.

**Attribution.** Every event a block emits (`view_item_list`, `select_item`, `view_item`,
`add_to_cart`, impressions, `begin_checkout` from the Vipps button) carries
`Vio.attribution(slot)` — `slot`, `campaign_id`, `sponsor_id`, `content_id`,
`content_title` (the article, resolved by the SDK from the page). The card's
`vio:product-click` carries it too, so the SDK's product detail inherits it; from the
SDK 0.23.x on, the detail, cart and checkout put it on `vio:added-to-cart`,
`vio:removed-from-cart`, `vio:checkout-open` and `vio:payment-success`, which the blocks
forward. A cart line keeps the `origin` of every unit (campaign, slot, article). The
`Open product info` **interaction** (Vio Config) and the action addon take an optional
`Slot` too: the detail opened from them carries it.

**What changes in the analytics with the 0.23.x bundle** (the same deploy carries it):

- `component_impression.location_id` is the **slot id** (it was the heading text, or
  `Vio Carousel` / `Vio Grid`), and the impression dedupe key includes the slot
  (`vev-carousel:<sponsor>:<slot>`), so a sponsor or slot change counts anew.
- Every event carries an explicit `sponsor_id` (the block's), `campaign_id` resolved from
  the slot, and `content_id` / `content_title`.
- `purchase` and `begin_checkout` go to Vio **once per campaign present in the cart**
  (the SDK's `cartSlices` rule: each unit to the campaign of its origin, units without
  one to the campaign their sponsor resolves to), each with its lines and value and the
  same transaction id, scoped to the sponsor that was paid. The publisher's GA4
  `dataLayer` keeps one event per purchase, its rows merged by product + variant.
- `Vio.init()` runs with `platform: "vev"` (bootstrap `?platform=vev`, declarations
  tagged `vev`), so the dashboard's assignments for Vev apply here.

The vendored SDK is **0.25.0** (built from `vio-web-sdk` branch `feat/contexto-estandar-0.25.0`, commit `0f904bd`, before its npm publish) (`Vio.registerSlot` / `campaignForSlot` / `attribution` /
`content` / `cartSlices` / `pageCampaign`, `campaignId` in `Vio.init`, `origins` on the cart
lines). The blocks still check for that API before calling it — a block must never throw
into the editor — so with an older bundle they behave as before, unregistered.

## Development

### Install (developers)

```bash
git clone https://github.com/vio-live/vev.git vio-vev && cd vio-vev
npm install
npm run login        # vev login — one-time CLI auth (Vev account with package access)
```

Requires Node.js ≥ 22. Designers install nothing — see
[How component installation works](#how-component-installation-works-in-vev).

### Dev loop

```bash
npx vev start        # dev server on :9876 — live-serves blocks to the editor
```

With `vev start` running, open the Vev editor and reload (`Cmd-R`): the package's
blocks are served from your working tree (green dot = connected). Edit files under
`src/components/` and the watcher recompiles; reload the editor to see changes.

> `vev start` occasionally dies when backgrounded — if blocks stop appearing in the
> editor, relaunch it.

### SDK bundle (vendored snapshot)

The blocks import the Vio core from [`vio-sdk/index.js`](./vio-sdk/index.js) — a
**vendored esbuild snapshot** of `vio-web-sdk`, not an npm dependency. If you change
the SDK itself:

```bash
cd ../vio-web-sdk && npx tsc --noEmit
npx esbuild src/_vev-entry.ts --bundle --format=esm --external:react --external:react-dom \
  --tsconfig=tsconfig.json --outfile=../vio-vev/vio-sdk/index.js
```

### Deploy

```bash
npx vev build        # sanity build of the package
npm run deploy       # vev deploy — publishes cq1lXld-TA9, components update in the editor
```

## Repo structure

```
src/components/
  vio-config.tsx          # Vio Config (SDK) — init, overlays, cart FAB, editor panel
  vio-product.tsx         # Vio Product Card (thin wrapper)
  vio-carousel.tsx        # Vio Product Carousel
  vio-grid.tsx            # Vio Product Grid
  card-view.tsx           # shared ProductCardView + hooks (one look everywhere)
  card-props.ts           # shared card config props + editableCSS
  product-picker.tsx      # modal product picker (single + multi select)
  product-select.tsx      # picker form component
  action-open-product.tsx # Vio · Open Product Info (action addon)
  vio-helpers.ts          # SDK init, catalog fetch, retry, DOM events (DEBUG flag),
                          # slots: useVioSlot / sponsorForSlot / vioAttribution
vio-sdk/                  # vendored SDK bundle (see above) — do not edit by hand
vev.json                  # package key — never delete
```

## Known pitfalls (editor crashes)

- Use `SilkeModal` (`@vev/silke`) for modals in prop editors — raw `createPortal`
  crashes the editor.
- Props of `type: "array"` combined with a custom editor component crash the editor —
  use `object` or flat CSV strings instead.
- The SDK bundle must live **outside** `src/` (the watcher would try to compile it).
- The Vio singleton is anchored on `globalThis` because Vev bundles each component
  into its own chunk — do not import SDK state through separate module instances.
- The widget id in the editor equals the **function name** passed to
  `registerVevComponent` — renaming the function re-registers the block and orphans
  existing placements.

## Package policy (2026-08-11)

**`cq1lXld-TA9` (team Vio) is the ONLY package real pages should use.** Alan's old
personal test package (`czGNimhyDCi`, was `vev-alan.json`) is deprecated: it carried
stale copies of the same 7 components (frozen 2026-07-28, pre-hardening) under
identical names, making it easy to drop an outdated block into a page. Vev
limitation: that package lives in Alan's personal account, so only Alan can unshare
it (`"shareWithAccount": false` + redeploy) — until he does, ignore any duplicate
"Vio …" components that are not from this package.

## Personal sandbox package (2026-08-18)

`vev deploy` has no staging concept — there's exactly one "current" version of
`cq1lXld-TA9`, and every deploy overwrites it unconditionally, no matter who runs
it. Two people iterating and deploying to it at the same time WILL overwrite each
other's work (this has actually happened — see the handbook journal, 2026-08-17/18).

If you want to deploy something to check it live in the Vev editor before it's
ready to share, don't deploy it to `cq1lXld-TA9`. Use your own sandbox package
instead, under your own Vev account (separate login, separate `vev.<name>.json`
config, gitignored):

```bash
npx vev login            # your OWN account — NOT the shared team Vio login
mkdir /tmp/my-sandbox-init && cd /tmp/my-sandbox-init
npx vev init              # prints a new package key under whatever account is logged in
# copy the resulting vev.json content into vio-vev/vev.<yourname>.json
```

Then, in this repo:

```bash
npm run sandbox:on        # copies vev.<yourname>.json over vev.json — now targets YOUR package
npx vev start              # or: npx vev deploy, to check it live in your own sandbox editor project
npm run sandbox:off       # restores vev.json to cq1lXld-TA9 (git checkout — always safe)
```

**Rules:**
- `vev.json` (no suffix) is the ONE shared config, always committed, always points
  at `cq1lXld-TA9`. Never commit a change to it that points somewhere else.
- `vev.<name>.json` files are personal, gitignored (`vev.*.json` in `.gitignore`) —
  each person's own sandbox, never shared, never meant to go live for real users.
- Always run `sandbox:off` before deploying/committing anything real — don't leave
  `vev.json` pointed at a sandbox. If in doubt, `git status` will show `vev.json` as
  modified if it's currently swapped.
- A sandbox package is for YOUR iteration/testing only. The only path to
  `cq1lXld-TA9` going live is the normal one: merge to `vio-web-sdk`/`vio-vev`
  `main`, rebundle, `vev deploy` from the real `vev.json` — same as always, this
  doesn't change that, it just keeps *testing* out of the shared package's way.
