import { useState, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/local/db"
import { supabase } from "@/cloud/supabase"
import { Image as ImageIcon, Loader2 } from "lucide-react"

interface ImagePreviewProps {
  localBlobId?: string | null
  cloudPath?: string | null
  className?: string
  alt?: string
  fallback?: React.ReactNode
}

export function ImagePreview({ localBlobId, cloudPath, className, alt = "Preview", fallback }: ImagePreviewProps) {
  const [cloudUrl, setCloudUrl] = useState<string | null>(null)
  const [isLoadingCloud, setIsLoadingCloud] = useState(false)
  
  // 1. Try to load local blob first
  const fileBlob = useLiveQuery(
    () => (localBlobId ? db.file_blobs.get(localBlobId) : undefined),
    [localBlobId]
  )

  const [localUrl, setLocalUrl] = useState<string | null>(null)

  useEffect(() => {
    if (fileBlob && fileBlob.blob) {
      const url = URL.createObjectURL(fileBlob.blob)
      setLocalUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setLocalUrl(null)
    }
  }, [fileBlob])

  // 2. Fallback to cloud path if no local blob
  useEffect(() => {
    if (!localUrl && cloudPath) {
      setIsLoadingCloud(true)
      supabase.storage
        .from("hosteldesk-files")
        .createSignedUrl(cloudPath, 60 * 60) // 1 hour
        .then(({ data, error }) => {
          if (!error && data?.signedUrl) {
            setCloudUrl(data.signedUrl)
          }
        })
        .finally(() => {
          setIsLoadingCloud(false)
        })
    } else {
      setCloudUrl(null)
    }
  }, [localUrl, cloudPath])

  const currentUrl = localUrl || cloudUrl

  if (!currentUrl) {
    if (isLoadingCloud) {
      return (
        <div className={`flex items-center justify-center bg-muted ${className || ""}`}>
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )
    }

    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className={`flex items-center justify-center bg-muted ${className || ""}`}>
        <ImageIcon className="size-6 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <img 
      src={currentUrl} 
      alt={alt} 
      className={`object-cover ${className || ""}`}
      loading="lazy"
    />
  )
}
