import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function isSet(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0
}

export async function GET(req: NextRequest) {
  const keysOfInterest = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_NEXTAUTH_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'MICROSOFT_TENANT_ID',
    'OPENAI_API_KEY',
  ] as const

  // Safe-only diagnostics: report presence, never values.
  const envPresence = Object.fromEntries(
    keysOfInterest.map((key) => [key, isSet(process.env[key]) ? 'SET' : 'MISSING'])
  )

  // Also surface similarly named keys to catch typos/mismatches.
  const relevantRuntimeKeys = Object.keys(process.env)
    .filter((k) =>
      /(NEXTAUTH|SUPABASE|GOOGLE_CLIENT|MICROSOFT_CLIENT|MICROSOFT_TENANT|OPENAI_API)/.test(k)
    )
    .sort()

  return NextResponse.json(
    {
      ok: true,
      note: 'Temporary safe diagnostics endpoint. Returns env presence only (no secret values).',
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
      request: {
        host: req.headers.get('host'),
        xForwardedHost: req.headers.get('x-forwarded-host'),
        xForwardedProto: req.headers.get('x-forwarded-proto'),
      },
      envPresence,
      relevantRuntimeKeys,
    },
    { status: 200 }
  )
}
