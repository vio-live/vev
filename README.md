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
`content_title` (the article, resolved by the SDK from the page) — and
`component_template_id`, **what the block is**, in the SDK's own vocabulary
(`COMPONENT_TEMPLATE_ID` in vio-helpers.ts): `product-card` for the single card,
`product-carousel` / `product-grid` for a carousel / grid **and the cards it renders**, so
a block's impressions and its clicks count under one type; `product-detail` for the
`view_item` of the `Open product info` addon and interaction (what opens is the SDK's
detail, which calls itself the same). The card's `vio:product-click` carries the
attribution too, so the SDK's product detail inherits it; from the SDK 0.23.x on, the
detail, cart and checkout put it on `vio:added-to-cart`, `vio:removed-from-cart`,
`vio:checkout-open` and `vio:payment-success`, which the blocks forward (0.25.0: the
detail's carry `componentTemplateId: product-detail`; what starts in the cart —
`remove_from_cart`, `view_cart`, the cart drawer's `begin_checkout`, `purchase` — has no
component type). A cart line keeps the `origin` of every unit (campaign, slot, article).
The `Open product info` **interaction** (Vio Config) and the action addon take an optional
`Slot` too: the detail opened from them carries it.

**Page identity.** A published Vev page ships an empty `<title>`, so the SDK had no
`content_title` for it and the detail it mounts registered one `detail-1` for every page
of the surface. Vio Config now declares the page to the SDK (`declareVevPage`, on the
published page only — the editor's canvas is Vev's), from the same Vev store the blocks
name their slots with: `<body data-vio-scope="<page key>" data-vio-scope-name="<page
title>">` — the **scope** the SDK standard shares with Replit (an element's auto slot id
becomes `<page key>-detail-1`, named `Detail 1 · <title>`; the blocks' own `card-<vev key>`
slots are per instance already and ignore it) — and, only while the document has neither a
`<title>` nor an `og:title` of its own (the host's SEO wins), `<meta
name="vio:content-title">` with the page title, which `Vio.content()` reads live (init
option → `?vio_content_title=` → this meta → `og:title` → `document.title`), so
`content_title` says the page on every event without a re-init. A value another host wrote
is never touched: a host that already declares `data-vio-scope` on `<body>` keeps it and
the detail inherits that one. When the scope is Vio Config's own, the detail also gets it
as its `vio-scope` / `vio-scope-name`, so a title the store resolves late still reaches it.

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

**With the 0.25.0 bundle** (2026-10-19):

- Every event the blocks emit — and the SDK detail's `add_to_cart` and `begin_checkout` —
  carries `component_template_id` (see *Attribution* above); it used to be only on
  `component_impression`, as `vev-card` / `vev-carousel` / `vev-grid`. `purchase`,
  `remove_from_cart`, `view_cart` and the cart drawer's `begin_checkout` come from the
  cart and carry none.
- `component_impression` carries `items` — the products the block shows (id, name, brand,
  price) and their currency, the rows the SDK's own carousel puts on its `view_item_list`,
  within the collector's caps (at most 100 rows, no empty id, texts cut at 255 — over them
  it drops the whole event). The collector's **shown products** per slot and its
  per-product impressions read exactly these (`IMPRESSION_EVENTS` = `component_impression`,
  `ad_impression`; `view_item_list` is not one of them), so without them a slot sold
  products it never "showed". The block observes the impression itself with the contract's
  rule (≥50 % visible for ≥1 s, once per page load per dedupe key) because the SDK's
  `observeImpression` takes no items; a carousel / grid empties its list when the sponsor
  changes, so sponsor B is never credited with sponsor A's products.
- `purchase` carries `commerce.buyer_id` when the SDK's `vio:payment-success` says
  `buyerRef` (shopcart's keyed hash of the email — `purchaseFromPaymentSuccess` returns it
  as `buyerId`, never an email). It goes to the Vio collector only — never to GA4's
  `dataLayer` nor to the package's `vio:analytics` document event (the SDK's own
  `vio:analytics` window event carries the full event it sends, hash included). The
  package starts the SDK without `requireConsent`, so the gate is the host's CMP — whether
  the package loads at all — and the collector's `minimal` privacy mode.
- `content_title` and the detail's slot carry the Vev page (see *Page identity* above).

**With the 0.37.0 bundle** (2026-10-29):

- `add_payment_info` when a backend checkout exists (the SDK's `vio:checkout-created`,
  dispatched on `window`), with `commerce.checkout_id` and the method it was created for,
  split per campaign like `begin_checkout`. It is what ties the order Commerce confirms
  (`order_paid`) back to the visit: the dashboard's «Went to Vipps» and «Vipps payments»
  count it. Since 0.35 the cart's Vipps button and the detail's Vipps-with-lines pay the
  sponsor's whole cart by Express without `vio:checkout-open`, so for those this is the
  only trace. `purchase` carries `checkout_id` too. Neither reaches GA4.
- `cta_click` (the dashboard's «Buttons»): the SDK's detail, cart and checkout announce
  their taps with `vio:cta-click`, which goes to `Vio.trackCta` (the SDK sends nothing
  itself with `autoTrack: false`); the card's own buttons send `open`, `add` and `vipps`
  at location `card`, and the open-product action / interaction `open` at `block`.
- The detail runs with `noAddedToast`: Vev opens its cart drawer after an add, and the
  SDK's «Lagt i handlekurven» toast would sit on top of it.
- Cards, carousels and grids read their products on the channel of their block's
  campaign (`Vio.commerceFor(sponsor, { campaignId })`), the one their cart and checkout
  sell on (SDK 0.33).
- A key change no longer clears the carts: each connection keeps its own since 0.33.

**With the 0.37.1 bundle** (2026-10-30):

- Coming back from a cancelled Vipps payment no longer leaves «Henter betalingsmåter…» for good.
  Vev mounts the checkout before its config block calls `Vio.init()`, so the return was read
  before the connection's cart was there; the checkout now reopens on the cart once init lands
  (vio-web-sdk #124).
- The Kustom return reads its order with the returning checkout's key, not the platform one
  (vio-web-sdk #123).

**With the 0.37.2 bundle** (2026-10-30): after a cancelled Vipps payment the delivery form comes
back filled from the checkout it left with, so «Betal … med Vipps» can be pressed again
(vio-web-sdk #126).

**With the 0.37.3 bundle** (2026-10-30): the Kustom, Qliro, Walley and Adyen returns wait for
`Vio.init()` (Vev calls it after mounting the checkout), reopen on the cart and then read the
order — a paid Kustom order no longer comes back to «Vi kunne ikke bekrefte betalingen»
(vio-web-sdk #128).

**With the 0.37.4 bundle** (2026-10-30): a provider's return read (Kustom, Qliro, Walley, Adyen) is
tried again while the commerce API refuses the key — Vev boots in steps and the returning
checkout's channel key is not known for the first seconds (vio-web-sdk #130).

**With the 0.37.5 bundle** (2026-11-02): prices show no decimals or two, never one — 30 % off 499
reads «349,30 Kr», not «349,3 Kr» (vio-web-sdk #132).

**With the 0.37.6 bundle** (2026-11-03): free shipping reads «Gratis» in the checkout — picker, summary
(«Frakt – <rate> · Gratis», no longer «Beregnes ved kasse») and receipt (vio-web-sdk #134).

**With the 0.37.8 bundle** (2026-11-05): the receipt after Vipps lists the order — the «Takk!» after a Vipps
payment showed no lines and no «Frakt» row, because the cart is gone on the way back; it now reads them from the
checkout of the return URL: the lines, «Frakt – … · Gratis» (or the price) and the total (vio-web-sdk #139).

**With the 0.37.7 bundle** (2026-11-03): «Avbryt» on the «Åpner Vipps …» overlay — on an iPhone the Vipps app
can open without the page leaving, and closing the app left the shopper under the overlay with no way out; the
button shows after 4 s or when the page is visible again (vio-web-sdk #137). Also «Avbryt» on the Vipps return
wait (#136).

**With the 0.38.0 and 0.39.0 bundles** (2026-11-10/11, first in Vev with 0.39.1): discount codes. The
campaign's code, set in Vio's dashboard per campaign and brand, goes on the brand's cart by reference (the code never
reaches the page), and only on brands paid with a method that takes discounts. A page without a code behaves as
before. Also: a carousel's impression names its sponsor, and the `purchase` after Vipps says what was paid. See the
vio-web-sdk CHANGELOG for 0.38.0 and 0.39.0.

**With the 0.39.1 bundle** (2026-11-12): Kustom. Reopening the checkout in the same tab, page and cart takes up
the checkout it already has, so Kustom keeps one order instead of one per opening. With the same cart in two tabs, the
tab whose checkout the other replaced stops («Handlekurven ble endret i en annen fane…») instead of writing its page
into the other tab's order, which sent the shopper back to the wrong page (vio-web-sdk #150; needs
vio-shopcart-microservice #120).

**With the 0.39.2 bundle** (2026-11-12): a product added while the Kustom widget is open reaches the order (the
update waits for the cart change on its way to Commerce, vio-web-sdk #152), and the gift of a discount code shows its
picture in the cart (Commerce sends a line's image as a list, #153).

The vendored SDK is **0.39.2**, built from `vio-web-sdk` `main` `e4983c1` (the 0.39.2 release
commit; on npm once it is published from there). The blocks still check for the API they call — a block must never
throw into the editor — so with an older bundle they behave as before.

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
cd ../vio-web-sdk && git checkout main && git pull --ff-only && npm ci && npm run typecheck
# esbuild comes with the SDK's devDependencies (0.25.12): run `npm ci` first, or npx pulls the latest
node_modules/.bin/esbuild src/_vev-entry.ts --bundle --format=esm --external:react --external:react-dom \
  --tsconfig=tsconfig.json --outfile=../vev/vio-sdk/index.js
grep -n 'var SDK_VERSION' ../vev/vio-sdk/index.js   # the version you meant
```

One warning (`ignored-bare-import` for `src/ui/tokens.ts`) is expected: the design tokens
are still injected.

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
                          # slots: useVioSlot / sponsorForSlot / vioAttribution,
                          # page identity: useVevPage / declareVevPage
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
