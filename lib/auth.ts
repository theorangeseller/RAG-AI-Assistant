import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
const hasSupabaseCredentialsAuth = !!(supabaseUrl && supabaseKey)

if (!hasSupabaseCredentialsAuth) {
  console.warn(
    'Supabase credentials auth disabled: missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. OAuth providers can still be used.'
  )
}

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    return null
  }
  return createClient(supabaseUrl, supabaseKey)
}

// Only add OAuth providers when env vars are set (avoids 500 on sign-in in production)
const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const hasMicrosoft = !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)

const providers: NextAuthOptions['providers'] = [
  ...(hasMicrosoft
    ? [
        AzureADProvider({
          clientId: process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
          tenantId: process.env.MICROSOFT_TENANT_ID,
        }),
      ]
    : []),
  ...(hasGoogle
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  ...(hasSupabaseCredentialsAuth
    ? [
        CredentialsProvider({
          name: 'Credentials',
          credentials: {
            email: { label: 'Email', type: 'email' },
            password: { label: 'Password', type: 'password' },
          },
          async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) {
              throw new Error('Please enter your email and password')
            }

            const supabase = getSupabaseClient()
            if (!supabase) {
              throw new Error('Email/password sign-in is temporarily unavailable')
            }

            try {
              const {
                data: { user },
                error,
              } = await supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password,
              })

              if (error) {
                console.error('Supabase auth error:', error)
                throw new Error(error.message)
              }

              if (!user) {
                throw new Error('No user found')
              }

              // Optional profile lookup; gracefully fallback if table does not exist.
              let profile: { full_name?: string; avatar_url?: string } | null = null
              const { data: profileData, error: profileError } = await supabase
                .from('users')
                .select('full_name, avatar_url')
                .eq('id', user.id)
                .maybeSingle()
              if (!profileError) profile = profileData

              return {
                id: user.id,
                email: user.email ?? undefined,
                name: user.user_metadata?.full_name ?? profile?.full_name ?? user.email ?? undefined,
                image: profile?.avatar_url ?? user.user_metadata?.avatar_url,
              }
            } catch (error) {
              console.error('Auth error:', error)
              throw error
            }
          },
        }),
      ]
    : []),
]

export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.picture as string
      }
      return session
    }
  },
  session: {
    strategy: 'jwt',
  },
  secret: (() => {
    const secret = process.env.NEXTAUTH_SECRET || process.env.NEXT_PUBLIC_NEXTAUTH_SECRET
    if (!secret && process.env.NODE_ENV === 'production') {
      console.error('NEXTAUTH_SECRET is required in production. Set it in Amplify Environment variables.')
    }
    return secret
  })(),
  debug: process.env.NODE_ENV === 'development',
} 