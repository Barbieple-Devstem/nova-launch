import { createHash } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

export interface BackupIntegrity {
  fileCount: number;
  totalBytes: number;
  checksum: string;
}

async function collectFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(root, fullPath));
    else if (entry.isFile()) files.push(path.relative(root, fullPath));
  }
  return files.sort();
}

/** Creates a stable manifest over a scratch restore directory. */
export async function calculateBackupIntegrity(root: string): Promise<BackupIntegrity> {
  const files = await collectFiles(root);
  const hash = createHash("sha256");
  let totalBytes = 0;
  for (const relativePath of files) {
    const fullPath = path.join(root, relativePath);
    const [contents, metadata] = await Promise.all([readFile(fullPath), stat(fullPath)]);
    totalBytes += metadata.size;
    hash.update(relativePath.replaceAll(path.sep, "/"));
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return { fileCount: files.length, totalBytes, checksum: hash.digest("hex") };
}

export function compareBackupIntegrity(
  expected: BackupIntegrity,
  restored: BackupIntegrity,
): boolean {
  return expected.fileCount === restored.fileCount
    && expected.totalBytes === restored.totalBytes
    && expected.checksum === restored.checksum;
}
