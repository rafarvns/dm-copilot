const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const youtubedl = require("youtube-dl-exec");

const YOUTUBE_URL_REGEX = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|playlist|shorts)|youtu\.be\/)/i;

function getMusicDir() {
  const dir = path.join(app.getPath("userData"), "music");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function validateYouTubeUrl(url) {
  if (!url || typeof url !== "string") return false;
  return YOUTUBE_URL_REGEX.test(url.trim());
}

function listFilesByBase(musicDir, fileBaseName) {
  return fs
    .readdirSync(musicDir)
    .filter((f) => f.startsWith(`${fileBaseName}.`));
}

function removeAudio(fileName) {
  if (!fileName) return false;
  const fullPath = path.join(getMusicDir(), path.basename(fileName));
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      return true;
    } catch (err) {
      console.error("Failed to remove music file:", err);
      return false;
    }
  }
  return false;
}

async function downloadAudio(url, fileBaseName) {
  if (!validateYouTubeUrl(url)) {
    throw new Error("URL do YouTube inválida");
  }
  if (!fileBaseName) {
    throw new Error("fileBaseName é obrigatório");
  }

  const musicDir = getMusicDir();

  // Remove arquivos antigos com o mesmo prefixo (extensões diferentes possíveis).
  for (const f of listFilesByBase(musicDir, fileBaseName)) {
    try {
      fs.unlinkSync(path.join(musicDir, f));
    } catch (_) {
      // ignore
    }
  }

  const outputTemplate = path.join(musicDir, `${fileBaseName}.%(ext)s`);

  try {
    await youtubedl(url, {
      format: "bestaudio",
      output: outputTemplate,
      noPlaylist: true,
      noWarnings: true,
      noCheckCertificates: true
    });
  } catch (err) {
    const msg = String(err && err.stderr ? err.stderr : err && err.message ? err.message : err);
    if (/private/i.test(msg)) throw new Error("Vídeo privado — não é possível baixar");
    if (/age|sign in/i.test(msg)) throw new Error("Vídeo restrito por idade — não é possível baixar");
    if (/unavailable|not available|removed/i.test(msg)) throw new Error("Vídeo indisponível ou removido");
    throw new Error(`Erro no download: ${msg.split("\n")[0]}`);
  }

  const generated = listFilesByBase(musicDir, fileBaseName);
  if (generated.length === 0) {
    throw new Error("Arquivo de áudio não foi gerado pelo yt-dlp");
  }

  const fileName = generated[0];
  return { fileName, fullPath: path.join(musicDir, fileName) };
}

module.exports = {
  downloadAudio,
  validateYouTubeUrl,
  removeAudio,
  getMusicDir
};
