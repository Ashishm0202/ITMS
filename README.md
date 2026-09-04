# FACOR ITMS

Mobile app for **coal transit challan** creation at FACOR plants. A transporter signs in, captures a
truck's transit-pass details — by scanning the weighbridge QR/barcode, by typing them in, or by
amending an existing challan — attaches the four mandatory documents as photos, and posts the whole
thing to the ITMS backend, which returns a gatepass number.

Built with Expo (SDK 54) + Expo Router, React Native 0.81, TypeScript, targeting Android and iOS.

---

## Requirements

- Node 20+ and npm
- A **development build** (not Expo Go) — the app uses `expo-camera` and native config plugins
- Xcode 16+ for iOS, Android Studio / JDK 17 for Android
- Network access to the ITMS API

## Setup

```bash
npm install
```

Create/update `.env` in the project root with the API base URL:

```bash
EXPO_PUBLIC_API_URL=https://<itms-api-host>/api
```

The variable is read at build time as `process.env.EXPO_PUBLIC_API_URL` (see
[services/api.ts](services/api.ts)), so **restart Metro after changing it**. Because the
`EXPO_PUBLIC_` prefix inlines the value into the bundle, treat it as public.

Then run a native build on a device or simulator:

```bash
npm run android   # expo run:android
npm run ios       # expo run:ios
npm start         # dev server only, for an already-installed dev build
```

