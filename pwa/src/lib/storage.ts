import { supabase } from './supabase'

export async function uploadSelfie({
  bucket,
  path,
  blob,
}: {
  bucket: string
  path: string
  blob: Blob
}) {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    cacheControl: '3600',
    upsert: true,
    contentType: blob.type || 'image/jpeg',
  })

  if (error) throw error

  return { bucket, path }
}