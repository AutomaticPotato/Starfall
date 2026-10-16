import { apiClient } from "@/lib/api-client";

/**
 * Starlights character files: a whole character for another Starlights server (docs/character-portability.md).
 * Exporting and importing are done by the server; this only moves the file in and out of the browser.
 */

export interface CharacterFile {
  format: string;
  version: number;
  summary?: { name: string };
  [key: string]: unknown;
}

export interface ImportPreview {
  canImport: boolean;
  error?: string | null;
  formatVersion: number;
  exportedAt: string;
  exportedFrom?: string | null;
  summary: { name: string; level: number; classes: { name: string; level: number }[]; edition: string; species?: string | null; background?: string | null; sources: string[] };
  portrait?: string | null;
  name: string;
  renamed: boolean;
  missing: { id: string; name: string; type: string; source: string; homebrew: boolean }[];
  homebrew: { name: string; type: string; source: string; installed: boolean }[];
  warnings: string[];
}

export interface ImportResult {
  characterId: string;
  name: string;
  warnings: string[];
}

/** Downloads the character as "<name>.starlights.json". */
export async function exportCharacter(characterId: string, name: string): Promise<void> {
  const file = await apiClient.get<CharacterFile>(`/api/characters/${characterId}/export`);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\w\- ]+/g, "").trim() || "character"}.starlights.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Reads a chosen file; throws a readable message when it isn't JSON. */
export async function readCharacterFile(file: File): Promise<CharacterFile> {
  try {
    return JSON.parse(await file.text()) as CharacterFile;
  } catch {
    throw new Error("This file is not a Starlights character file (it isn't JSON).");
  }
}

export function previewImport(file: CharacterFile, playerName: string | null) {
  return apiClient.post<{ file: CharacterFile; playerName: string | null }, ImportPreview>("/api/characters/import/preview", { file, playerName });
}

export function importCharacter(file: CharacterFile, playerName: string | null) {
  return apiClient.post<{ file: CharacterFile; playerName: string | null; confirm: boolean }, ImportResult>("/api/characters/import", { file, playerName, confirm: true });
}

/** The server's own explanation from an error ("HTTP 409 Conflict - {json}"), else the error's message. */
export function serverMessage(error: unknown): string {
  const text = (error as Error)?.message ?? String(error);
  const json = text.indexOf("{");
  if (json >= 0) {
    try {
      const body = JSON.parse(text.slice(json)) as { message?: string; errors?: Record<string, string[]> };
      const messages = Object.values(body.errors ?? {}).flat();
      if (messages.length > 0) return messages.join(" ");
      if (body.message) return body.message;
    } catch {
      /* not JSON */
    }
  }
  if (text.startsWith("HTTP 401")) return "This player is locked: unlock them (Switch player) to import into their collection.";
  return text;
}
