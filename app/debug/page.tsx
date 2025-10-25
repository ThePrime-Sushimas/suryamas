// app/debug/page.tsx
export default function DebugPage() {
    return (
      <div className="p-6">
        <h1>Debug Info</h1>
        <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
        <p>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
        <p>Node Env: {process.env.NODE_ENV}</p>
      </div>
    )
  }