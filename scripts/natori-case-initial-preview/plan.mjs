// Nonsecret, single-purpose deployment manifest. Never used by normal builds.
export const plan = Object.freeze({
  target: {
    profile: 'hosted', ref: 'vflqlsmblwiwrukjwwec',
    project: 'prj_naQn1RrcnOGk6PcNCZsWOTuFuENz',
    url: 'https://vflqlsmblwiwrukjwwec.supabase.co',
    origin: 'https://natori-case-readonly-20261024.vercel.app',
    run: 'b37c7c45-e642-4bab-a973-9d44289a5765',
    startsAt: '2026-10-23T23:30:00Z', endsAt: '2026-10-25T00:00:00Z',
  },
  actors: {
    owner: { id: '16018e8a-f04a-4dd3-a95c-a0a0354af590', email: 'natori-readonly-owner@example.invalid' },
    staff: { id: '6e0e3666-01b2-4ca4-a98a-2a7be9c020a2', email: 'natori-readonly-staff@example.invalid' },
    outsider: { id: '2be65488-a1dd-47a7-9344-27b9bdb4aa4a', email: 'natori-readonly-outsider@example.invalid' },
  },
  projects: {
    registered: 'e1627560-76b7-4f7a-9641-88610fa66f96',
    unregistered: '7b6a61aa-4752-4b48-9082-e47bdc9ce41a',
    foreign: 'a0f1ef44-997a-44b6-b2d0-09fc5e374920',
  },
  quote: 'aa139da7-3f08-40c3-8af6-c34557485bb2',
  // Exact synthetic timeline for this single-purpose fixture. Keep the actual
  // creation instants observed in the dedicated DB; any existing correction
  // remains a separate, approved operation, never setup/preflight repair.
  fixtureTimes: {
    projectCreatedAt: '2026-10-24T02:22:50.314355Z',
    quoteCreatedAt: '2026-10-24T02:22:50.910864Z',
    issuedAt: '2026-10-24T02:22:50.910864Z',
    acceptedAt: '2026-10-24T02:22:52.306408Z',
  },
  scope: 'synthetic-initial-readonly-no-mail', account: 'acct_syntheticInitialReadOnly',
});
