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
3. Who sees them is controlled by `vev.json`:
   - By default the package is available to the deploying account's projects.
   - Set `"shareWithAccount": true` to expose the components in the Add menu for **all
     members of the account/workspace** after the next deploy.

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
| **Vio · Add to Cart** | Action addon: attach to ANY element (image, button, text); click adds the product (variants open the detail instead). |
| **Vio · Open Product Info** | Action addon: click opens the product detail drawer. |
| **Vio · Open Cart** | Action addon: click opens the cart drawer. |

Card/carousel/grid share one card view — layouts (`standard`, `image-only`, `overlay`,
`horizontal`), button styles, badge/discount options and `editableCSS` styling are
identical everywhere.

4. Pick products in the block panel (modal picker with the sponsor's live catalog),
   style via the Design tab, publish. Checkout works end-to-end on the published page
   (Apple Pay requires the publish domain to be registered in Stripe).

## Development

Prerequisites: Node.js ≥ 22, a Vev account with access to the package, and
`npm install` (deps include `@vev/cli` tooling via npx).

```bash
npm run login        # vev login — one-time CLI auth
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
  action-add-to-cart.tsx  # Vio · Add to Cart (action addon)
  action-open-product.tsx # Vio · Open Product Info (action addon)
  action-open-cart.tsx    # Vio · Open Cart (action addon)
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
