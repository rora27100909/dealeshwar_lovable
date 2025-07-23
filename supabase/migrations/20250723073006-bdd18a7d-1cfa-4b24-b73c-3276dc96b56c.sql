-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a daily cron job to scrape prices (runs every day at 9 AM IST)
SELECT cron.schedule(
  'daily-price-scraper',
  '30 3 * * *', -- 3:30 AM UTC = 9:00 AM IST
  $$
  SELECT
    net.http_post(
        url:='https://nvoconkfclyboxzrqxyu.supabase.co/functions/v1/daily-price-scraper',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52b2NvbmtmY2x5Ym94enJxeHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjkwNDAwOCwiZXhwIjoyMDY4NDgwMDA4fQ.Xg8xo4NI9PJ8wQWgk1dGHFBK1lH9lKl8QwT_bNYy8qM"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);