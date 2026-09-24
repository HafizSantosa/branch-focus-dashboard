import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MAX_CREDENTIAL_BYTES,
  credentialInstalled,
  readCredentialUpload,
  storeServiceAccountKey,
} from "../src/lib/backup-credential";
import { getManagedCredentialPath } from "../src/lib/drive-backup";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" });

function serviceAccount(email: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      type: "service_account",
      project_id: "test-project",
      client_email: email,
      private_key: privateKey,
    })
  );
}

test("a valid key is atomically persisted, while invalid replacements preserve it", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lop-backup-key-"));
  const previousDbPath = process.env.DB_PATH;
  const previousCredentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.DB_PATH = path.join(root, "users.db");
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  try {
    const destination = getManagedCredentialPath();
    assert.equal(await credentialInstalled(), false);
    const first = serviceAccount("first@test-project.iam.gserviceaccount.com");
    assert.equal(
      await storeServiceAccountKey(first),
      "first@test-project.iam.gserviceaccount.com"
    );
    assert.equal(await credentialInstalled(), true);
    assert.deepEqual(await readFile(destination), first);
    if (process.platform !== "win32") {
      assert.equal((await stat(destination)).mode & 0o777, 0o600);
    }

    await assert.rejects(
      storeServiceAccountKey(Buffer.from('{"type":"service_account","private_key":"broken"}')),
      /bukan kunci JSON service account/
    );
    await assert.rejects(
      readCredentialUpload(
        new Request("https://example.test/upload", {
          method: "PUT",
          body: Buffer.alloc(MAX_CREDENTIAL_BYTES + 1),
        })
      ),
      /melebihi 32 KB/
    );
    assert.deepEqual(await readFile(destination), first);
    assert.deepEqual(await readdir(path.dirname(destination)), [path.basename(destination)]);

    const second = serviceAccount("second@test-project.iam.gserviceaccount.com");
    assert.equal(
      await storeServiceAccountKey(second),
      "second@test-project.iam.gserviceaccount.com"
    );
    assert.deepEqual(await readFile(destination), second);
  } finally {
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
    if (previousCredentialPath === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = previousCredentialPath;
    await rm(root, { recursive: true, force: true });
  }
});
