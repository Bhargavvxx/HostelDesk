import { db } from "@/local/db"
import { useAuthStore } from "@/hooks/useAuthStore"
import { useSyncStatus } from "./status"
import { pushOutboxItem, MAX_ATTEMPTS } from "./push"
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
    // Auto-retry: pending items + failed items that still have retry budget
    const pendingItems = await db.outbox.where("status").equals("pending").sortBy("sequence")
    const retryableFailedItems = (await db.outbox.where("status").equals("failed").sortBy("sequence"))
      .filter(i => i.attempts < MAX_ATTEMPTS)
    const itemsToProcess = [...pendingItems, ...retryableFailedItems]
      .sort((a, b) => a.sequence - b.sequence)

    // Count items that need manual attention (failed + exhausted retry budget)
    const allFailed = await db.outbox.where("status").equals("failed").toArray()
    const highAttemptFailed = allFailed.filter(i => i.attempts >= MAX_ATTEMPTS).length

    // Get conflicts just for status counting
    const conflictCount = await db.outbox.where("status").equals("conflict").count()

    updateStats(itemsToProcess.length, conflictCount, highAttemptFailed)

    // Push sequentially
    for (const item of itemsToProcess) {
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
    
    // Update stats one last time after push+pull complete
    const remainingPending = await db.outbox.where("status").equals("pending").count()
    const remainingRetryable = (await db.outbox.where("status").equals("failed").toArray())
      .filter(i => i.attempts < MAX_ATTEMPTS).length
    const finalConflicts = await db.outbox.where("status").equals("conflict").count()
    const finalAllFailed = await db.outbox.where("status").equals("failed").toArray()
    const finalHighAttemptFailed = finalAllFailed.filter(i => i.attempts >= MAX_ATTEMPTS).length

    updateStats(remainingPending + remainingRetryable, finalConflicts, finalHighAttemptFailed)

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
