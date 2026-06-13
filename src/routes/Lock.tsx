import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { db } from "@/local/db"
import { hashPin, generateSalt, verifyPin } from "@/lib/lock"
import { useAuthStore } from "@/hooks/useAuthStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KeyRound } from "lucide-react"

export default function Lock() {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [isSetup, setIsSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const { setUnlocked, isCloudSessionVerified } = useAuthStore()

  useEffect(() => {
    checkPinSetup()
  }, [])

  const checkPinSetup = async () => {
    try {
      const config = await db.app_settings.get("security")
      if (!config || !config.value) {
        setIsSetup(true)
      }
    } catch (e) {
      console.error("Failed to read security config", e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (pin.length < 4) {
      setError("PIN must be at least 4 digits")
      return
    }

    try {
      if (isSetup) {
        if (pin !== confirmPin) {
          setError("PINs do not match")
          return
        }
        
        // Setup new PIN
        const salt = generateSalt()
        const hash = await hashPin(pin, salt)
        
        await db.app_settings.put({
          key: "security",
          value: {
            pin_hash: hash,
            pin_salt: salt,
            pin_iterations: 100000,
            pin_algorithm: "PBKDF2-SHA256"
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        
        // Clear local component state completely
        setPin("")
        setConfirmPin("")
        setUnlocked(true)
        navigate("/")
      } else {
        // Verify existing PIN
        const configRecord = await db.app_settings.get("security")
        const config = configRecord?.value as any
        
        if (!config || !config.pin_hash || !config.pin_salt) {
          setError("Corrupted security config. Please log out and back in.")
          return
        }
        
        const isValid = await verifyPin(pin, config.pin_hash, config.pin_salt)
        
        // Clear local component state completely
        setPin("")
        
        if (isValid) {
          setUnlocked(true)
          navigate("/")
        } else {
          setError("Incorrect PIN")
        }
      }
    } catch (err) {
      setError("An error occurred")
      console.error(err)
    }
  }

  if (loading) return null

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{isSetup ? "Set App PIN" : "Unlock HostelDesk"}</CardTitle>
          <CardDescription>
            {isSetup ? "Create a 4-to-6 digit PIN to quickly unlock the app." : "Enter your PIN to access your data."}
          </CardDescription>
          {!isCloudSessionVerified && !isSetup && (
            <div className="mt-2 rounded-md bg-amber-500/15 p-2 text-xs text-amber-600 dark:text-amber-400">
              Offline — cloud session not verified
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <input
                type="password"
                pattern="[0-9]*"
                inputMode="numeric"
                required
                placeholder="PIN"
                maxLength={6}
                className="w-full rounded-md border border-input bg-transparent px-3 py-3 text-center text-2xl tracking-[0.5em] shadow-sm"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>
            
            {isSetup && (
              <div className="space-y-2">
                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  required
                  placeholder="Confirm PIN"
                  maxLength={6}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-3 text-center text-2xl tracking-[0.5em] shadow-sm"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                />
              </div>
            )}
            
            <Button type="submit" className="w-full">
              {isSetup ? "Save PIN" : "Unlock"}
            </Button>
          </form>
          
          {!isSetup && (
            <div className="mt-6 text-center text-sm">
              <button 
                onClick={async () => {
                  const { supabase } = await import("@/cloud/supabase")
                  await supabase.auth.signOut()
                  await db.app_settings.delete("auth")
                  useAuthStore.getState().logout()
                  navigate("/login")
                }}
                className="text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Log out
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
