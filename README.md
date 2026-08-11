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

Plus **editableCSS** styling (Design tab) for card, image, buttons, badge, brand,
name, price and retailer. Products with variants always open the detail drawer on
add (the buyer must pick a variant); sold-out combinations are disabled there.

Per block:

- **Vio Config (SDK)** — `Vio API Key`, `API Base`, `GraphQL Base`, `Stripe PK`
  (publishable, enables card + Apple Pay), cart button (`show`, `position` 4 corners,
  `icon` bag/cart/basket, `color`, `hover effect`, `size`). Ships with working
  staging defaults, so dropping the block needs zero config.
- **Vio Product Card** — product picker (single) + card options.
- **Vio Product Carousel** — product picker (multi), `Kicker`, `Heading`,
  `Disclaimer` (default `annonselenker`), `Visible at once` (2–5), `Gap`,
  `Show arrows` + card options.
- **Vio Product Grid** — product picker (multi), `Kicker`, `Heading`,
  `Columns` (2–5, collapses to 2 on mobile), `Gap` + card options.
- **Vio · Open Product Info** — product picker. Attach to any element.

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
  vio-helpers.ts          # SDK init, catalog fetch, retry, DOM events (DEBUG flag)
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

**`cq1lXld-TA9` (team Vio) is the ONLY package.** Alan's personal test package
(`czGNimhyDCi`, was `vev-alan.json`) is deprecated: it carried stale copies of the
same 7 components (frozen 2026-07-28, pre-hardening) under identical names, making
it easy to drop an outdated block into a page. Vev limitation: that package lives in
Alan's personal account, so only Alan can unshare it (`"shareWithAccount": false` +
redeploy) — until he does, ignore any duplicate "Vio …" components that are not from
this package. Development happens in `vio-web-sdk/src` + this repo; deploys of the
package are coordinated (no lock on `vev deploy` — last writer wins).
