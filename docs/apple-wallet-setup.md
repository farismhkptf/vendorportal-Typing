# Apple Wallet Pass — Certificate Setup Guide

This guide covers everything needed to activate the Apple Wallet pass feature in production. The feature is fully implemented; it only needs the correct environment variables to be set.

---

## Prerequisites

- An active **Apple Developer Program** account (paid, $99/year)
- **Keychain Access** on a Mac (for exporting certificates)
- A terminal with `openssl` installed

---

## Step 1 — Create a Pass Type ID in the Apple Developer Portal

1. Sign in to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. In the left sidebar, click **Identifiers**, then click **+**.
3. Select **Pass Type IDs** and click **Continue**.
4. Enter a description (e.g. `PRO Company Appointment Pass`) and a reverse-domain identifier (e.g. `pass.ae.procompany.appointment`).
5. Click **Register**.

> The identifier you register here is the value you will set for `APPLE_PASS_TYPE_IDENTIFIER`.

---

## Step 2 — Generate and Download the Pass Type ID Certificate

1. From the **Identifiers** list, click on the Pass Type ID you just created.
2. Click **Create Certificate** under "Production Certificates".
3. You will be prompted to upload a **Certificate Signing Request (CSR)**. Generate one with Keychain Access:
   - Open **Keychain Access** → menu bar → **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**.
   - Enter your email address. Select **Saved to disk**. Click **Continue** and save the `.certSigningRequest` file.
4. Upload the `.certSigningRequest` file and click **Continue**.
5. Download the resulting `.cer` file (e.g. `pass.cer`).

---

## Step 3 — Export the Certificate and Private Key

### Import into Keychain Access

1. Double-click the downloaded `pass.cer` to import it into Keychain Access.
2. In Keychain Access, find the certificate (it will appear as `Pass Type ID: pass.ae.procompany.appointment`).
3. Expand the certificate to reveal the private key underneath it.

### Export the Certificate (APPLE_PASS_CERT)

1. Right-click the **certificate** (not the key) → **Export**.
2. Choose format **Certificate (.cer)** — this exports as DER binary, which the app accepts.
   - Alternatively, export as **PEM (.pem)** if your tooling supports it.
3. Save as `pass_cert.cer` (no passphrase required for the certificate).

Convert to base64 for the environment variable:

```bash
base64 -i pass_cert.cer | tr -d '\n'
```

Copy the output — this is the value for **`APPLE_PASS_CERT`**.

### Export the Private Key (APPLE_PASS_KEY)

1. Right-click the **private key** (the row indented under the certificate) → **Export**.
2. Choose format **Personal Information Exchange (.p12)**.
3. You will be prompted to set an export passphrase. You can leave it blank (unencrypted) or set one. **Remember your choice** — it determines whether you need `APPLE_PASS_PASSPHRASE`.
4. Save as `pass_key.p12`.

Extract the private key from the `.p12`:

```bash
# If you set an export passphrase:
openssl pkcs12 -in pass_key.p12 -nocerts -nodes -out pass_key.pem
# (enter your passphrase when prompted)

# If you left the passphrase blank:
openssl pkcs12 -in pass_key.p12 -nocerts -nodes -out pass_key.pem -passin pass:
```

Convert to base64:

```bash
base64 -i pass_key.pem | tr -d '\n'
```

Copy the output — this is the value for **`APPLE_PASS_KEY`**.

> If the exported PEM begins with `-----BEGIN ENCRYPTED PRIVATE KEY-----`, you will need to either decrypt it first (`openssl rsa -in pass_key.pem -out pass_key_decrypted.pem`) or set `APPLE_PASS_PASSPHRASE` to the passphrase used during export.

---

## Step 4 — Download the Apple WWDR G4 Certificate (APPLE_PASS_WWDR)

The **Worldwide Developer Relations (WWDR)** certificate is Apple's intermediate CA. You need the **G4** variant for passes signed today.

