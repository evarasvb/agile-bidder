import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("imagen aportada para Don Evaristo", () => {
  it("conserva los bytes del JPEG aprobado, sin generar otro rostro", () => {
    const bytes = readFileSync(new URL("../assets/evaristo-retrato.jpg", import.meta.url));
    expect(bytes.length).toBe(20_210);
    expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("a4fdb8b66656c0b481f6c68146f2d828133fea6f636435a23b05cf1bf5ba2ce1");
    expect(bytes.includes(Buffer.from("Exif\0\0"))).toBe(false);
  });
});
