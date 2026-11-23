# Kondomeriet-blokker for Vev

Vev-komponentpakke med blokkene for Kondomeriet × VG (Black Week 2026). Med blokkene
kan leseren kjøpe produktene rett fra artikkelen med Vipps Hurtigkasse.

| Blokk | Hva den gjør |
|---|---|
| **Kondomeriet Config** | Må ligge **én gang** per side. Kobler siden til Vio med API-nøkkelen. |
| **Kondomeriet Product Card** | Ett produktkort. |
| **Kondomeriet Product Carousel** | En rad med produktkort som kan blas sidelengs. |
| **Kondomeriet Product Grid** | Et rutenett med produktkort. |

Slik bruker du blokkene i editoren: se veiledningen (PDF) som ligger i hver release.

## Installere (første gang)

Det trengs Node.js 20 eller nyere og en bruker i Vev-kontoen der artikkelen lages.

1. Last ned `kondomeriet-vev-vX.Y.Z.zip` fra den nyeste releasen
   (<https://github.com/vio-live/vev/releases>, de som begynner med `kondomeriet-`) og pakk den ut.
2. Installer Vev CLI: `npm install -g @vev/cli`
3. Logg inn med Vev-kontoen deres: `vev login`
4. Gå inn i den utpakkede mappen og kjør `vev init`. Det lager en ny pakke i kontoen
   deres og skriver pakkenøkkelen i `vev.json`. **Ta vare på `vev.json`**: den trengs ved
   hver oppdatering.
5. Publiser pakken: `vev deploy`
6. I Vev-editoren: **Legg til** (tasten `A`) → søk etter «Kondomeriet». Blokkene er
   tilgjengelige for alle i kontoen (`shareWithAccount: true`).

API-nøkkelen som limes inn i **Kondomeriet Config** får dere fra Vio, separat.

## Oppdatere (ny release)

1. Last ned og pakk ut den nye zip-filen.
2. Kopier `vev.json` fra den forrige mappen inn i den nye (samme nøkkel = samme pakke).
   Kjør **ikke** `vev init` på nytt: da lages en ny pakke, og blokkene dukker opp to ganger.
3. `vev deploy`
4. **Publiser artikkelen på nytt.** En publisert side låser versjonen av blokkene den ble
   publisert med.

Hva som er endret står i notatene til hver release.

---

*English:* Vev component package for the Kondomeriet × VG campaign. Download the zip from
the latest `kondomeriet-v*` release, `npm i -g @vev/cli`, `vev login`, `vev init` (once;
keep the generated `vev.json` for updates), `vev deploy`. After each update, republish
the article. The Vio API key is provided separately.
