# 🏋️ Workout Performance & Coaching Dashboard

An intelligent, full-stack strength training analytics dashboard and AI coach built with **React**, **Vite**, **TailwindCSS**, **Supabase**, and **Vercel Serverless Functions** powered by **Google Gemini 3.5** and **Resend**.

---

## ⚡ Features Overview

### 1. 📊 Performance & Training Insights (`InsightsTab`)
* **AI Insight Digest**: Automated natural-language summary synthesized by Gemini with deterministic event annotations across all charts.
* **Volume by Muscle Group**: Stacked weekly bar chart with visual callouts and tooltips for neglected muscle groups.
* **Progressive Overload (Est. 1RM)**: Dynamic Epley 1RM curve with peak PR gold dots and automated plateau detection.
* **Fatigue & RPE Trend**: Trailing moving average RPE tracker with exertion spike alerts.
* **ACWR (Acute:Chronic Workload Ratio)**: Sweet spot vs. injury-risk zone bands (0.8–1.3 sweet spot, >1.5 danger zone).
* **Muscle Split Balance**: Interactive Radar Chart for set counts and volume stimulus across functional movement patterns.
* **Training Calendar Heatmap**: Interactive GitHub-style workout density grid.
* **Live Sortable Records Table**: Multi-column sorting and one-click CSV export.

### 2. 🧠 AI Decision Engine (`DecisionTab`)
* **Smart Next-Session Coach**: Recommends next muscle groups and specific split adjustments based on recovery state and recent load.
* **Mesocycle Block Assessment**: Synthesizes 4-week macro training cycle progress and recovery fatigue balance.
* **Muscle Balance & Symmetry**: Analyzes Push/Pull and Quad/Hamstring ratios to identify muscle group neglect.
* **Exercise Substitution Finder**: Suggests alternatives matched by mechanics, target muscles, and available equipment.
* **Training Goals**: Tracks body composition milestones with auto-achievement detection.

### 3. ⚖️ Body Composition & Scan OCR (`BodyCompositionTab`)
* **Scale Screenshot Extraction**: Gemini Vision OCR parses digital body composition scale screenshots (Renpho, Huawei Health, InBody, etc.) into structured metrics.
* **Longitudinal Trends**: Visualizes Weight, Muscle Mass %, Fat %, Visceral Fat, and BMR over time.

### 4. 📬 Automated Progress Newsletters (`ReportsTab` & Vercel Cron)
* **Automated Schedule**: Evaluated strictly in UTC via Vercel Crons:
  * **Weekly Digest**: Runs every Monday at 01:00 UTC (`0 1 * * 1`).
  * **Monthly Digest**: Runs on the 1st of every month at 01:00 UTC (`0 1 1 * *`).
* **HTML Email Template**: Clean, light-themed, single-column email with inline styles dispatched via **Resend**.
* **In-App Historical Archive**: Collapsible, dark-themed historical reports browser with performance metrics snapshots.
* **Idempotency**: Unique constraint on `(period_type, period_start)` prevents duplicate sends.

---

## 🏗️ Architecture & Tech Stack

* **Frontend**: React 18, Vite, TailwindCSS, Recharts, Lucide Icons.
* **Backend / API**: Vercel Serverless Functions (Node.js ESM in `api/`).
* **AI Intelligence**: Google Gemini API (`gemini-3.5-flash-lite`) server-side.
* **Email Delivery**: Resend API.
* **Database**: Supabase PostgreSQL with Row Level Security (RLS).
* **Testing**: Vitest unit test suite covering pure analytical utilities.

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/nana1506/workout_log.git
cd workout_log
npm install
```

### 2. Environment Variables Setup
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your credentials:
```env
# Supabase (Client & Serverless)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# AI Serverless Functions
GEMINI_API_KEY=your-gemini-api-key

# Progress Newsletter Delivery
RESEND_API_KEY=re_your_resend_key
RECIPIENT_EMAIL=your_email@example.com
CRON_SECRET=your_random_secret_token
```

### 3. Run Locally
```bash
# Start Vite development server
npm run dev

# Or test serverless API functions with Vercel CLI
vercel dev
```

### 4. Run Test Suite
```bash
npm test
```

---

## 🗄️ Database Schema (Supabase)

Execute the following in your **Supabase SQL Editor**:

```sql
-- 1. Progress Reports Table (Automated Newsletter Archive)
CREATE TABLE IF NOT EXISTS public.progress_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    recipient_email TEXT,
    subject TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT progress_reports_period_unique UNIQUE (period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_progress_reports_period_start ON public.progress_reports (period_start DESC);
CREATE INDEX IF NOT EXISTS idx_progress_reports_sent_at ON public.progress_reports (sent_at);

-- RLS Policies for progress_reports
ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read sent reports" 
ON public.progress_reports FOR SELECT TO anon, authenticated
USING (sent_at IS NOT NULL);

CREATE POLICY "Allow anon insert reports" 
ON public.progress_reports FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anon update reports" 
ON public.progress_reports FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);
```

---

## 🌐 Deploy to Vercel

1. Push your repository to GitHub.
2. Import the project on [Vercel](https://vercel.com).
3. Under **Project Settings → Environment Variables**, add:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
   * `GEMINI_API_KEY`
   * `RESEND_API_KEY`
   * `RECIPIENT_EMAIL`
   * `CRON_SECRET`
4. Deploy! Vercel will automatically configure the build and enable the scheduled crons defined in `vercel.json`.

---

## 🧪 Manual Newsletter Trigger

Test the automated newsletter endpoint anytime with your `CRON_SECRET`:

```bash
# Trigger Weekly Newsletter
curl -X POST "https://<your-vercel-domain>.vercel.app/api/send-progress-newsletter?period=weekly" \
  -H "Authorization: Bearer <CRON_SECRET>"

# Trigger Monthly Newsletter
curl -X POST "https://<your-vercel-domain>.vercel.app/api/send-progress-newsletter?period=monthly" \
  -H "Authorization: Bearer <CRON_SECRET>"
```
