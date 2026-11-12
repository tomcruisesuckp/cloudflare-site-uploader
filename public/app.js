const form = document.getElementById("uploadForm");
const input = document.getElementById("website");
const selected = document.getElementById("selected");
const button = document.getElementById("submit");
const message = document.getElementById("message");
const progress = document.getElementById("progress");
const dropzone = document.getElementById("dropzone");

document.getElementById("folders").innerHTML = Array.from({length:10}, (_,i) =>
  `<div class="folder"><span class="folderIcon">📁</span><b>A${i+1}</b></div>`
).join("");

input.addEventListener("change", () => {
  const file = input.files[0];
  selected.hidden = !file;
  selected.textContent = file ? `Selected: ${file.name} · ${(file.size/1024/1024).toFixed(2)} MB` : "";
  message.textContent = "";
  message.className = "message";
});

["dragenter","dragover"].forEach(event => dropzone.addEventListener(event, e => {
  e.preventDefault(); dropzone.classList.add("drag");
}));
["dragleave","drop"].forEach(event => dropzone.addEventListener(event, e => {
  e.preventDefault(); dropzone.classList.remove("drag");
}));
dropzone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
  input.dispatchEvent(new Event("change"));
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.toLowerCase().split(".").pop();
  if (!["html","htm","zip"].includes(ext)) {
    message.textContent = "Choose an HTML, HTM or ZIP file.";
    message.className = "message error"; return;
  }
  if (file.size > 50 * 1024 * 1024) {
    message.textContent = "The maximum upload size is 50 MB.";
    message.className = "message error"; return;
  }

  button.disabled = true; button.textContent = "Preparing your folders…";
  progress.hidden = false; message.textContent = "Analyzing files and creating ten complete copies.";
  message.className = "message";
  try {
    const data = new FormData(); data.append("website", file);
    const response = await fetch("/api/build", { method:"POST", body:data });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "The upload could not be processed.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = "cloudflare-deployment-folders-A1-A10.zip";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    const noteHeader = response.headers.get("X-Site-Note");
    let note = "";
    if (noteHeader) { try { note = " " + atob(noteHeader); } catch {} }
    message.textContent = "Success! Your A1–A10 deployment ZIP has been downloaded." + note;
  } catch (err) {
    message.textContent = err.message;
    message.className = "message error";
  } finally {
    button.disabled = false; button.innerHTML = 'Generate A1–A10 folders <span>→</span>';
    progress.hidden = true;
  }
});
