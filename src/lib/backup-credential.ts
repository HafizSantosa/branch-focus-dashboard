import { createPrivateKey, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, mkdir, open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { getDriveBackupConfig, getManagedCredentialPath } from "@/lib/drive-backup";

export const MAX_CREDENTIAL_BYTES = 32 * 1024;

export class CredentialUploadError extends Error {}

export function credentialUploadAvailable(): boolean {
  return (
    path.resolve(getDriveBackupConfig().credentialsFile) ===
    path.resolve(getManagedCredentialPath())
  );
}

export async function credentialInstalled(): Promise<boolean> {
  try {
    await access(getDriveBackupConfig().credentialsFile, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function validateServiceAccountKey(bytes: Uint8Array): string {
  let key: unknown;
  try {
    key = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new CredentialUploadError("File harus berupa JSON service account.");
  }

  if (!key || typeof key !== "object") {
    throw new CredentialUploadError("File harus berupa JSON service account.");
  }
  const fields = key as Record<string, unknown>;
  if (
    fields.type !== "service_account" ||
    typeof fields.project_id !== "string" ||
    typeof fields.private_key !== "string" ||
    typeof fields.client_email !== "string" ||
    !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(
      fields.client_email
    )
  ) {
    throw new CredentialUploadError("File bukan kunci JSON service account yang valid.");
  }
  try {
    createPrivateKey(fields.private_key);
  } catch {
    throw new CredentialUploadError("Private key service account tidak valid.");
  }
  return fields.client_email;
}

export async function readCredentialUpload(request: Request): Promise<Buffer> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_CREDENTIAL_BYTES) {
    throw new CredentialUploadError("Ukuran file melebihi 32 KB.");
  }
  if (!request.body) {
    throw new CredentialUploadError("Pilih file JSON service account terlebih dahulu.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CREDENTIAL_BYTES) {
      await reader.cancel();
      throw new CredentialUploadError("Ukuran file melebihi 32 KB.");
    }
    chunks.push(value);
  }
  if (total === 0) {
    throw new CredentialUploadError("Pilih file JSON service account terlebih dahulu.");
  }
  return Buffer.concat(chunks, total);
}

export async function storeServiceAccountKey(bytes: Uint8Array): Promise<string> {
  if (!credentialUploadAvailable()) {
    throw new CredentialUploadError(
      "Kredensial dipasang dari luar container; upload lewat dashboard tidak tersedia."
    );
  }
  if (bytes.byteLength > MAX_CREDENTIAL_BYTES) {
    throw new CredentialUploadError("Ukuran file melebihi 32 KB.");
  }
  const email = validateServiceAccountKey(bytes);
  const destination = getManagedCredentialPath();
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.credential-${randomUUID()}`);
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, destination);
    await chmod(destination, 0o600);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  return email;
}
