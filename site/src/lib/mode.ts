// vps-migration: Supabase removed — source mode from Vite instead of PUBLIC_MODE.
export const mode = import.meta.env.MODE as 'development' | 'production'
