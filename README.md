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

**With the 0.39.3 bundle** (2026-11-12): a coupon the brand changed in its shop after it was applied is said on the
cart («Rabatten er endret av butikken. Handlekurven er oppdatert – prøv igjen.») instead of the cart opening the
checkout in silence (vio-web-sdk #155).

**With the 0.39.4 bundle** (2026-11-13): the cart's gift is not added again from the product page — «Legg i
handlekurv» is off while the product is the gift, with «Produktet er allerede med som gave. Maks én gave per
bestilling.» (vio-web-sdk #158) — and a refused payment with a discount code no longer suggests another way to pay
(#157).

**With the 0.40.1 bundle** (2026-11-17): on the page of the cart's gift, «Kjøp nå med Vipps» says what it pays —
the cart as it is — instead of counting the gift again («3 varer · 2 625 Kr» for a cart of 2 and 1 260 kr), and a
«Kjøp nå» from there adds nothing (vio-web-sdk #162). It also carries 0.40.0: the reel's video analytics
(ADR-0043), which Vev does not use — no block renders `<vio-reel>`, so no video events leave a Vev page.

The vendored SDK is **0.40.1**, built from `vio-web-sdk` `main` `6c8fa29` (the 0.40.1 release
commit; on npm once it is published from there). The blocks still check for the API they call — a block must never
throw into the editor — so with an older bundle they behave as before.

## Kondomeriet blocks (Vipps Hurtigkasse)

A Kondomeriet-only variant of the blocks, for the Black Week article Kondomeriet writes for VG. Products come
from Vio Commerce (Kondomeriet's brand account, synced from their Google Merchant feed); **payment is always
Kondomeriet's own Vipps Hurtigkasse on kondomeriet.no — never Vio's cart or checkout.** Nothing in these blocks
touches `Vio.cart` or `Vio.checkout`.

| Block | What it does |
|---|---|
| **Kondomeriet Config (SDK)** | Once per page, instead of Vio Config. Same connection (API key, sponsor, campaign, environment), page identity, slots, theme and analytics, but no Vio cart, checkout, SDK detail or cart button — it mounts only the Kondomeriet detail drawer. It *is* `VioConfig` with an internal `overlaysOverride` prop (not in the panel), so the connection flow is not copied. |
| **Kondomeriet Product Card** | One card for a product **group**. |
| **Kondomeriet Product Carousel** / **Grid** | One card per group; same layout options as the Vio carousel / grid. |

**Same look as the Vio blocks.** The card is the Vio Product Card: the same `.vio-native-card` markup, styles,
layouts (standard, image only, info over image, horizontal), accent colour, badge, «Annonse», price and editable CSS
(all of the Vio card's entries, plus *Option pill*, *Option label* and *Old price*). Its Vipps button is the Vio card's
(Vipps' own `<vipps-mobilepay-button>` when it loads, the orange bar otherwise); the product-info button is the Vio
card's full-width bar or pill. Only three things are Kondomeriet's own: the option selector (drawn with the values of
the SDK detail's option pills), «Kjøp med Vipps» instead of adding to a cart, and the Hurtigkasse note.

**Several products at once (carousel / grid).** *+ Add products* (next to *+ Add card*) opens the catalog picker
(«Select products»); on Done it adds one card per **family**, in the order picked, at the end of the list — existing
cards are left alone and products already in a card are skipped. A family is one product in several colours, sizes
or models: the same row of the Black Week sheet (same ref1), or the same brand with titles that start with at least
two words in common («Blowcast Wingman …», «TENGA Spinner …»; one word — «EasyToys», «Womanizer» — is a brand, not a
product). A card's own *Products* picker («Select colors, sizes or models of one product») splits on Done when the
pick holds several families: the first stays on that card with its Details, the others become new cards right after
it, and the panel says how many. On the single *Kondomeriet Product Card* a mixed pick is kept as options of one card,
with a note pointing to the grid / carousel. With several models of a sheet's rows on one card (Wingman pro / plus /
lite), Circlewise's ref1 follows the option bought.

**Groups.** The feed creates one Vio product per colour / model / size, so a card unifies several products behind
a selector (pills, photo thumbnails or a dropdown); each option is its own Vio product with its own photo, price,
stock and shop URL. A single product is a group of one. In the panel: *Products* opens the Vio catalog picker for
the group, *Details* sets the option order, label overrides, Hurtigkasse slug overrides, the card title and the
discount badge (the carousel / grid add, reorder and remove cards). Stored as JSON in a string field
(`{ data: "[{ ids, labels?, slugs?, title?, discount?, discountStart?, discountEnd? }]" }`).

- **Labels** come from the titles: the words every title starts with are the card title, the rest of each is its
  label (`Womanizer Premium 2 blåbær` → title `Womanizer Premium 2`, label `blåbær`). Shared trailing words go too,
  unless they start with a unit (`Easyglide vannbasert 150 ml` → `150 ml`). Empty or repeated labels fall back to
  the full title. An override in *Details* wins.
- **Stock**: quantity 0 is sold out (the feed sweep sets it) — the option is struck through and disabled, like a
  sold-out size in the SDK detail, and the button says «Utsolgt». The card starts on the first option in stock.
- **Price**: the selected option's price incl. taxes, written as the Vio card writes it (`1199 NOK`) and, in the
  drawer, as the SDK detail does (`1 199 Kr`). A real sale from the feed (`compare_at` above the price) adds the old
  price struck through (the SDK detail's `.compare-at`) and a `-60 %` badge — the Vio card's «Auto (from sale
  price)» — on the card and in the drawer.
- **Discount badge**: per card, manual text (e.g. `−60 %`) with optional start / end (`datetime-local`, read in
  the reader's time zone — Norway for VG readers), shown in the Vio badge's place on the card and on the drawer's
  photo while its dates say so; it wins over the sale %. It never changes the price: the Hurtigkasse charges the
  shop's.
- **Picker**: the Kondomeriet blocks' catalog picker reads the catalog fresh each time it opens (`useCache: false`,
  `loadFreshCatalog`): the shared `loadCatalog` of the Vio pickers answered with a list the gateway had cached, so a
  product added to the collection that day did not show. The Vio blocks' pickers are unchanged.

**«Kjøp med Vipps» → Hurtigkasse.** kondomeriet.no's product page buys through a POST form
(`<form id=purchaseform method=post action=https://www.kondomeriet.no/k/<slug>/kjop/>` with `qty-<slug>=1` and the
Vipps submit button `cbtn=vps`). The block builds that same form, hidden, for the **selected option** and submits it
synchronously inside the click (a link cannot: it is a POST). `form.submit()` does not send a submit button's
name, so `cbtn=vps` goes as a hidden field. `<slug>` is the second path segment of the product's shop URL — Vio's
`origin_url` (`/klitorisvibrator/we-vibe-melt-2-purple/til-henne/` → `we-vibe-melt-2-purple`), read with the
SDK's product query plus `origin_url` (graphql, on master since 2026-09), or the slug override. An option without
one cannot be bought directly: the button is off and the editor shows a note.
Target: **new tab** by default (`_blank`, `rel=noopener`) — the article stays open, it works from inside an iframe
that allows popups, and the Vipps app handoff happens in the shop's own tab; *Same window* (`_top`) is a card
option for pages that prefer it (it needs a frame that allows top navigation). In the editor nothing is posted.

**«Se produktinfo»** (and the image) opens the Kondomeriet detail drawer, drawn with the SDK detail's own
stylesheet: it lives in a shadow root that carries the styles of `<vio-product-detail>` and uses its classes (top
bar, gallery and thumbnails, brand, name, price / compare-at, option pills, Vipps button, seller note, «Beskrivelse»
with «Les mer»), so it follows the same theme tokens and `--vio-detail-*` variables — bottom sheet on phones, side
panel on wider screens. In place of the quantity, «Legg i handlekurv» and the other ways to pay: «Kjøp med Vipps»
for the chosen option and «Du betaler med Vipps Hurtigkasse hos Kondomeriet.». What the drawer adds to make it a complete shop page:

- **«Kjøp direkte fra artikkelen»** badge by the brand (card prop *Product info badge*; empty = off; *Badge on the
  card too* puts it above the card's brand).
- **The full description, formatted.** Vio's clean HTML (`<!-- vio:keep-description -->` + `h3`, `h4`, `p`, `ul`,
  `ol`, `li`, `strong`, `em`, `br`, written from the product page on kondomeriet.no) is parsed with `DOMParser`,
  reduced to that whitelist with no attributes (links become their text; scripts, styles, media and comments go)
  and rebuilt as React elements — never `innerHTML`. A first paragraph that starts with ★ (the shop's rating) shows
  under the title. The text before the first `h3` is «Beskrivelse» (preview + «Les mer»); each `h3` is a fold of its
  own (Produktinformasjon, Spesifikasjoner, Inkludert i esken), the first open, in the SDK's fold style. The feed's
  broken text («h2…/h2p…», no `< >`) is still shown as plain text (`kondomeriet-description.tsx`).
- **Stock and the shop's promises**, ticked under the Vipps button: «På lager — Leveres innen 1-3 virkedager»
  (*In-stock line*) or «Utsolgt», then *Shop promises* (one per line; default «Anonym levering», «Miljørabatt»,
  «Orgasmegaranti», «Frakt fra kun 59,-»; empty = none).

**Fits any width.** The carousel and grid measure their own block (not the window: Vev sizes a frame per
breakpoint) and drop columns / cards per view so a card is never narrower than 130 px (grid) or 150 px (carousel);
under 480 px the gap tightens to 12 px and, under 640 px, the carousel shows the edge of the next card. A 375 px phone
gets two columns, 320 px one carousel card plus a peek. Inside the card the Vio card's container queries keep the
Vipps button (compact «Kjøp nå»), the option pills and the bars on one line.

**More of the Vio card's choices, and the editor's own.** Besides layout, accent, brand / name / price / retailer /
description / «Annonse»: *Discount badge* (Off · Auto — the card's badge in its dates, else the sale % · Manual),
*Vipps Hurtigkasse button* (bar / off), *Image click* (product info / Kjøp med Vipps), the product-info button as
bar, pill or icon, and three own texts — *Subtitle* (under the name), *Label on the photo*, *Footer* — all with
editable CSS. **Card image** (Vev image): replaces the product's photo on the card and goes first in the product
info (or alone, *Product info: only this image*); the carousel / grid take *Card images*, one per card number.

**Trust on the card.** Under the name, «★ 5/5 (792)» from the rating line of the description (*Show rating*); under
the CTA a short line of promises (*Show promises line*, *Promises line*: empty = the brand's promises from Vio when
their titles are short, else «Diskret pakket · Anonym levering · Frakt fra 59,-»); under the Vipps button «Du blir
værende i artikkelen» when the Hurtigkasse opens in a new tab (*Under Vipps (new tab)* / *(same window)*, empty =
none; the product info adds it to its Hurtigkasse note); and «Tilbudet gjelder til mandag 30. november» while an
*Offer ends* date (block, or a card's own in *Details*) is ahead.

**Circlewise (TargetCircle) tracking — always on.** Every «Kjøp med Vipps» of every Kondomeriet block goes through
Circlewise's tracker to Vio's bridge and the Hurtigkasse, with nothing for the editor to do (Angelo: «always our mode,
but theirs registered»); the reader sees the same opening mode and the same bridge. The Kondomeriet Config's advanced
fields hold `a` (`h9k6zq`) and `i` (`3j26pb`) and a switch to turn it off (then: the direct POST).
- **ref1:** a link pasted on the card (*Details*) or the block (*Tracking link (Circlewise)*) is an optional override —
  its `a`, `i` and `ref1` are used. Otherwise the sheet's ref1 by the products' shop slugs (`BLACK_WEEK_REF1` in
  `kondomeriet-helpers.ts`: blowcastpro, wingmanplus, blowcastlite, julekalender, womanizersnap, pleasure,
  womanizerpremium, corrida, tenga, womanizerduo, analplugg, easyglide, kondomer, undertoy, alexneo, easytoys,
  easytoys_slikk, wevibemelt, petal — colours, sizes and models take their group's), else
  `blackweek_<the group's common slug, or the product's>`. An invalid pasted link is said in the editor and the
  default is used.
- **ref2** = the SDK's analytics `session_id`, **ref3** = the campaign id, so Circlewise's postback can bring both back.
  The tracker accepts them (200, then its usual redirect to the bridge with `tmt_data` / `tmt_ufp` /
  `tmt_offer_sid`); like ref1, they are not echoed in that redirect — they live with the click on their side, so
  whether the postback returns them is to be confirmed with Circlewise.
- **Warm-up:** `preconnect` + `dns-prefetch` to `https://c.trackmytarget.com` when the Config has Circlewise on, and
  again on the first `pointerdown` / `touchstart` on «Kjøp med Vipps». Measured click → bridge: no difference here
  (see the PR) — browsers partition connections by top-level site, and the tracker opens as a top-level navigation.
- The click carries `tracking: circlewise | direct` (`select_item`) and `_circlewise` on the `cta_click` variant.

**In-app browsers.** In the browser of an app — Facebook / Messenger, Instagram, VG, Dagbladet, Snapchat, LinkedIn,
TikTok, an Android WebView or an iOS web view (`inAppBrowser()` in `kondomeriet-perf.ts`, by user agent) — the
Hurtigkasse opens in the same window whatever the block says (a form posted to a new tab fails or opens badly there),
with the same-window note. The product list, the product click and «Kjøp med Vipps» carry the mark
(`in_app_browser` on `view_item_list` / `select_item`, `variant: hurtigkasse_inapp_<app>` on `cta_click`).

**Loading (measured with the real collection, Fast 3G + 4× CPU — see the PR).**
- *Snapshot:* when products are picked, the panel stores a small snapshot of each (title, brand, price, compare-at,
  main image, shop URL, stock, rating line — ~12 KB for 31 products) in the block's props, and refreshes it when it
  is a day old. The published card paints from it at once, before any request, and the API refreshes price and stock
  in the background in the same card; the product info swaps in the full product (description, photos).
- *One round trip instead of two (fast start):* the Kondomeriet Config's panel stores, in its `fastStart` prop, the
  GraphQL endpoint and the channel key of the page's sponsor for its campaign (resolved in the editor; the channel's
  public commerce key, the one the bootstrap hands every reader). On the published page the products request leaves
  straight to that channel IN PARALLEL with the bootstrap; once the bootstrap is there, its own key and endpoint serve
  every later request (and a failed fast request just waits for it).
- *One request, minimal payload:* every Kondomeriet block's ids in one batched request per channel (blocks register
  their ids as they render; the Config asks as soon as it can), with only what a card paints — no description, no
  image sizes (`KONDOMERIET_CARD_QUERY`); the product info and the editor ask for the full product.
- *GET for the CDN (off):* `directGraphQL` can send the query as a GET with the key in the query string
  (`?query=&variables=&apiKey=`) for when the gateway accepts it — behind `globalThis.__VIO_KND_GQL_GET__ = true`,
  off by default, falling back to the POST on any failure.
- *No unstyled first paint:* the card and list styles are injected while rendering, not in an effect (a card painted
  before its CSS jumped: CLS 0.42 measured).
- *Browser cache:* products read in the last 5 minutes paint from `localStorage` (stale-while-revalidate), as does
  the brand's identity (logo, name, promises) before the bootstrap; every access in try/catch.
- `preconnect` / `dns-prefetch` to api.vio.live, graph-ql.vio.live and container.vio.live when the package loads.
- *Images:* the CDN's `<name>large.jpg` directly — the `?size=large` URL Commerce returns redirects twice
  (container → api-ecom → container) — with the redirecting URL as fallback; `width`/`height` on a square box (no
  layout shift); the first four cards eager with `fetchpriority=high`, the rest lazy.

**Buy on card (conversion default).** *Buy on card* — Auto (default) / Always / Never, per block and per card
(group *Details*, «As the block» by default). **Auto:** a card of one product buys in place («Kjøp med Vipps» +
«Se produktinfo»); a card with options (colours, sizes, models) has no selector and no Vipps — its main CTA is «Se mer»
(*«Se mer» label*), the Vio card's bar in the Vipps button's place, which opens the product info to choose and buy;
its price is the default option's, or «Fra <lowest>» when the options cost differently. **Always** is the earlier
card (selector + Vipps); **Never** leaves only «Se mer». It replaces the old *Vipps Hurtigkasse button*: blocks placed
before stay in Auto, except one placed with that button off, which reads as Never. «Se mer» reports `select_item` +
`view_item` + `cta_click see_more` (the product-info button and the image keep `open`), so a card that buys in place
can be compared with one that sends to the product info.

**The seller, as in Replit.** The card shows, where the Vio card puts its retailer, the brand's logo (20 px high,
its own width) and «Du handler direkte hos **Kondomeriet**» — the SDK detail's seller note — from
`Vio.sponsorIdentity` (name and logo of the bootstrap's sponsor); *Show seller* turns it off, *Seller line* /
*Seller logo* style it, and without a logo only the text shows. The product info's note under the button is the
SDK's `renderSellerNote`, with the logo beside it and the brand's «Kjøpsvilkår» / «Angrerett og retur» when it
gave them; the Hurtigkasse note stays above it.

**The brand's promises.** When the brand has promises in Vio (dashboard → brand profile, `highlights` on the
bootstrap's sponsor, read with `Vio.sponsorIdentity`), the drawer draws them as the SDK detail does (the
`.highlights` strip, the SDK's icons) and the editable promises step aside; without them the editable list stays.
The drawer also shows the brand's logo in the top bar and the SDK's «Frakt & retur» fold — the product's rates
(`getShippingRates`, with each rate's logo), the delivery time, the return right and the brand's terms links.

It listens to its own `kondomeriet:open-detail` event, never `vio:product-click`, so a Vio Config
on the same page never opens its detail or cart for these cards. Mounted once per page by the Config or by the
first card (whichever mounts first).

**Analytics** (same module and attribution as the Vio blocks): `view_item_list` on load and `component_impression`
per block with every product it offers; the info button / image sends `select_item` + `view_item` + `cta_click
open`; an option sends `cta_click size` with the label; «Kjøp med Vipps» sends `select_item` (list «Vipps
Hurtigkasse») and `cta_click vipps_hurtigkasse` (location `card` or `detail`). No `add_to_cart`, `begin_checkout`
or `purchase`: the payment leaves Vio.

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
  kondomeriet-*.tsx/.ts   # Kondomeriet blocks (see above): config, card, carousel, grid
                          # (registered); helpers (groups, labels, Hurtigkasse,
                          # fetch with origin_url), detail drawer, group editor,
                          # shared UI, props, analytics
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
