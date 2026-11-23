# Kondomeriet-blokker for Vev

Vev-komponentpakke med blokkene for Kondomeriet × VG (Black Week 2026). Med blokkene
kan leseren kjøpe produktene rett fra artikkelen med Vipps Hurtigkasse.

| Blokk | Hva den gjør |
|---|---|
| **Kondomeriet Config** | Må ligge **én gang** per side. Kobler siden til Vio med API-nøkkelen. |
| **Kondomeriet Product Card** | Ett produktkort. |
| **Kondomeriet Product Carousel** | En rad med produktkort som kan blas sidelengs. |
| **Kondomeriet Product Grid** | Et rutenett med produktkort. |

Denne siden er for **den som installerer pakken** (utvikler). Hvordan redaktørene bruker
blokkene i editoren står i veiledningen (PDF) som ligger i hver release.

## Før du begynner

- En datamaskin med Mac, Windows eller Linux, og en terminal (Mac: *Terminal*; Windows:
  *PowerShell*).
- **Node.js 20 eller nyere.** Sjekk med `node -v`. Mangler det, last ned «LTS» fra
  <https://nodejs.org> og installer.
- En bruker i **Vev-kontoen der artikkelen skal lages**, med rett til å legge til kode
  (komponentpakker). Er du med i flere Vev-kontoer, må du vite hvilken det er.
- **API-nøkkelen** fra Vio. Den trengs ikke for å installere, bare når blokkene settes
  opp i artikkelen. Den sendes separat, aldri i denne pakken.

Installasjonen tar rundt 10 minutter.

## Installere (første gang)

**1. Last ned pakken.** Gå til <https://github.com/vio-live/vev/releases>, velg den
nyeste releasen som heter **Kondomeriet v…**, og last ned `kondomeriet-vev-vX.Y.Z.zip`
under *Assets*. Pakk ut zip-filen, for eksempel i `Dokumenter`. Du får en mappe som heter
`kondomeriet-vev`.

**2. Installer Vev CLI** (én gang per maskin):

```bash
npm install -g @vev/cli
```

På Mac kan det hende du må skrive `sudo npm install -g @vev/cli` og taste inn passordet til
maskinen. Sjekk at det virker med `vev --version`.

**3. Logg inn i Vev:**

```bash
vev login
```

Nettleseren åpner Vev. Logg inn med brukeren i kontoen der artikkelen skal lages, og godkjenn
tilgangen. Gå tilbake til terminalen når den sier at du er logget inn.

**4. Gå inn i mappen** du pakket ut:

```bash
cd ~/Documents/kondomeriet-vev
```

(Windows: `cd $HOME\Documents\kondomeriet-vev`. Eller skriv `cd ` og dra mappen inn i terminalen.)

**5. Opprett pakken i kontoen deres** (bare første gang):

```bash
vev init
```

Er du med i flere Vev-kontoer, spør den hvilken pakken skal tilhøre: velg kontoen der
artikkelen lages. Kommandoen skriver en ny pakkenøkkel i `vev.json`.
**Ta vare på `vev.json`**: den trengs ved hver oppdatering.

**6. Publiser pakken:**

```bash
vev deploy
```

Det tar under ett minutt. Til slutt skal den si at pakken er publisert.

**7. Sjekk i editoren.** Åpne et prosjekt i Vev, trykk **Legg til** (tasten `A`) og søk
etter «Kondomeriet». De fire blokkene skal dukke opp. Alle i kontoen ser dem
(`shareWithAccount: true` i `vev.json`). Si fra til Vio at pakken er installert.

## Oppdatere (ny release)

Vio sier fra når det kommer en ny versjon. Hva som er endret står i notatene til releasen.

1. Last ned og pakk ut den nye zip-filen.
2. Kopier `vev.json` fra den forrige `kondomeriet-vev`-mappen inn i den nye, og erstatt den
   som ligger der (samme nøkkel = samme pakke).
   Kjør **ikke** `vev init` på nytt: da lages en ny pakke, og blokkene dukker opp to ganger.
3. Gå inn i den nye mappen og kjør `vev deploy` (er du logget ut, kjør `vev login` først).
4. **Publiser artikkelen på nytt** i Vev. En publisert side låser versjonen av blokkene den
   ble publisert med, så endringene vises ikke før siden publiseres igjen.

## Hvis noe går galt

| Feilmelding / problem | Løsning |
|---|---|
| `command not found: vev` / `npm` | Node.js er ikke installert, eller terminalen må startes på nytt etter installasjonen. |
| `EACCES` / permission denied ved `npm install -g` | Mac/Linux: bruk `sudo npm install -g @vev/cli`. |
| `vev.json is missing key` | Du har ikke kjørt `vev init` i denne mappen (første gang), eller du har glemt å kopiere `vev.json` fra forrige versjon (oppdatering). |
| Blokkene vises ikke i editoren | Sjekk at `vev deploy` ble ferdig uten feil, og at du er logget inn i samme Vev-konto som pakken ble opprettet i. Last editoren på nytt. |
| Blokkene vises to ganger | Det er laget to pakker (`vev init` kjørt flere ganger). Kontakt Vio, så rydder vi. |

---

*English:* this is the Vev component package for the Kondomeriet × VG campaign. Install Node.js 20+
and download the zip from the latest `kondomeriet-v*` release. Then run, in the unzipped folder:
`npm i -g @vev/cli`, `vev login`, `vev init` (once, pick the account where the article lives) and
`vev deploy`. Keep the generated `vev.json` for updates. After each update, republish the article.
The Vio API key is provided separately.
