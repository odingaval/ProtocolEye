// Browser media helpers: video frames, image prep, WAV conversion, PDF text.

export function formatTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this video file.'));
    };
    video.src = url;
  });
}

function seekTo(video, time) {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    try {
      video.currentTime = Math.min(Math.max(0.1, time), (video.duration || 1) - 0.05);
    } catch { resolve(); }
    setTimeout(done, 2500); // fallback: some browsers are slow to fire seeked
  });
}

function captureFrame(video, maxWidth = 1280) {
  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((video.videoWidth || maxWidth) * scale);
  canvas.height = Math.round((video.videoHeight || 720) * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { dataUrl, base64: dataUrl.split(',')[1] };
}

/** Extract evenly-spaced frames from a video file for inspection. */
export async function extractVideoFrames(file, count = 3) {
  const { video, url } = await loadVideo(file);
  try {
    const duration = video.duration || 1;
    const frames = [];
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 1)) / (count + 1);
      await seekTo(video, t);
      const { dataUrl, base64 } = captureFrame(video);
      frames.push({ dataUrl, base64, timestamp: Math.round(t * 10) / 10, label: `Video frame · ${formatTimestamp(t)}` });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readImageFile(file, maxWidth = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        URL.revokeObjectURL(url);
        resolve({ dataUrl, base64: dataUrl.split(',')[1] });
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image file.'));
    };
    img.src = url;
  });
}

/**
 * Convert any browser-decodable audio file to mono 16-bit PCM WAV at 16kHz,
 * the format Muse Voice Transcribe expects.
 */
async function decodeToWav16kMono(arrayBuffer, maxSeconds) {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const targetRate = 16000;
    const seconds = Math.min(decoded.duration, maxSeconds);
    const offline = new OfflineAudioContext(1, Math.ceil(seconds * targetRate), targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const wav = encodeWav(rendered.getChannelData(0), targetRate);
    return { base64: arrayBufferToBase64(wav), durationSeconds: decoded.duration };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export async function convertToWav16kMono(file) {
  const raw = await file.arrayBuffer();
  const { base64 } = await decodeToWav16kMono(raw, Infinity);
  return { base64, fileName: file.name.replace(/\.[^.]+$/, '') + '.wav' };
}

/**
 * Pull the narration track out of a video file (same WAV format as uploads,
 * capped to the first minutes). Returns null when the video has no usable
 * audio — callers fall back to video-only.
 */
export async function extractVideoAudio(file, maxSeconds = 300) {
  try {
    const raw = await file.arrayBuffer();
    const { base64, durationSeconds } = await decodeToWav16kMono(raw, maxSeconds);
    if (!durationSeconds || durationSeconds < 0.5) return null;
    return { base64, fileName: file.name.replace(/\.[^.]+$/, '') + '.wav' };
  } catch {
    return null;
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

let pdfjsPromise = null;
/** Lazily load pdf.js from a CDN on first PDF use; fails honestly when offline. */
export async function extractPdfText(file) {
  try {
    pdfjsPromise = pdfjsPromise || import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.min.mjs');
    const pdfjsLib = await pdfjsPromise;
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(buf).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += `--- Page ${i} ---\n${content.items.map((it) => it.str).join(' ')}\n\n`;
    }
    return fullText;
  } catch {
    pdfjsPromise = null; // allow retry once back online
    throw new Error('PDF reading needs an internet connection the first time (PDF engine loads on demand). .txt and .md work offline.');
  }
}
