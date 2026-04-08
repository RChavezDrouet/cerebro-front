/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string

  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string

  // Tenant gate
  readonly VITE_TENANT_PAUSED_MESSAGE?: string

  // Attendance PWA tuning
  readonly VITE_GEO_MAX_METERS?: string
  readonly VITE_MIN_GPS_ACCURACY?: string
  readonly VITE_FACE_THRESHOLD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
