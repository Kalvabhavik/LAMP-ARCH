import { Unzip, UnzipInflate, strFromU8 } from "fflate";
import { extractText } from "unpdf";

export type ExtractedFile = { path: string; text: string };
export type ExtractedBundle = { files: ExtractedFile[]; warnings: string[] };

export class BundleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const TEXT_EXTENSIONS = new Set([
  ".php", ".sql", ".conf", ".sh", ".txt", ".md", ".html", ".htm", ".css",
  ".js", ".ini", ".cnf", ".env", ".htaccess", ".log", ".json", ".yml",
  ".yaml", ".xml", ".service", ".timer",
]);

const TEXT_FILENAMES = new Set(["dockerfile", "crontab", "makefile", ".htaccess"]);

const SKIP_DIRS = ["__macosx/", ".git/", "node_modules/", "vendor/"];
const MAX_ENTRIES = 300;
const MAX_ENTRY_SIZE = 2 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;
const MAX_DOCX_XML_SIZE = 5 * 1024 * 1024;

function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function decodeUtf8(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BundleError("INVALID_FILE_TYPE", "File is not valid UTF-8 text.");
  }
  if (text.includes("\u0000")) {
    throw new BundleError("INVALID_FILE_TYPE", "File contains NUL bytes — not a text file.");
  }
  return text;
}

function tryDecodeUtf8(bytes: Uint8Array): string | null {
  try {
    return decodeUtf8(bytes);
  } catch {
    return null;
  }
}

function normalizePath(path: string): string | null {
  const cleaned = path.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "");
  if (!cleaned || cleaned.split("/").some((seg) => seg === "..")) return null;
  return cleaned;
}

function isTextLike(path: string): boolean {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  return TEXT_EXTENSIONS.has(extOf(path)) || TEXT_FILENAMES.has(base);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

type ZipCollect = {
  entries: number;
  aborted: boolean;
  /** Resolves when every started entry finished (or was terminated). */
  done: Promise<void>;
};

/**
 * Stream a zip without inflating it all into memory: files are decompressed
 * lazily via Unzip/UnzipInflate and only started when we actually want their
 * text. Actual decompressed bytes are counted (declared header sizes can lie)
 * and inflation is terminated the moment a limit is crossed. `onChunk` is
 * called for each decompressed chunk of a wanted entry and `onFinal` when the
 * entry completes; returning false from `onChunk` aborts the whole stream.
 */
function streamZip(
  bytes: Uint8Array,
  want: (name: string, originalSize: number) => string | null,
  onChunk: (name: string, data: Uint8Array) => boolean | void,
  onFinal: (name: string) => void,
  onSkip: (name: string, reason: string) => void,
  maxEntrySize = MAX_ENTRY_SIZE,
): ZipCollect {
  const state: ZipCollect = { entries: 0, aborted: false, done: Promise.resolve() };
  const pending: Promise<void>[] = [];

  const uz = new Unzip((file) => {
    state.entries++;
    if (state.entries > MAX_ENTRIES || state.aborted) {
      state.aborted = true;
      return; // never started → never inflated
    }
    if (file.name.endsWith("/")) return;
    const skipReason = want(file.name, file.originalSize ?? 0);
    if (skipReason !== null) {
      if (skipReason) onSkip(file.name, skipReason);
      return;
    }

    pending.push(
      new Promise<void>((resolve) => {
        let size = 0;
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        file.ondata = (err, data, final) => {
          if (settled) return;
          if (err || state.aborted) {
            file.terminate();
            finish();
            return;
          }
          size += data.length;
          if (size > maxEntrySize) {
            // Declared header lied — actual decompressed bytes exceed the cap.
            onSkip(file.name, `decompresses past ${Math.round(maxEntrySize / 1024 / 1024)} MB`);
            file.terminate();
            finish();
            return;
          }
          if (onChunk(file.name, data) === false) {
            state.aborted = true; // global limit — stop starting later files
            file.terminate();
            finish();
            return;
          }
          if (final) {
            onFinal(file.name);
            finish();
          }
        };
        file.start();
      }),
    );
  });

  uz.register(UnzipInflate);
  uz.push(bytes, true);
  state.done = Promise.all(pending).then(() => undefined);
  return state;
}

async function unzipBundle(bytes: Uint8Array): Promise<ExtractedBundle> {
  const files: ExtractedFile[] = [];
  const warnings: string[] = [];
  const chunksByPath = new Map<string, Uint8Array[]>();
  let total = 0;

  const state = streamZip(
    bytes,
    (name, originalSize) => {
      const path = normalizePath(name);
      if (!path) return `unsafe path`;
      if (SKIP_DIRS.some((d) => path.toLowerCase().startsWith(d))) return "";
      if (originalSize > MAX_ENTRY_SIZE) return `larger than 2 MB`;
      const ext = extOf(path);
      if (ext === ".docx" || ext === ".pdf" || ext === ".zip") {
        return `nested archive — include its text content as a plain file`;
      }
      if (!isTextLike(path)) return `not a text file`;
      return null;
    },
    (name, data) => {
      total += data.length;
      if (total > MAX_TOTAL_SIZE) return false; // abort → ZIP_TOO_LARGE below
      const path = normalizePath(name);
      if (!path) return true;
      (chunksByPath.get(path) ?? chunksByPath.set(path, []).get(path)!).push(data);
      return true;
    },
    (name) => {
      const path = normalizePath(name);
      if (!path) return;
      const text = tryDecodeUtf8(concat(chunksByPath.get(path) ?? []));
      if (text === null) {
        warnings.push(`Skipped "${path}" (not valid UTF-8).`);
        return;
      }
      files.push({ path, text });
    },
    (name, reason) => {
      const path = normalizePath(name) ?? name;
      warnings.push(`Skipped "${path}" (${reason}).`);
    },
  );
  await state.done;

  if (state.aborted || total > MAX_TOTAL_SIZE) {
    throw new BundleError(
      "ZIP_TOO_LARGE",
      state.entries > MAX_ENTRIES
        ? `Archive has more than ${MAX_ENTRIES} entries.`
        : "Archive expands past the 25 MB limit.",
    );
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), warnings };
}

