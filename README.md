# QR Pager POC

A QR-based digital pager. The customer scans a QR code, their phone opens a live status page, and when staff tap **Ready** the phone vibrates, beeps, and flashes green.

Zero dependencies: just Node.js 18+.

## Run

```bash
node server.js
```

- Staff dashboard: `http://localhost:3000/` (open on a laptop or tablet)
- The QR code encodes your LAN address, so the Android phone must be on the **same Wi-Fi**.

If the phone is on a different network, expose the server with a tunnel and set the public URL:

```bash
PUBLIC_URL=https://your-tunnel.example.com node server.js
```

## Try it

1. Open the staff dashboard, click **+ New order**.
2. Scan the QR with the Android phone (Chrome).
3. On the phone, tap **Enable alerts** (browsers require a tap before vibration/sound).
4. On the dashboard, click **Ready**. The phone vibrates, beeps, and turns green.

## Limits (POC)

- Orders live in memory and reset on restart.
- Vibration and sound only work while the page is open and the screen is on (the page requests a screen wake lock). For locked-screen alerts add Web Push (FCM) or an SMS/WhatsApp fallback.
- iPhone Safari does not support the Vibration API; sound and the visual alert still work.
- Plain HTTP over LAN is fine for this demo. Wake Lock and Web Push need HTTPS, so use a tunnel for those.

## Layout

- `server.js`: HTTP API and Server-Sent Events stream
- `public/staff.html`: staff dashboard with QR generation
- `public/customer.html`: customer status page with alert logic
