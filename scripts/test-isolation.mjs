// Applies before every Node test worker. Environment changes stay in test
// processes; subsequent workflow steps still receive their GitHub Secrets.
for (const name of Object.keys(process.env)) {
  if (/(?:_API_KEY|_API_TOKEN|_SERVICE_ROLE_KEY|_CLIENT_SECRET|_REFRESH_TOKEN)$/.test(name) || ['CLOUDFLARE_ACCOUNT_ID','YOUTUBE_CLIENT_ID','SUPABASE_URL','GH_TOKEN','GITHUB_TOKEN','FREE_QUOTA_LEDGER_PATH','CLOUDFLARE_PLAN','CLOUDFLARE_PAID_MONTHLY_CAP_USD','CLOUDFLARE_FREE_PLAN_CONFIRMED'].includes(name)) delete process.env[name];
}
