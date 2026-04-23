/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GRAPHQL_URI: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