`ios/` and `android/` are generated (and git-ignored) — `expo run:*` runs `expo prebuild` for you.
Delete them and re-run if native config in [app.json](app.json) changes.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Start the Metro dev server |
| `npm run android` / `npm run ios` | Prebuild + build + launch a dev client |
| `npm run web` | Start for web (untested path — camera scanning won't work) |
| `npm run lint` | `expo lint` (ESLint flat config, `eslint-config-expo`) |

`npm run reset-project` is left over from the Expo template and will fail — `scripts/reset-project.js`
is not in this repo.

## Builds

[eas.json](eas.json) defines `development` (dev client, internal), `preview` (internal
distribution), and `production` (remote auto-incremented version) profiles.

```bash
eas build --profile preview --platform android
```

Bundle id / package: `com.aondigicon.FACORITMS`. `release-key.keystore` in the repo root is the
Android release signing key.

---

## How the app works

### Navigation

File-based routing via `expo-router`, all screens headerless, wrapped in
`ToastProvider → AuthProvider → CoalChallanProvider` ([app/_layout.tsx](app/_layout.tsx)).

| Route | Screen | Purpose |
| --- | --- | --- |
| [`/`](app/index.tsx) | Index | Splash gate — redirects to `/login` or `/challan-creation` |
| [`/login`](app/login.tsx) | Login | Email + password sign-in |
| [`/challan-creation`](app/challan-creation.tsx) | Home | Picks one of the three creation modes; logout |
| [`/scanner`](app/scanner.tsx) | Scanner | Camera view that reads the transit-pass QR/barcode |
| [`/coal-challan`](app/coal-challan.tsx) | Create | The challan form — used by both Scan and Manual |
| [`/Preview_challan`](app/Preview_challan.tsx) | Change | Loads an existing challan for a vehicle and modifies it |

### The three creation modes

1. **Scan QR** — `/scanner` reads a pipe-delimited weighbridge payload, `parseScanData`
   ([lib/qrParser.ts](lib/qrParser.ts)) pulls out TP no, validity, vehicle, gross/tare/net weight,
   coal grade, mines code and DO no, and `/coal-challan` opens pre-filled.
2. **Manual** — `/coal-challan` opens blank; entering a vehicle number and DO no triggers the same
   master-data lookup (debounced 600 ms) that the scan path uses.
3. **Change** — `/Preview_challan` lists the transporter's changeable vehicles, loads that vehicle's
   existing challan row plus master data, and posts through the modify endpoint, carrying the
   existing `gatepassno` forward.

### Form sections

Both the create and change screens share the same layout: **Vehicle Number → DO-PO → Trip Details →
Vehicle Details → Driver Details → Photos**. Vehicle, driver and DO-PO fields lock once master data
fills them; the DO-PO section auto-selects when the lookup returns exactly one PO line.

### Photos

Four photos are mandatory: Transit Pass, MCL Weighment-cum-Challan, Transporter Delivery Challan,
E-Way Bill — mapped in order to the payload's `imG_1`…`imG_4`.

Each pick uploads immediately ([lib/imageUpload.ts](lib/imageUpload.ts)):

1. `buildFolderName()` produces a bucket path `QRChallan/<key><yyyymmdd><mm><ss>.png`, guarded by
   `validateFolderName()`.
2. `POST /LocalBucket` with the raw base64 in `bytes`; the response's `data` is the stored path.
3. `GET /LocalBucket/ShortenUrl` is called as a readability check only — its URL is logged, not
   submitted.

**The stored path, not the base64 or the resolved URL, is what `imG_1..4` carry.** Submit is blocked
while an upload is in flight or if any photo has no path.

### Authentication

`GET /ITMSUsers/{email}` returns the user record including an encrypted password;
[lib/cryptoUtils.ts](lib/cryptoUtils.ts) decrypts it (PBKDF2-SHA1 + AES-CBC over UTF-16LE, matching
the backend's .NET `Rfc2898DeriveBytes` scheme) and compares it to what was typed. On success the
user object is persisted to AsyncStorage under `itms_auth_user` and mirrored into
[lib/authStore.ts](lib/authStore.ts) so non-React code (`services/api.ts`) can read it.

The user's `ORGANIZATION` field is the **transporter code** that keys every transporter-scoped
lookup, and is sent as `transporter` / `tranS_CODE` on submit. It's read case-insensitively via
`getFieldCI` because the API has returned both `ORGANIZATION` and `organization`.

---

## Backend API

All calls go through [services/api.ts](services/api.ts), relative to `EXPO_PUBLIC_API_URL`.

| Endpoint | Used for |
| --- | --- |
| `GET /ITMSUsers/{email}` | Login lookup |
| `POST /IO_CoalChallan/GETCOALDETAILS` | Vehicle + driver + DO-PO master data by vehicle no and/or DO-PO |
| `GET /IO_CoalChallan/GETVEHICLE/{vehicleNo}` | Vehicle + driver + existing challan for one vehicle (returns an empty `dopo` block) |
| `GET /IO_CoalChallan/GETVEHICLECHNG/{transCode}` | Vehicles this transporter may raise a change challan for |
| `GET /IO_CoalChallan/GETDOPO/{transCode}` | Every DO-PO open against the transporter — backs the DO/PO dropdowns |
| `POST /IO_CoalChallan/POSTDETAILCOAL` | Create a challan |
| `POST /IO_CoalChallan/MODIFYCOALDETAILS` | Modify an existing challan |
| `POST /LocalBucket` | Upload a photo |
| `GET /LocalBucket/ShortenUrl?originalUrl=…` | Resolve a stored path to a viewable URL |

### Response handling

The API's shapes are inconsistent, and `services/api.ts` exists mostly to normalise them. Worth
knowing before you touch it:

- Envelope keys arrive as either `success`/`Success`, `data`/`Data`, `message`/`Message`.
- On a miss or a server error the body can be a **bare JSON-quoted string** (`"error-: no data
  found"`) instead of the envelope — and sometimes that string sits inside the envelope's `data`.
  Every response is therefore read with `res.text()` first, never `res.json()`.
- The top-level `success` flag is **not trustworthy** — it has been seen `true` alongside
  `"statusCode": 400`. Success is decided from the embedded `statusCode`, then from the message's
  own `success`/`error` prefix, and only then from the HTTP status.
- `message` is sometimes just the .NET return type name (`"System.String"`) with the real text in
  `data`, so `data` wins when it's a non-empty string.
- List endpoints may return a single object instead of an array; `parseListEnvelope` always hands
  back an array.
- The `return` block of the details endpoints is an array of messages (one per sub-lookup) — a
  `success` line *anywhere* in it means the payload is usable.

Field casing in [types/models.ts](types/models.ts) (`vclreG_NO`, `fiT_EXP_DATE`, `mineS_CODE`, …)
mirrors the backend JSON exactly. It looks wrong; it isn't. Don't "fix" it.

### Dates

Dates go to the API as `yyyyMMdd`, with `"00000000"` as the backend's own "not set" placeholder
(`formatDateForApi`). QR timestamps arrive in either `M/d/yyyy h:mm:ss tt` or `dd-MM-yyyy HH:mm:ss`
and are parsed by `parseScanDateTime`. See [lib/date.ts](lib/date.ts).

---

## Project layout

```
app/              Screens (expo-router file-based routes)
components/ui/    Presentational primitives — Card, LabeledInput, SelectField (searchable),
                  DateField, TimeField, ImageUploadField, PrimaryButton, ResultDialog,
                  LoadingOverlay, SectionHeader, ActionCard, FeatureTile
context/          AuthContext (session), CoalChallanContext (scan + master data), ToastContext
lib/              qrParser, cryptoUtils, date, imageUpload, submitMessage, validation,
                  authStore, object
services/api.ts   Every network call and all response normalisation
types/models.ts   API request/response types — casing mirrors the backend
```

`@/*` resolves to the project root ([tsconfig.json](tsconfig.json)), TypeScript runs `strict`, and
`typedRoutes` + `reactCompiler` are enabled in [app.json](app.json).

## Permissions

Android declares `CAMERA` and `RECORD_AUDIO`; the camera prompt copy lives in the `expo-camera`
plugin config in [app.json](app.json). The scanner screen requests permission at runtime and shows a
"Grant Permission" fallback if it's denied.

The barcode scanner accepts `qr`, `code128`, `code39`, `datamatrix`, `pdf417` and `ean13`, ignores
payloads with 5 or fewer pipe-separated fields, and locks between reads so one scan can't fire twice.

---

## Known issues / gotchas

- **Field validation is disabled on the create screen.** In `onSubmit` in
  [app/coal-challan.tsx](app/coal-challan.tsx) every check except the photo checks is commented out.
  Restoring them needs `formatYyyyMmDd` from `@/lib/date` and
  `isExpired`/`isValidMobileNo`/`isValidAadharNo` from `@/lib/validation` re-imported. The change
  screen ([app/Preview_challan.tsx](app/Preview_challan.tsx)) validates fully.
- **Duplicated upload helpers.** [app/challan-creation.tsx](app/challan-creation.tsx) carries its own
  copies of `buildFolderName`/`toUploadRequest`/`absoluteUrl` for a now-commented-out upload card;
  [lib/imageUpload.ts](lib/imageUpload.ts) is the version actually in use.
- **Password verification happens on the device** — the encrypted password is fetched and decrypted
  client-side, so the derivation secret ships in the bundle. Server-side authentication would be the
  fix.
- `.env` is tracked by git (only `.env*.local` is ignored), so the configured API host is committed.
- `console.log` of full payloads and responses is left in on the submit and upload paths.
