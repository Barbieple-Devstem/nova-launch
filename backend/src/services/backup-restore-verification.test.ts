import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import {
  calculateBackupIntegrity,
  compareBackupIntegrity,
} from "./backupIntegrity";

describe("backup restore verification", () => {
  it("compares restored scratch database counts and checksums", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "nova-backup-"));
    const backup = path.join(root, "backup");
    const scratch = path.join(root, "scratch");
    try {
      await mkdir(path.join(backup, "tables"), { recursive: true });
      await mkdir(path.join(scratch, "tables"), { recursive: true });
      const records = [
        ["tables/tokens.json", '[{"id":"token-1","supply":"1000"}]'],
        ["tables/streams.json", '[{"id":"stream-1","amount":"50"}]'],
      ] as const;
      for (const [relativePath, contents] of records) {
        await writeFile(path.join(backup, relativePath), contents);
        await writeFile(path.join(scratch, relativePath), contents);
      }
      const expected = await calculateBackupIntegrity(backup);
      const restored = await calculateBackupIntegrity(scratch);
      expect(restored.fileCount).toBe(expected.fileCount);
      expect(compareBackupIntegrity(expected, restored)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a corrupted restored backup", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "nova-backup-corrupt-"));
    const backup = path.join(root, "backup");
    const scratch = path.join(root, "scratch");
    try {
      await mkdir(backup, { recursive: true });
      await mkdir(scratch, { recursive: true });
      await writeFile(path.join(backup, "database.json"), '{"rows":[1,2,3]}');
      await writeFile(path.join(scratch, "database.json"), '{"rows":[1,2,4]}');
      const expected = await calculateBackupIntegrity(backup);
      const corrupted = await calculateBackupIntegrity(scratch);
      expect(corrupted.fileCount).toBe(expected.fileCount);
      expect(compareBackupIntegrity(expected, corrupted)).toBe(false);
      expect(corrupted.checksum).not.toBe(expected.checksum);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