1. Download from Apple: [https://www.apple.com/certificateauthority/](https://www.apple.com/certificateauthority/)
   - Look for **"Apple Worldwide Developer Relations Certification Authority — G4"** and download the `.cer` file.
   - Direct link: `https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer`

Convert to base64:

```bash
base64 -i AppleWWDRCAG4.cer | tr -d '\n'
```

Copy the output — this is the value for **`APPLE_PASS_WWDR`**.

---

## Step 5 — Find Your Team ID (APPLE_TEAM_ID)

1. Sign in to [developer.apple.com](https://developer.apple.com) → **Account**.
2. Under **Membership details**, your **Team ID** is shown (10-character alphanumeric string, e.g. `AB12CD34EF`).

This is the value for **`APPLE_TEAM_ID`**.

---

## Environment Variable Reference

| Variable | Required | Description |
|---|---|---|
| `APPLE_PASS_CERT` | Yes | Base64-encoded Pass Type ID certificate (DER or PEM both accepted) |
| `APPLE_PASS_KEY` | Yes | Base64-encoded private key for the Pass Type ID certificate (PEM format, unencrypted) |
| `APPLE_PASS_WWDR` | Yes | Base64-encoded Apple WWDR G4 intermediate certificate (DER or PEM both accepted) |
| `APPLE_TEAM_ID` | Yes | 10-character Apple Developer Team ID (e.g. `AB12CD34EF`) |
| `APPLE_PASS_TYPE_IDENTIFIER` | **Treat as required in production** | Pass Type ID registered in the Developer Portal (e.g. `pass.ae.procompany.appointment`). The server falls back to the built-in default `pass.ae.procompany.appointment` if unset, but you should always set this explicitly unless your registered Pass Type ID is exactly that value. A mismatch causes Apple to reject the pass signature silently. |
| `APPLE_PASS_PASSPHRASE` | No | Passphrase for the private key — only set this if the private key exported from Keychain was encrypted. Leave unset if the key is unencrypted. |

> **Encoding note:** The application accepts certificates in DER (binary) format encoded as base64, in PEM format encoded as base64, or as a raw PEM string. The recommended approach is DER-to-base64 as shown above. The app auto-detects the format and converts DER to PEM internally.

---

## Setting the Environment Variables in Replit

In the Replit workspace, open the **Secrets** panel (the padlock icon in the sidebar) and add each variable listed above. Never paste certificate material directly into source code or commit it to version control.

---

## Step 6 — Verify the Setup

Once all environment variables are set (and the application is deployed or restarted), run:

```bash
curl -I https://<your-app-url>/api/card/<any-valid-token>/wallet
```

| Response | Meaning |
|---|---|
| `HTTP 200` | All certificates loaded and validated — Apple Wallet is active |
| `HTTP 503` | Missing or malformed environment variables — check server logs for details |

> **Note:** The HEAD preflight route only checks certificate configuration. It does not validate the token, so `HTTP 404` will not be returned here. If you use a `GET` request instead, a valid token is required — an unknown token returns `HTTP 404` in that case, which indicates the certificates are fine but the token does not exist.

The server logs will print a diagnostic line on every `HEAD` request:

```
[apple-wallet] Wallet available — passTypeIdentifier: pass.ae.procompany.appointment, teamId: AB12CD34EF, passphrase: not set (unencrypted key)
```

If a certificate fails to parse, the log will include the specific variable name and format details to help diagnose the problem.

---

## Troubleshooting

### `HTTP 503` — missing env vars
Check that all four required variables (`APPLE_PASS_CERT`, `APPLE_PASS_KEY`, `APPLE_PASS_WWDR`, `APPLE_TEAM_ID`) are set and not empty.

### `HTTP 503` — certificate preflight failed
The server logs will indicate which variable failed and why (e.g. unrecognised format). Common causes:

- **Double-base64 encoding**: If you ran `base64` on a file that was already base64-encoded. The app handles this automatically in most cases, but check the log for `double-base64 detected` messages.
- **Wrong WWDR generation**: Using the G1 or G3 WWDR certificate instead of G4 will cause signature failures. Re-download specifically the G4 certificate.
- **Encrypted private key without passphrase**: If the key starts with `-----BEGIN ENCRYPTED PRIVATE KEY-----`, set `APPLE_PASS_PASSPHRASE` to the passphrase used during export, or re-export with no passphrase.

### Pass opens but shows as invalid on device
- Verify `APPLE_PASS_TYPE_IDENTIFIER` exactly matches the identifier registered in the Developer Portal (case-sensitive).
- Verify `APPLE_TEAM_ID` matches the team that owns the Pass Type ID — mismatched teams cause signature rejection.

### Certificate has expired
Pass Type ID certificates are valid for one year. To renew, return to the Developer Portal, create a new certificate for the same Pass Type ID (Step 2), and update `APPLE_PASS_CERT` and `APPLE_PASS_KEY` with the new values.
