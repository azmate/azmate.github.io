// TURN server (optional, improves online connections on mobile networks).
// Get credentials from a TURN provider and add, for example:
// { urls: 'turn:YOUR_HOST:3478', username: 'USER', credential: 'PASS' }
window.AZ_ICE = [];

// Supabase (login / accounts). The anon key is public by design; data is protected by RLS.
window.AZ_SUPABASE = {
  url: 'https://uohvdtjekmnahgctxfsz.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaHZkdGpla21uYWhnY3R4ZnN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNzc3NTUsImV4cCI6MjExMDg1Mzc1NX0.GZtw7OVJB21k4BXynceItHKG-tjnvtALw46vVTm8nSM'
};
