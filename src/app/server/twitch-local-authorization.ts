import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { z } from "zod";

const localAuthorizationSchema = z.object({
  version: z.literal(1),
  broadcasterId: z.string().trim().min(1).max(128),
  displayName: z.string().trim().min(1).max(128),
  gameId: z.string().trim().min(1).max(128).nullable(),
  gameName: z.string().trim().min(1).max(160).nullable(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  scopes: z.array(z.string().trim().min(1).max(128)).max(64),
  expiresAt: z.number().int().positive(),
}).strict();

const localAuthorizationDatabaseSchema = z.object({
  version: z.literal(1),
  connections: z.record(z.string(), localAuthorizationSchema),
}).strict();

const encryptedFileSchema = z.object({
  version: z.literal(1),
  iv: z.string().regex(/^[A-Za-z0-9_-]+$/u),
  ciphertext: z.string().regex(/^[A-Za-z0-9_-]+$/u),
  tag: z.string().regex(/^[A-Za-z0-9_-]+$/u),
}).strict();

export type TwitchLocalAuthorization = z.infer<typeof localAuthorizationSchema>;

export class TwitchLocalAuthorizationError extends Error {
  constructor(
    readonly code: "misconfigured" | "unavailable" | "invalid-store",
    message: string,
  ) {
    super(message);
    this.name = "TwitchLocalAuthorizationError";
  }
}

function encryptionKey(secret: string): Buffer {
  const value = secret.trim();
  if (value.length < 32) {
    throw new TwitchLocalAuthorizationError(
      "misconfigured",
      "Local Twitch authorization storage requires a server signing secret",
    );
  }
  return createHash("sha256")
    .update("chatxpt:local-twitch-authorization:v1:")
    .update(value)
    .digest();
}

function emptyDatabase() {
  return localAuthorizationDatabaseSchema.parse({ version: 1, connections: {} });
}

export interface TwitchLocalAuthorizationStoreDependencies {
  readonly secret: string;
  readonly filePath?: string;
}

/**
 * Localhost-only encrypted persistence for Twitch user access/refresh tokens.
 * The file is gitignored, server-only, and written with owner-only permissions.
 */
export class TwitchLocalAuthorizationStore {
  private readonly filePath: string;
  private readonly key: Buffer;

  constructor(dependencies: TwitchLocalAuthorizationStoreDependencies) {
    this.filePath = resolve(
      /* turbopackIgnore: true */
      dependencies.filePath ?? process.env.CHATXPT_LOCAL_TWITCH_STORE_PATH ??
        ".private/twitch-authorizations.json.enc",
    );
    this.key = encryptionKey(dependencies.secret);
  }

  async read(broadcasterId: string): Promise<TwitchLocalAuthorization | null> {
    const database = await this.readDatabase();
    return database.connections[broadcasterId] ?? null;
  }

  async save(input: TwitchLocalAuthorization): Promise<void> {
    const authorization = localAuthorizationSchema.parse(input);
    const database = await this.readDatabase();
    await this.writeDatabase({
      version: 1,
      connections: {
        ...database.connections,
        [authorization.broadcasterId]: authorization,
      },
    });
  }

  private async readDatabase() {
    let source: string;
    try {
      source = await readFile(this.filePath, "utf8");
    } catch (caught) {
      if ((caught as NodeJS.ErrnoException).code === "ENOENT") return emptyDatabase();
      throw new TwitchLocalAuthorizationError(
        "unavailable",
        "Local Twitch authorization storage could not be read",
      );
    }
    try {
      const encrypted = encryptedFileSchema.parse(JSON.parse(source) as unknown);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        Buffer.from(encrypted.iv, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      return localAuthorizationDatabaseSchema.parse(JSON.parse(plaintext) as unknown);
    } catch {
      throw new TwitchLocalAuthorizationError(
        "invalid-store",
        "Local Twitch authorization storage is invalid or belongs to another server secret",
      );
    }
  }

  private async writeDatabase(input: unknown): Promise<void> {
    const database = localAuthorizationDatabaseSchema.parse(input);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(database), "utf8"),
      cipher.final(),
    ]);
    const encrypted = JSON.stringify({
      version: 1,
      iv: iv.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
    });
    const directory = dirname(this.filePath);
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      await writeFile(temporary, encrypted, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
      await chmod(this.filePath, 0o600);
    } catch {
      throw new TwitchLocalAuthorizationError(
        "unavailable",
        "Local Twitch authorization storage could not be updated",
      );
    }
  }
}
