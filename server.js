const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const AdmZip = require("adm-zip");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { PassThrough } = require("stream");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_EXPANDED = 200 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD, files: 1 }
});

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.static(path.join(__dirname, "public")));

function safeRelativePath(entryName) {
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some(p => p === "." || p === "..")) return null;
  return parts.join(path.sep);
}

function makeZipFromFolder(folder) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks = [];
    archive.on("data", chunk => chunks.push(chunk));
    archive.on("warning", err => err.code === "ENOENT" ? null : reject(err));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.directory(folder, false);
    archive.finalize();
  });
}

async function prepareSite(file) {
  const temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "site-uploader-"));
  const source = path.join(temp, "source");
  await fs.promises.mkdir(source, { recursive: true });

  if (/\.html?$/i.test(file.originalname)) {
    await fs.promises.writeFile(path.join(source, "index.html"), file.buffer);
    return { temp, siteRoot: source, note: "Only the uploaded HTML file was supplied. Add a ZIP of the complete site if it references local CSS, JS, images, or fonts." };
  }

  if (!/\.zip$/i.test(file.originalname)) {
    throw new Error("Please upload an .html, .htm, or .zip file.");
  }

  const zip = new AdmZip(file.buffer);
  const entries = zip.getEntries();
  let expanded = 0;
  const safeEntries = [];

  for (const entry of entries) {
    const rel = safeRelativePath(entry.entryName);
    if (rel === null) throw new Error("The ZIP contains an unsafe file path.");
    if (entry.isDirectory) continue;
    const data = entry.getData();
    expanded += data.length;
    if (expanded > MAX_EXPANDED) throw new Error("The uncompressed ZIP is larger than the 200 MB limit.");
    safeEntries.push({ rel, data });
  }

  for (const entry of safeEntries) {
    const destination = path.resolve(source, entry.rel);
    if (!destination.startsWith(path.resolve(source) + path.sep)) {
      throw new Error("The ZIP contains an unsafe file path.");
    }
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.writeFile(destination, entry.data);
  }

  const htmlFiles = [];
  for (const entry of safeEntries) {
    if (path.basename(entry.rel).toLowerCase() === "index.html") {
      htmlFiles.push(path.join(source, entry.rel));
    }
  }
  if (!htmlFiles.length) throw new Error("No index.html was found inside the ZIP.");
  // Use the shallowest index.html path as the website entry point.
  htmlFiles.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  const siteRoot = path.dirname(htmlFiles[0]);
  return { temp, siteRoot, note: `Found ${safeEntries.length} files. The folder containing the selected index.html will be used as the website root.` };
}

app.post("/api/build", upload.single("website"), async (req, res) => {
  let temp;
  try {
    if (!req.file) return res.status(400).json({ error: "Choose an HTML file or ZIP first." });
    const prepared = await prepareSite(req.file);
    temp = prepared.temp;
    const outputRoot = path.join(temp, "output");
    await fs.promises.mkdir(outputRoot, { recursive: true });

    const folders = Array.from({ length: 10 }, (_, i) => `A${i + 1}`);
    for (const folder of folders) {
      await fs.promises.cp(prepared.siteRoot, path.join(outputRoot, folder), { recursive: true });
    }

    const zipBuffer = await makeZipFromFolder(outputRoot);
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="cloudflare-deployment-folders-A1-A10.zip"',
      "X-Site-Note": Buffer.from(prepared.note).toString("base64")
    });
    res.send(zipBuffer);
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to process this upload." });
  } finally {
    if (temp) fs.promises.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.listen(PORT, () => console.log(`Uploader running on http://localhost:${PORT}`));
