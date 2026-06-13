import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/hooks/useTheme"
import { AppShell } from "@/components/layout/AppShell"
import Dashboard from "@/routes/Dashboard"
import Students from "@/routes/Students"
import Movement from "@/routes/Movement"
import Fees from "@/routes/Fees"
import More from "@/routes/More"
import Login from "@/routes/Login"
import Lock from "@/routes/Lock"
import { supabase } from "@/cloud/supabase"
import { db } from "@/local/db"
import { useAuthStore } from "@/hooks/useAuthStore"
import { startSync, stopSync } from "@/sync/engine"

// 10 minutes in milliseconds
const IDLE_TIMEOUT_MS = 10 * 60 * 1000

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ownerId, isUnlocked } = useAuthStore()
  
  if (!ownerId) {
    return <Navigate to="/login" replace />
  }
  
  if (!isUnlocked) {
    return <Navigate to="/lock" replace />
  }
  
  return <>{children}</>
}

// AppShell with Idle Lock Tracker
function AppLayout() {
  const { setUnlocked, isUnlocked } = useAuthStore()

  useEffect(() => {
    if (!isUnlocked) return

    let lastActivityAt = Date.now()
    
    const updateActivity = () => {
      lastActivityAt = Date.now()
    }

    // Debounced listener to avoid thrashing
    const handleActivity = () => {
      requestAnimationFrame(updateActivity)
    }

    const checkIdle = setInterval(() => {
      if (Date.now() - lastActivityAt > IDLE_TIMEOUT_MS) {
        setUnlocked(false)
      }
    }, 10000)

    window.addEventListener("mousemove", handleActivity)
    window.addEventListener("keydown", handleActivity)
    window.addEventListener("touchstart", handleActivity)
    window.addEventListener("scroll", handleActivity)

    return () => {
      clearInterval(checkIdle)
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("keydown", handleActivity)
      window.removeEventListener("touchstart", handleActivity)
      window.removeEventListener("scroll", handleActivity)
    }
  }, [isUnlocked, setUnlocked])

  // Sync Engine lifecycle
  useEffect(() => {
    if (isUnlocked) {
      startSync()
    } else {
      stopSync()
    }
    return () => stopSync()
  }, [isUnlocked])

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local-first: no network fetching by default
      // TanStack Query will be used for local Dexie reads in later tickets
      staleTime: Infinity,
      retry: false,
    },
  },
})

export default function App() {
  const { setAuth } = useAuthStore()
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          // Cloud session active
          setAuth(session.user.id, true)
        } else {
          // Try offline fallback
          const authRecord = await db.app_settings.get("auth")
          const authVal = authRecord?.value as any
          if (authVal?.owner_id) {
            setAuth(authVal.owner_id, false)
          } else {
            setAuth(null, false)
          }
        }
      } catch (err) {
        // Fallback on error (e.g. offline)
        try {
          const authRecord = await db.app_settings.get("auth")
          const authVal = authRecord?.value as any
          if (authVal?.owner_id) {
            setAuth(authVal.owner_id, false)
          } else {
            setAuth(null, false)
          }
        } catch (dbErr) {
          setAuth(null, false)
        }
      } finally {
        setIsInitializing(false)
      }
    }
    initAuth()
  }, [setAuth])

  if (isInitializing) return null // Or a splash screen

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/lock" element={<Lock />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/movement" element={<Movement />} />
              <Route path="/fees" element={<Fees />} />
              <Route path="/more" element={<More />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