async function docxToText(bytes: Uint8Array): Promise<string> {
  const chunks: Uint8Array[] = [];
  let found = false;
  let oversized = false;
  const state = streamZip(
    bytes,
    (name) => (name === "word/document.xml" ? null : ""),
    (_name, data) => {
      chunks.push(data);
      return true;
    },
    () => {
      found = true;
    },
    () => {
      oversized = true;
    },
    MAX_DOCX_XML_SIZE,
  );
  await state.done;
  if (oversized) {
    throw new BundleError("ZIP_TOO_LARGE", "DOCX document.xml decompresses past 5 MB.");
  }
  if (!found) throw new BundleError("INVALID_FILE_TYPE", "DOCX has no word/document.xml.");
  const xml = strFromU8(concat(chunks));
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extract a submission into a flat list of text files. Nothing is executed or
 * written to disk; paths are used only as labels.
 */
export async function extractBundle(
  fileName: string,
  bytes: Uint8Array,
  allowedExtensions?: string[],
): Promise<ExtractedBundle> {
  const ext = extOf(fileName);
  if (allowedExtensions && !allowedExtensions.includes(ext)) {
    throw new BundleError("INVALID_FILE_TYPE", `Extension "${ext || "(none)"}" is not allowed for this mission.`);
  }

  switch (ext) {
    case ".zip":
      if (!isZipMagic(bytes)) throw new BundleError("INVALID_FILE_TYPE", "File named .zip does not contain ZIP data.");
      return unzipBundle(bytes);
    case ".docx": {
      if (!isZipMagic(bytes)) throw new BundleError("INVALID_FILE_TYPE", "File named .docx is not a valid Office document.");
      const text = await docxToText(bytes);
      return { files: [{ path: fileName, text }], warnings: [] };
    }
    case ".pdf": {
      if (!bytes.subarray(0, 5).every((b, i) => b === "%PDF-".charCodeAt(i))) {
        throw new BundleError("INVALID_FILE_TYPE", "File named .pdf does not contain PDF data.");
      }
      const { text } = await extractText(bytes, { mergePages: true });
      const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
      const warnings = joined.trim() ? [] : ["PDF has no extractable text"];
      return { files: [{ path: fileName, text: joined }], warnings };
    }
    default: {
      // Text uploads (.txt .md .php .sql .sh .conf .ini, …): must be real UTF-8.
      const text = decodeUtf8(bytes);
      return { files: [{ path: fileName, text }], warnings: [] };
    }
  }
}
