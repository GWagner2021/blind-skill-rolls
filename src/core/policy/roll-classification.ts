export function isDeathSaveMessage(message: any): boolean {
  try {
    const d5 = message?.flags?.dnd5e ?? {};
    const rollType = d5?.roll?.type ?? d5?.type ?? d5?.rollType ?? null;
    return rollType === "death" || message?.flavor === "Death Saving Throw";
  } catch { return false; }
}
