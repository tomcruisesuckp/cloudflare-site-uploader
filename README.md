# Cloudflare Site Uploader

A small Node.js web application. Upload either:
- one `index.html` / `.htm` file, or
- a ZIP containing your complete static website, with an `index.html` inside it.

The server creates ten independent, identical website roots named `A1` through `A10` and downloads them in one ZIP. Each A-folder is intended to be uploaded separately to Cloudflare Pages.

## Requirements

- Node.js 20 or newer
- npm

## Run on your computer

1. Extract this project ZIP.
2. Open a terminal in the extracted `cloudflare-site-uploader` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open `http://localhost:3000` in your browser.
6. Upload your HTML file or website ZIP. The browser downloads `cloudflare-deployment-folders-A1-A10.zip`.
7. Extract that downloaded ZIP. You will see A1, A2, ... A10.

## Deploy one generated folder to Cloudflare Pages

1. Sign in at https://dash.cloudflare.com/
2. Open **Workers & Pages**.
3. Choose **Create application** → **Pages** → **Upload assets** (the exact labels can change).
4. Give the project a name.
5. Upload the contents of one folder, for example `A1`, or drag the `A1` folder into the upload area if the dashboard accepts folders.
6. Deploy. Cloudflare will provide a `pages.dev` address.
7. Repeat with A2–A10 only if you want separate Cloudflare Pages projects.

Each folder must have `index.html` at its root. The generated folders are complete copies, not ten different pieces of one website.

## Host the uploader on a public server

The uploader is a Node.js server, not just a static HTML page. Cloudflare Pages static hosting cannot run `server.js` or its upload-processing endpoint.

You can host this project on a Node.js service such as Render, Railway, or a VPS:

### Option A — Render / Railway

1. Create a Git repository and upload the contents of this project folder to it.
2. Create a new **Web Service** from that repository on your hosting provider.
3. Set the build/install command to `npm install`.
4. Set the start command to `npm start`.
5. Select a Node.js runtime compatible with Node 20+.
6. Deploy. The service should use the platform-provided `PORT` environment variable (this app already does).
7. Open the public service URL. The uploader page will be available there.

Use a persistent/adequately sized service for uploads. The app uses temporary server storage while processing and removes its temporary work directory afterward. Configure request/body limits and authentication if you make it public.

### Option B — Your own VPS

1. Provision an Ubuntu server and point a domain/subdomain to its public IP.
2. Install Node.js 20+ and npm.
3. Copy this project folder to the server using Git or SFTP.
4. In the project directory run `npm install`.
5. Run `npm start` to test it.
6. For production, run it with a process manager such as PM2:

   ```bash
   npm install -g pm2
   pm2 start server.js --name site-uploader
   pm2 save
   ```

7. Put Nginx in front of the app as a reverse proxy to `http://127.0.0.1:3000`, enable HTTPS with a TLS certificate, and configure Nginx's upload body limit to at least 50 MB.
8. Keep the server and dependencies updated.

Do not expose a production upload endpoint without access controls, rate limiting, and monitoring. Consider requiring a login if only you will use it.

## What it does and does not do

- Preserves local files included in the uploaded ZIP.
- Selects the shallowest `index.html` found in the ZIP and treats its containing folder as the site root.
- Makes ten identical, independently deployable copies.
- Does not rewrite HTML or discover/download remote CDN resources.
- Does not include files that were not in the upload.
- A single HTML upload produces a valid one-file site; linked local stylesheets/images will be missing unless included in a ZIP.
- This tool is for static websites. Server-side applications, databases, PHP, Node backends, and build-tool projects need their own build/deployment workflow.

## Limits and security notes

Default maximum upload: 50 MB. Default expanded ZIP limit: 200 MB. Files are held in memory during ZIP parsing, so deploy this on a server with sufficient memory. For a public production service, add authentication, per-user quotas, malware scanning, stronger ZIP handling, and persistent job storage.
