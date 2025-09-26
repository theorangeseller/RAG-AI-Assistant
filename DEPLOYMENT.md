# RAG Chatbot Deployment Guide

This guide will help you deploy your RAG chatbot application with Supabase backend and automated CI/CD deployment.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Repo   │───▶│  GitHub Actions │───▶│ Vercel/AWS Host │
│                 │    │     CI/CD       │    │   (Frontend)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │    Supabase     │
                                               │ • PostgreSQL    │
                                               │ • pgvector      │
                                               │ • File Storage  │
                                               │ • Authentication│
                                               └─────────────────┘
```

## 📋 Prerequisites

- GitHub repository with your code
- Supabase account (free tier available)
- Vercel account (recommended) or AWS account
- OpenAI API key
- Google/Microsoft OAuth credentials (optional)

## 🚀 Step-by-Step Deployment

### Step 1: Supabase Setup

#### 1.1 Create Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `rag-chatbot`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for project initialization (2-3 minutes)

#### 1.2 Enable pgvector Extension
1. Go to **SQL Editor** in your Supabase dashboard
2. Run this SQL to enable pgvector:

```sql
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 1.3 Create Database Tables
Run this complete SQL script in the **SQL Editor**:

```sql
-- Documents table (updated for NextAuth compatibility)
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  content_hash TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT NOT NULL, -- TEXT for NextAuth user IDs
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Document chunks table with vector embeddings
CREATE TABLE document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_document_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
```

#### 1.4 Create Storage Bucket
```sql
-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);
```

#### 1.5 Set Up Row Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Updated policies for NextAuth compatibility (TEXT user_id)
CREATE POLICY "Allow service role full access to documents" ON documents
  FOR ALL USING (true); -- Service role bypasses RLS

CREATE POLICY "Allow service role full access to chunks" ON document_chunks
  FOR ALL USING (true); -- Service role bypasses RLS

