import { describe, it, expect } from "vitest";
import { isBinaryFile, readTextFile, getLanguageForFile, processDroppedFiles } from "../file-drop";

function createFile(name: string, content: string | ArrayBuffer, type = ""): File {
  const blob = typeof content === "string"
    ? new Blob([content], { type })
    : new Blob([content], { type });
  return new File([blob], name, { type });
}

function createBinaryFile(name: string, type = ""): File {
  const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x0D, 0x0A, 0x1A]);
  return new File([buffer], name, { type });
}

describe("isBinaryFile", () => {
  it("returns true for known binary extensions", async () => {
    expect(await isBinaryFile(createFile("photo.png", ""))).toBe(true);
    expect(await isBinaryFile(createFile("app.exe", ""))).toBe(true);
    expect(await isBinaryFile(createFile("archive.zip", ""))).toBe(true);
    expect(await isBinaryFile(createFile("doc.pdf", ""))).toBe(true);
    expect(await isBinaryFile(createFile("module.wasm", ""))).toBe(true);
  });

  it("returns false for text files", async () => {
    expect(await isBinaryFile(createFile("main.ts", "const x = 1;"))).toBe(false);
    expect(await isBinaryFile(createFile("readme.md", "# Hello"))).toBe(false);
    expect(await isBinaryFile(createFile("config.json", "{}"))).toBe(false);
  });

  it("returns false for empty files", async () => {
    expect(await isBinaryFile(createFile("empty.txt", ""))).toBe(false);
  });

  it("returns true for content with null bytes", async () => {
    expect(await isBinaryFile(createBinaryFile("unknown.dat"))).toBe(true);
  });
});

describe("getLanguageForFile", () => {
  it("maps common extensions correctly", () => {
    expect(getLanguageForFile("main.ts")).toBe("typescript");
    expect(getLanguageForFile("app.tsx")).toBe("tsx");
    expect(getLanguageForFile("script.py")).toBe("python");
    expect(getLanguageForFile("lib.rs")).toBe("rust");
    expect(getLanguageForFile("index.js")).toBe("javascript");
    expect(getLanguageForFile("style.css")).toBe("css");
    expect(getLanguageForFile("page.html")).toBe("html");
    expect(getLanguageForFile("data.json")).toBe("json");
    expect(getLanguageForFile("config.yaml")).toBe("yaml");
    expect(getLanguageForFile("query.sql")).toBe("sql");
    expect(getLanguageForFile("run.sh")).toBe("bash");
    expect(getLanguageForFile("Main.java")).toBe("java");
    expect(getLanguageForFile("main.go")).toBe("go");
  });

  it("returns 'none' for unknown extensions", () => {
    expect(getLanguageForFile("data.xyz")).toBe("none");
    expect(getLanguageForFile("noext")).toBe("none");
  });

  it("returns 'none' for .txt files", () => {
    expect(getLanguageForFile("readme.txt")).toBe("none");
  });
});

describe("readTextFile", () => {
  it("reads text content from a file", async () => {
    const file = createFile("test.txt", "Hello, world!");
    const content = await readTextFile(file);
    expect(content).toBe("Hello, world!");
  });

  it("handles UTF-8 content", async () => {
    const file = createFile("unicode.txt", "Hello 🌍 café");
    const content = await readTextFile(file);
    expect(content).toBe("Hello 🌍 café");
  });
});

describe("processDroppedFiles", () => {
  it("accepts text files and rejects binary files", async () => {
    const files = [
      createFile("main.ts", "const x = 1;"),
      createBinaryFile("photo.png"),
      createFile("readme.md", "# Hello"),
    ];

    const result = await processDroppedFiles(files);

    expect(result.files).toHaveLength(2);
    expect(result.files[0].name).toBe("main.ts");
    expect(result.files[0].language).toBe("typescript");
    expect(result.files[0].content).toBe("const x = 1;");
    expect(result.files[1].name).toBe("readme.md");
    expect(result.files[1].language).toBe("markdown");

    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].name).toBe("photo.png");
  });

  it("returns empty result for all-binary input", async () => {
    const files = [createBinaryFile("a.png"), createBinaryFile("b.exe")];
    const result = await processDroppedFiles(files);
    expect(result.files).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  it("calculates byte size correctly", async () => {
    const content = "Hello 🌍";
    const file = createFile("test.txt", content);
    const result = await processDroppedFiles([file]);
    const expectedBytes = new TextEncoder().encode(content).length;
    expect(result.files[0].byteSize).toBe(expectedBytes);
  });
});
