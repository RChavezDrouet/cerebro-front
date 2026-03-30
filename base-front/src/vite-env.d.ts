/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_AUTH_BYPASS?: string
  readonly VITE_DISABLE_LOGIN?: string
  readonly VITE_TENANT_GATE_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "zxcvbn" {
  const zxcvbn: (password: string) => { score: number }
  export default zxcvbn
}
