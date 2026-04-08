// =============================================
// HRCloud Attendance PWA - Storage Helpers
// =============================================

import { supabase } from './supabase'

export async function uploadSelfie(options: {
  bucket?: 'punch-selfies' | 'employee-photos'
  path: string
  blob: Blob
}): Promise<{ path: string }>
{
  const bucket = options.bucket ?? 'punch-selfies'
  const { error } = await supabase.storage
    .from(bucket)
    .upload(options.path, options.blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    })

  if (error) throw error
  return { path: options.path }
}
