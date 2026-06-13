import { db } from "@/local/db"
import { useAuthStore } from "@/hooks/useAuthStore"
import { useSyncStatus } from "./status"
import { pushOutboxItem } from "./push"
import { pullChanges } from "./pull"

let syncTimer: ReturnType<typeof setInterval> | null = null
let isRunning = false

async function runSyncLoop() {
  if (isRunning) return
  const { isCloudSessionVerified, ownerId } = useAuthStore.getState()
  
  if (!navigator.onLine || !isCloudSessionVerified || !ownerId) {
    return
  }

  isRunning = true
  const { setSyncing, updateStats, setSuccess, setError } = useSyncStatus.getState()
  
  try {
    setSyncing(true)

    // 1. Process Outbox (Push)
    // Only get pending or retryable failed
    const pendingItems = await db.outbox
      .where("status").anyOf("pending", "failed")
      .sortBy("sequence")

    // Get conflicts just for status counting
    const conflictItems = await db.outbox
      .where("status").equals("conflict")
      .toArray()

    updateStats(pendingItems.length, conflictItems.length)

    // Push sequentially
    for (const item of pendingItems) {
      // If we went offline mid-sync, abort
      if (!navigator.onLine || !useAuthStore.getState().isCloudSessionVerified) {
        throw new Error("Connection or session lost mid-sync")
      }
      
      await pushOutboxItem(item, ownerId)
    }

    // 2. Process Delta Pulls
    if (navigator.onLine && useAuthStore.getState().isCloudSessionVerified) {
      await pullChanges(ownerId)
    }

    setSuccess()
    
    // Update stats one last time
    const remainingPending = await db.outbox.where("status").anyOf("pending", "failed").count()
    const finalConflicts = await db.outbox.where("status").equals("conflict").count()
    updateStats(remainingPending, finalConflicts)

  } catch (err: any) {
    console.error("Sync loop error:", err)
    
    // Auth failures explicitly mark session unverified and stop sync
    if (err.status === 401 || err.status === 403 || err.message?.includes("JWT")) {
      useAuthStore.getState().setAuth(ownerId, false)
      setError("Session expired. Please log in again.")
      stopSync()
    } else {
      setError(err.message || "Unknown sync error")
    }
  } finally {
    isRunning = false
  }
}

export function startSync() {
  if (syncTimer) return
  // Run immediately once
  runSyncLoop()
  // Then every 15 seconds
  syncTimer = setInterval(runSyncLoop, 15000)
}

export function stopSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  isRunning = false
}
