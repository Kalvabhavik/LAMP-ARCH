import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractBundle } from "@/lib/validation/extract";

const u8 = (s: string) => strToU8(s);

describe("extractBundle", () => {
  it("extracts text files from a zip and skips junk", async () => {
    const zip = zipSync({
      "setup.sh": u8("sudo apt update"),
      "__MACOSX/x": u8("junk"),
      "node_modules/lib/index.js": u8("junk"),
      "dir/": new Uint8Array(0),
      "notes.bin": new Uint8Array([1, 2, 3]),
    });
    const { files, warnings } = await extractBundle("sub.zip", zip);
    expect(files.map((f) => f.path)).toEqual(["setup.sh"]);
    expect(files[0].text).toContain("apt update");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("rejects a .zip whose magic bytes are wrong", async () => {
    await expect(extractBundle("fake.zip", u8("not a zip"))).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE",
    });
  });

  it("rejects a .pdf whose magic bytes are wrong", async () => {
    await expect(extractBundle("fake.pdf", u8("definitely not pdf"))).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE",
    });
  });

  it("rejects non-UTF-8 text uploads", async () => {
    await expect(extractBundle("sol.txt", new Uint8Array([0xff, 0xfe, 0x00]))).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE",
    });
  });

  it("enforces allowedExtensions", async () => {
    await expect(extractBundle("sol.exe", u8("MZ"), [".txt", ".zip"])).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE",
    });
  });

  it("extracts docx text", async () => {
    const docx = zipSync({
      "word/document.xml": u8(
        '<w:document><w:body><w:p><w:t>Hello</w:t></w:p><w:p><w:t>World &lt;tag&gt;</w:t></w:p></w:body></w:document>',
      ),
    });
    const { files } = await extractBundle("report.docx", docx);
    expect(files[0].text).toContain("Hello\nWorld <tag>");
  });

  it("enforces the entry count and per-file size limits", async () => {
    const many: Record<string, Uint8Array> = {};
    for (let i = 0; i < 301; i++) many[`f${i}.txt`] = u8("x");
    await expect(extractBundle("many.zip", zipSync(many))).rejects.toMatchObject({ code: "ZIP_TOO_LARGE" });

    const big = { "big.txt": new Uint8Array(2 * 1024 * 1024 + 1).fill(0x61) };
    const { files, warnings } = await extractBundle("big.zip", zipSync(big));
    expect(files).toHaveLength(0);
    expect(warnings.join(" ")).toMatch(/larger than 2 MB/);
  });

  it("skips a zip bomb entry without fully inflating it", async () => {
    // 30 MB of zeros compresses to ~30 KB.
    const bomb = zipSync({ "bomb.txt": new Uint8Array(30 * 1024 * 1024) }, { level: 9 });
    expect(bomb.length).toBeLessThan(200 * 1024);
    const before = process.memoryUsage().heapUsed;
    const { files, warnings } = await extractBundle("bomb.zip", bomb);
    expect(files).toHaveLength(0);
    expect(warnings.join(" ")).toMatch(/2 MB/);
    // The 30 MB payload must never be resident at once (heap grows well under it).
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(30 * 1024 * 1024);
  });

  it("rejects many small entries totalling over 25 MB", async () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 14; i++) entries[`f${i}.txt`] = new Uint8Array(2 * 1024 * 1024 - 1).fill(0x61);
    await expect(extractBundle("total.zip", zipSync(entries))).rejects.toMatchObject({ code: "ZIP_TOO_LARGE" });
  });

  it("normalizes paths and rejects traversal", async () => {
    const zip = zipSync({
      "./ok.txt": u8("ok"),
      "../evil.txt": u8("bad"),
    });
    const { files, warnings } = await extractBundle("t.zip", zip);
    expect(files.map((f) => f.path)).toEqual(["ok.txt"]);
    expect(warnings.join(" ")).toMatch(/evil/);
  });
});
