SELECT jsonb_build_object(
  'natori_projects', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.natori_projects t),
  'natori_payments', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.natori_payments t),
  'stripe', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.processed_stripe_events t),
  'entries', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.entries t),
  'auth', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM auth.users t),
  'objects', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM storage.objects t),
  'natori_buckets', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM storage.buckets t WHERE id LIKE 'natori-%')
);
