import fs from "fs/promises";
import { logger } from "./logger.js";

export async function readFile(path: string): Promise<string> {
  try {
    const data = await fs.readFile(path, "utf-8");
    return data;
  } catch (error) {
    logger.error(`Error reading file at ${path}:`, error);
    throw error;
  }
}

export async function readDir(path: string): Promise<string[]> {
  try {
    const files = await fs.readdir(path).catch((error) => {
      if (error.code === "ENOENT") {
        logger.warn(`Directory not found at ${path}. Creating directory...`);
        return [];
      }
      throw error;
    });
    if (files.length === 0) {
      await fs.mkdir(path, { recursive: true });
      return [];
    }
    return files;
  } catch (error) {
    logger.error(`Error reading directory at ${path}:`, error);
    throw error;
  }
}

