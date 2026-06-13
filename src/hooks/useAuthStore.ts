import { create } from "zustand"

interface AuthState {
  ownerId: string | null
  isUnlocked: boolean
  isCloudSessionVerified: boolean
  setAuth: (ownerId: string | null, verified: boolean) => void
  setUnlocked: (unlocked: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  ownerId: null,
  isUnlocked: false,
  isCloudSessionVerified: false,
  setAuth: (ownerId, verified) => set({ ownerId, isCloudSessionVerified: verified }),
  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
  logout: () => set({ ownerId: null, isUnlocked: false, isCloudSessionVerified: false }),
}))
