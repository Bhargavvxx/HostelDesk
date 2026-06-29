import { create } from "zustand"

export interface SyncStatusState {
  isSyncing: boolean
  lastSyncAt: string | null
  pendingCount: number
  conflictCount: number
  highAttemptFailedCount: number
  lastError: string | null
  
  setSyncing: (isSyncing: boolean) => void
  updateStats: (pending: number, conflict: number, highAttemptFailed: number) => void
  setSuccess: () => void
  setError: (error: string) => void
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  conflictCount: 0,
  highAttemptFailedCount: 0,
  lastError: null,
  
  setSyncing: (isSyncing) => set({ isSyncing }),
  updateStats: (pendingCount, conflictCount, highAttemptFailedCount) =>
    set({ pendingCount, conflictCount, highAttemptFailedCount }),
  setSuccess: () => set({ 
    isSyncing: false, 
    lastSyncAt: new Date().toISOString(),
    lastError: null 
  }),
  setError: (error) => set({
    isSyncing: false,
    lastError: error
  })
}))
