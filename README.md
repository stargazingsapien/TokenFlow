# TokenFlow

TokenFlow is a live OPD token tracker for clinics. It gives reception staff a fast queue control panel, gives patients a QR-friendly status page, and gives the waiting room a full-screen live display.

## Run locally

```bash
npm install
npm run dev
```

Open:

- `/control` for reception or doctor controls
- `/patient?token=12` for patient phones
- `/display` for the waiting-room screen

Use the language picker in the header to switch the interface between English, Gujarati, and Hindi.

Staff pages (`/control` and `/display`) require login. The default local credentials are:

- Username: `admin`
- Password: `tokenflow123`

Change these in `.env.local` with `TOKENFLOW_STAFF_USERNAME` and `TOKENFLOW_STAFF_PASSWORD` before real clinic use.

## Realtime backend

The MVP works locally through browser storage and BroadcastChannel so it can be piloted quickly on a single device or shared browser profile. For production, add Supabase values to `.env.local` and apply `supabase/schema.sql`.

## Hardware clicker

Most Bluetooth foot pedals and desk buttons can emulate a keyboard key. Keep the control page focused and press Space, Enter, ArrowRight, or `N` to call the next token.
