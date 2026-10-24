# TokenFlow

TokenFlow is a live OPD token tracker for clinics. It gives reception staff a fast queue control panel, gives patients a QR-friendly status page, and gives the waiting room a full-screen live display.

## Run locally

Requires Node.js 22 or newer for the Firebase Admin SDK.

```bash
npm install
npm run dev
```

Open:

- `/control` for reception or doctor controls
- `/patient` for a patient tracker (staff should issue a token and share its private tracker link)
- `/display` for the waiting-room screen

Use the language picker in the header to switch the interface between English, Gujarati, and Hindi.

Staff pages (`/control` and `/display`) require login. The default local credentials are:

- Username: `admin`
- Password: `tokenflow123`

Change these in `.env.local` with `TOKENFLOW_STAFF_USERNAME` and `TOKENFLOW_STAFF_PASSWORD` before real clinic use.

## Realtime backend

Without Firebase configuration, the queue is stored on the current device and synchronizes only between tabs in the same browser. To sync staff and patient phones in realtime:

1. Create a Firebase project and a Cloud Firestore database.
2. In the Firebase console, register a Web app and copy its Firebase config values into `.env.local`. Add a server service account JSON as `FIREBASE_SERVICE_ACCOUNT_JSON`, or use Application Default Credentials in a Google Cloud environment. Keep the service account private and never prefix it with `NEXT_PUBLIC_`.
3. Apply the rules from `firebase/firestore.rules` in the Firestore Rules console.
4. Set one stable `NEXT_PUBLIC_CLINIC_ID` for this clinic, then restart the Next.js server.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
NEXT_PUBLIC_CLINIC_ID=tokenflow-main
```

Firebase web config values are public client settings. The Admin service account JSON is private and must stay server-side.

Staff updates go through the login-protected API and are stored in a private Firestore document. Browser clients can read only the public queue-change signal; they cannot read private patient data or write queue documents. Patient links contain that patient's token number and a secret key in the URL fragment. The server validates the key and returns only that patient's status and name. Share the private tracker link after issuing a token.

## Hardware clicker

Most Bluetooth foot pedals and desk buttons can emulate a keyboard key. Keep the control page focused and press Space, Enter, ArrowRight, or `N` to call the next token.
