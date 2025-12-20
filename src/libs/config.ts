import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { z } from "zod/v4";
import { getDrizzle } from "@/db";
import { DEFAULT_COLLECTION_IDS } from "./catalog";

export const configSchema = z.object({
  catalogIds: z.array(z.string()).default(DEFAULT_COLLECTION_IDS),
  imageProxy: z.enum(["none", "weserv"]).default("none").catch("none"),
  dynamicCollections: z.boolean().default(false).catch(false),
});

export type Config = z.infer<typeof configSchema>;
export type ConfigInput = z.input<typeof configSchema>;

export const encodeConfig = (config?: ConfigInput | null): string => {
  const stringified = JSON.stringify(configSchema.parse(config ?? {}));
  const compressed = brotliCompressSync(stringified, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
    },
  });
  const result = compressed.toString("base64url");
  return result;
};

export const decodeConfig = (encoded?: string): Config => {
  if (!encoded) {
    return configSchema.parse({});
  }
  try {
    const decompressed = brotliDecompressSync(Buffer.from(encoded, "base64url"));
    return configSchema.parse(JSON.parse(decompressed.toString()));
  } catch {
    return configSchema.parse({});
  }
};

/**
 * 检查传入的 ID 是否是用户 ID
 * userId: UUID 格式（如 95db4d74-5d1b-4329-9283-57cb9a20c14b）
 * configId: brotli 压缩后的 base64url 编码
 */
export const isUserId = (id?: string): boolean => {
  return z.uuid().safeParse(id).success;
};

export const getConfig = async (env: CloudflareBindings, id?: string): Promise<Config> => {
  try {
    if (isUserId(id)) {
      const db = getDrizzle(env);
      const config = await db.query.userConfigs.findFirst({
        where: (userConfigs, { eq }) => eq(userConfigs.userId, id ?? ""),
      });
      return configSchema.parse(config);
    }
  } catch {
    return configSchema.parse({});
  }
  return decodeConfig(id);
};
