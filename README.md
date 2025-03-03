# AI Chatbot Interface

A modern AI chatbot interface powered by Grok AI, built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- User authentication with Google and Microsoft accounts
- OAuth 2.0, JWT, and Email/Password authentication
- Real-time chat interface with Grok AI
- Chat history for authenticated users
- Responsive and modern UI design
- Secure data storage with Supabase

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- Next Auth
- Supabase
- Vercel AI SDK
- Grok AI API

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
   - Add your Grok API key

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

1. Create a new project in Supabase
2. Create the following table:

```sql
create table messages (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  message text not null,
  response text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table messages enable row level security;

-- Create policy to allow users to read their own messages
create policy "Users can read their own messages"
  on messages for select
  using (auth.uid()::text = user_id);

-- Create policy to allow users to insert their own messages
create policy "Users can insert their own messages"
  on messages for insert
  with check (auth.uid()::text = user_id);
```


## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 