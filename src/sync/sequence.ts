import { db } from "@/local/db"

/**
 * Generates a strictly monotonically increasing sequence number for outbox items.
 * Uses a Dexie transaction on the app_settings table to ensure atomicity.
 */
export async function getNextOutboxSequence(): Promise<number> {
  return db.transaction("rw", db.app_settings, db.outbox, async () => {
    const record = await db.app_settings.get("outbox_sequence")
    let currentSeq = record ? (record.value as number) : 0
    
    // Safety check against max sequence in outbox if app_settings was somehow cleared
    if (currentSeq === 0) {
      const highestOutbox = await db.outbox.orderBy("sequence").last()
      if (highestOutbox) {
        currentSeq = highestOutbox.sequence
      }
    }
    
    const nextSeq = currentSeq + 1
    
    await db.app_settings.put({
      key: "outbox_sequence",
      value: nextSeq,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    
    return nextSeq
  })
}
