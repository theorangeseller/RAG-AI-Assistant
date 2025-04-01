# AI Chatbot Interface

A modern AI chatbot interface powered by OpenAI GPT-4, built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- User authentication with Google and Microsoft accounts
- OAuth 2.0, JWT, and Email/Password authentication
- Real-time chat interface with GPT-4
- Chat history for authenticated users
- Responsive and modern UI design
- Secure data storage with Supabase
- RAG chatbot using Langchain and OpenAI Embedding SDK

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- Next Auth
- Supabase
- OpenAI GPT-4
- Langchain
- OpenAI Embedding SDK
- ChromaDB

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-chatbot-interface
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment variables file and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

4. Set up your environment variables in `.env.local`:
   - Configure OAuth providers (Google and Microsoft)
   - Set up Supabase credentials
   - Add your OpenAI API key


## Database Setup

1. Create a new project in Supabase
2. Create the following table:

```