```

#### 1.6 Create Vector Search Function
```sql
-- Vector search function for user-scoped queries
CREATE OR REPLACE FUNCTION match_documents_for_user (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  user_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER -- Allows service role to bypass RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.user_id = match_documents_for_user.user_id
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

#### 1.7 Set Up Storage Policies
```sql
-- Simplified storage policies for service role access
CREATE POLICY "Allow service role full access to documents bucket" ON storage.objects
  FOR ALL USING (bucket_id = 'documents');

CREATE POLICY "Allow authenticated users access to documents bucket" ON storage.objects
  FOR ALL USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

#### 1.8 Get Supabase Credentials
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### Step 2: Choose Deployment Platform

You have three options for hosting your Next.js application:

## Option A: Vercel (Recommended) ⭐

Vercel is the easiest and most optimized platform for Next.js applications.

#### 2.1 Create Vercel Account
1. Go to [Vercel](https://vercel.com)
2. Sign up with GitHub
3. Import your repository

#### 2.2 Configure Environment Variables
In Vercel dashboard, go to **Settings** → **Environment Variables** and add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-api-key
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=your-microsoft-tenant-id
```

#### 2.3 Deploy
1. Click **Deploy** in Vercel dashboard
2. Your app will be live at `https://your-app.vercel.app`

## Option B: AWS Amplify

#### 2.1 Create Amplify App
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Connect your GitHub repository
4. Choose branch: `main` or `master`

#### 2.2 Configure Build Settings
Amplify will auto-detect Next.js, but you can customize:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

#### 2.3 Set Environment Variables
In Amplify console, go to **Environment variables** and add the same variables as Vercel.

#### 2.4 Deploy
1. Click "Save and deploy"
2. Your app will be live at `https://main.d1234567890.amplifyapp.com`

## Option C: AWS S3 + CloudFront

#### 2.1 Create S3 Bucket
1. Go to [S3 Console](https://console.aws.amazon.com/s3/)
2. Create bucket with your domain name
3. Enable static website hosting
4. Set bucket policy for public read access

#### 2.2 Create CloudFront Distribution
1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Create distribution
3. Set S3 bucket as origin
4. Configure custom domain (optional)

#### 2.3 Build and Deploy
```bash
# Build the application
npm run build
npm run export

# Upload to S3
aws s3 sync out/ s3://your-bucket-name --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Step 3: GitHub Actions Setup

#### 3.1 Add Repository Secrets
Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

**Required for all deployments:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

**For OAuth (optional):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`

**For Vercel deployment:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

**For AWS deployment:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AMPLIFY_APP_ID` (for Amplify)
- `S3_BUCKET_NAME` (for S3)
- `CLOUDFRONT_DISTRIBUTION_ID` (for S3)

#### 3.2 Get Vercel Credentials (if using Vercel)
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Link project: `vercel link`
4. Get credentials:
   - Token: `vercel token`
   - Org ID: Check `.vercel/project.json`
   - Project ID: Check `.vercel/project.json`

#### 3.3 Get AWS Credentials (if using AWS)
1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Create user with programmatic access
3. Attach policies:
   - `AmplifyFullAccess` (for Amplify)
   - `AmazonS3FullAccess` (for S3)
   - `CloudFrontFullAccess` (for CloudFront)
4. Save access key and secret

### Step 4: Configure Environment Variables

#### 4.1 Local Development Environment
Create `.env.local` for local development:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# NextAuth
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=http://localhost:3000

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=your-microsoft-tenant-id
```

### Step 5: Test Deployment

#### 5.1 Local Testing
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test the application
# - Sign up/Sign in
# - Upload a document
# - Ask questions about the document
```

#### 5.2 Production Testing
1. Push code to main branch
2. Check GitHub Actions workflow
3. Verify deployment is successful
4. Test all functionality on production URL

## 🔧 Troubleshooting

### Common Issues

#### 1. Build Failures
- Check all environment variables are set
- Verify Node.js version compatibility
- Check for TypeScript errors

#### 2. Supabase Connection Issues
- Verify project URL and keys
- Check RLS policies
- Ensure pgvector extension is enabled

#### 3. File Upload Issues
- Check storage bucket exists
- Verify storage policies
- Check file size limits

#### 4. Vector Search Issues
- Ensure embeddings are generated correctly
- Check vector search function exists
- Verify similarity threshold

### Debug Commands

```bash
# Check Supabase connection
npx supabase status

# Test vector search
npx supabase db reset

# Check logs
vercel logs your-deployment-url
```

## 📊 Monitoring and Maintenance

### 1. Set Up Monitoring
- **Vercel Analytics**: Built-in performance monitoring
- **Supabase Dashboard**: Database and storage metrics
- **GitHub Actions**: Deployment status

### 2. Regular Maintenance
- Update dependencies monthly
- Monitor Supabase usage and costs
- Review and optimize vector search performance
- Backup important data

### 3. Scaling Considerations
- **Supabase**: Upgrade plan as usage grows
- **Vercel**: Pro plan for higher limits
- **OpenAI**: Monitor API usage and costs

## 💰 Cost Estimation

### Monthly Costs (approximate)

**Supabase:**
- **Free tier**: $0 (up to 500MB database, 1GB storage, 2GB bandwidth)
- **Pro**: $25/month (8GB database, 100GB storage, 250GB bandwidth)

**Vercel:**
- **Free tier**: $0 (100GB bandwidth, 100 serverless function executions)
- **Pro**: $20/month (1TB bandwidth, unlimited functions)

**OpenAI API:**
- **GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Embeddings**: ~$0.10 per 1M tokens

**Typical Usage Costs:**
- **Development/Testing**: $0/month (free tiers)
- **Small Production**: $0-10/month
- **Medium Production**: $25-50/month
- **High Usage**: $50+/month

**Total estimated cost: $0-50/month** for most use cases.

## 🎉 You're Done!

Your RAG chatbot is now deployed and ready to use! 

### **What You Have:**
- ✅ **Frontend**: Next.js app hosted on Vercel/AWS
- ✅ **Database**: PostgreSQL with pgvector for semantic search
- ✅ **File Storage**: Supabase Storage for documents
- ✅ **Authentication**: NextAuth.js with Google/Microsoft OAuth
- ✅ **AI Models**: GPT-4o-mini for chat, OpenAI embeddings for vectors
- ✅ **CI/CD**: Automated deployment via GitHub Actions
- ✅ **Monitoring**: Built-in dashboards and analytics

### **Key Features:**
- 📁 **Multi-format document upload** (PDF, Word, Excel, CSV, etc.)
- 🔍 **Semantic search** with vector similarity
- 💬 **Intelligent chat** that knows when to use documents vs. general knowledge
- 👤 **User isolation** - each user sees only their own documents
- 🔒 **Secure authentication** with OAuth providers
- 📱 **Responsive UI** that works on all devices

### **Next Steps:**
1. **Upload documents** through the chat interface
2. **Ask questions** about your uploaded content
3. **Monitor usage** through Supabase and Vercel dashboards
4. **Scale up** plans as your usage grows

The application will automatically deploy whenever you push code to the main branch. Enjoy your AI-powered document assistant! 🚀
