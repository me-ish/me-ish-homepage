// Extend the Phase 0B disposable app with actual post-improvement read/render paths.
// Run only after the accepted Phase 5, Phase 6B and Phase 7 caption are integrated.
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const input = process.argv[2];
if (process.argv.length !== 3 || !input || !isAbsolute(input)
  || basename(input) !== 'browser-app'
  || !/^natori-phase-t\.[A-Za-z0-9_-]+$/.test(basename(dirname(input)))) {
  throw new Error('DEDICATED_DIRECTORY_REQUIRED');
}
if (process.env.PHASE_7_BROWSER !== 'ephemeral') throw new Error('PHASE_7_EPHEMERAL_REQUIRED');
const output = resolve(input);
if (lstatSync(output).isSymbolicLink() || realpathSync(output) !== output) throw new Error('DEDICATED_REAL_DIRECTORY_REQUIRED');
const repo = process.cwd();
const checksumPath = resolve(output, 'source-checksums.json');
if (lstatSync(checksumPath).isSymbolicLink()) throw new Error('CHECKSUM_FILE_REQUIRED');
const checksums = JSON.parse(readFileSync(checksumPath, 'utf8'));
if (!checksums || typeof checksums !== 'object' || Array.isArray(checksums)) throw new Error('CHECKSUM_MAP_REQUIRED');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const normalizedHash = (value) => hash(value.toString('utf8').replaceAll('\r\n', '\n'));
const sourceText = (path) => readFileSync(resolve(repo, path), 'utf8');
const actualSourceSignatures = {};

// These are accepted DTO/read-view boundaries, not proposal overlays. Refuse an
// earlier product snapshot rather than silently supplying missing behavior here.
const accepted6B = {
  'src/features/natori/types/portfolioDisplay.ts': 'b090d1b28add14c7b1d7328f696398c2b10b9da3c8684e3e6833bfcbc82ab804',
  'src/features/natori/lib/portfolioDisplay.ts': 'd6e9bd67eeb43992256b1d82715aab52c7bc105daccade9f2a1277906e8d1504',
  'src/features/natori/lib/portfolioWorkflow.ts': '2d753da668722aa2288ee927acd1332d7e81da7566c38e48fa94b0cb4b46b742',
  'src/features/natori/components/portfolio/PortfolioWorkflow.tsx': 'ec4b7609fedb013bff36e07e889487912bfa52141041d118e2504bcd35138324',
};
for (const [path, expected] of Object.entries(accepted6B)) {
  if (normalizedHash(readFileSync(resolve(repo, path))) !== expected) throw new Error(`ACCEPTED_PHASE_6B_REQUIRED: ${path}`);
}
// Verify the durable false-only save boundary as exact scoped blocks, so prior
// phases can retain unrelated normalization fields without an overlay here.
const acceptedSaveSuppressionBlocks = {
  'src/features/natori/types/portfolio.ts': ["  workflowCompatibilityProjection?: false;"],
  'src/features/natori/lib/portfolioContent.ts': [
    'import { isPortfolioWorkflowProjectionEligible } from "./portfolioWorkflow";',
    '  workflowCompatibilityProjection: z.literal(false).optional().catch(undefined),',
    '  const result = portfolioContentSchema.safeParse(value);\n  if (!result.success) return null;\n  // Preserve an explicit negative preference, or raw ineligibility that normalization\n  // would otherwise erase. Distinct custom workflows keep their original shape.\n  const { workflowCompatibilityProjection, ...content } = result.data;\n  const rawContent = value !== null && typeof value === "object" && !Array.isArray(value)\n    ? value as Record<string, unknown> : null;\n  const suppressCompatibilityProjection = workflowCompatibilityProjection === false\n    || rawContent?.workflowProjectionAllowed === false\n    || (!isPortfolioWorkflowProjectionEligible(rawContent?.workflow)\n      && isPortfolioWorkflowProjectionEligible(content.workflow));\n  return withCanonicalHeroImages(withNaturalNatoriHeroTitle({\n    ...content,\n    ...(suppressCompatibilityProjection ? { workflowCompatibilityProjection: false as const } : {}),\n  }));',
  ],
};
for (const [path, blocks] of Object.entries(acceptedSaveSuppressionBlocks)) {
  const text = sourceText(path).replaceAll('\r\n', '\n');
  for (const block of blocks) if (text.split(block).length !== 2) throw new Error('ACCEPTED_PHASE_6B_SAVE_SUPPRESSION_REQUIRED');
}
const acceptedReaderBlocks = [
  "import { defaultPortfolioDisplayContent, parsePortfolioDisplayContent } from \"@/features/natori/lib/portfolioDisplay\";\nimport type { PortfolioDisplayContent } from \"@/features/natori/types/portfolioDisplay\";",
  "export async function loadPortfolioContent(): Promise<PortfolioDisplayContent> {\n  try {\n    const admin = adminClient();\n    const { data, error } = await admin\n      .from(TABLE)\n      .select(\"content\")\n      .eq(\"id\", ROW_ID)\n      .maybeSingle();\n    if (error) {\n      console.error(\"[natori-portfolio] content load failed:\", error);\n      return defaultPortfolioDisplayContent();\n    }\n    if (!data) return defaultPortfolioDisplayContent();\n    return parsePortfolioDisplayContent(data.content) ?? defaultPortfolioDisplayContent();\n  } catch (err) {\n    console.error(\"[natori-portfolio] content load threw:\", err);\n    return defaultPortfolioDisplayContent();\n  }\n}\n"
];
const actualReader = sourceText('src/features/natori/server/portfolioSiteService.ts').replaceAll('\r\n', '\n');
for (const block of acceptedReaderBlocks) if (actualReader.split(block).length !== 2) throw new Error('ACCEPTED_PHASE_6B_READER_BLOCK_REQUIRED');
const journey = sourceText('src/features/natori/components/dashboard/EstimateJourney.tsx');
if (!journey.includes('href="/natori/dashboard"') || !journey.includes('← ダッシュボードへ戻る')
  || journey.includes('← 案件管理へ戻る')) throw new Error('APPLIED_PHASE_7_CAPTION_REQUIRED');
if (!sourceText('src/features/natori/components/portfolio/PortfolioStructuredCommissionForm.tsx').includes('portfolioConfirmationSections')
  || !sourceText('src/features/natori/lib/requestPresentation.ts').includes('formatNatoriRequestDate')) {
  throw new Error('APPLIED_PHASE_5_CONFIRMATION_REQUIRED');
}

function copyActual(path) {
  const source = resolve(repo, path);
  if (lstatSync(source).isSymbolicLink()) throw new Error(`SOURCE_SYMLINK_REVIEW_REQUIRED: ${path}`);
  const destination = resolve(output, path);
  if (!destination.startsWith(output + sep)) throw new Error('FIXTURE_PATH_REQUIRED');
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  checksums[path] = hash(readFileSync(source));
  actualSourceSignatures[path] = checksums[path];
}
function copySourceTree(path) {
  for (const entry of readdirSync(resolve(repo, path), { withFileTypes: true })) {
    if (entry.name.startsWith('.env') || entry.name === '__tests__') continue;
    const child = `${path}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`SOURCE_SYMLINK_REVIEW_REQUIRED: ${child}`);
    if (entry.isDirectory()) copySourceTree(child);
    else if (/\.(?:tsx?|jsx?|mjs|cjs|css|json)$/.test(entry.name)) copyActual(child);
  }
}
// The base app's test-only shell/auth remains intact. Product code is copied
// exclusively from the integrated repository, including the actual font module.
for (const tree of ['components', 'features', 'hooks', 'i18n', 'lib', 'styles', 'types']) copySourceTree(`src/${tree}`);
for (const path of [
  'src/app/api/natori/admin/projects/route.ts',
  'src/app/api/natori/admin/estimate-draft/route.ts',
  'src/app/api/natori/admin/structured-quote/route.ts',
  'src/app/[locale]/natori/portfolio/page.tsx',
  'src/app/[locale]/natori/portfolio/contact/page.tsx',
  'src/app/[locale]/natori/works/page.tsx',
  'src/app/[locale]/natori/quote/[token]/page.tsx',
]) copyActual(path);

const generated = {};
function fixture(path, text) {
  const destination = resolve(output, path);
  if (!destination.startsWith(output + sep)) throw new Error('FIXTURE_PATH_REQUIRED');
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, text);
  generated[path] = hash(readFileSync(destination));
  checksums[path] = generated[path];
}
const fixtureRoot = 'src/app/[locale]/fixture-phase7';
fixture(`${fixtureRoot}/fixtureReads.ts`, `import 'server-only';
import { loadPortfolioContent } from '@/features/natori/server/portfolioSiteService';
import { resolveNatoriManagementContext } from '@/features/natori/server/natoriOwner';
import type { PortfolioDisplayContent } from '@/features/natori/types/portfolioDisplay';

export function assertPhase7Fixture(): void {
  if (process.env.PHASE_7_BROWSER !== 'ephemeral') throw new Error('Phase 7 fixture disabled');
}
export async function readPhase7Content(): Promise<PortfolioDisplayContent> {
  assertPhase7Fixture();
  const content = await loadPortfolioContent();
  const seeded = content.works.length === 8 && content.works.every((work) => {
    const match = /^phase7-work-([1-8])$/.exec(work.id);
    return match && work.title === 'Phase 7 synthetic work ' + match[1]
      && work.image === '/phase7-art/work-' + match[1] + '.svg' && work.published;
  });
  if (!seeded || content.workflowProjectionAllowed !== true) throw new Error('Phase 7 seeded display read required');
  return content;
}
export async function readPhase7OwnerProjectId(surface: 'estimate' | 'management'): Promise<string> {
  assertPhase7Fixture();
  await resolveNatoriManagementContext();
  const id = surface === 'estimate' ? process.env.PHASE_7_ESTIMATE_PROJECT_ID : process.env.PHASE_7_MANAGEMENT_PROJECT_ID;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Phase 7 synthetic project id required');
  }
  return id;
}
`);
fixture(`${fixtureRoot}/OwnerScreen.tsx`, `"use client";
import { useEffect, useState } from 'react';
import EstimateJourney from '@/features/natori/components/dashboard/EstimateJourney';
import ProjectCard from '@/features/natori/components/dashboard/ProjectCard';
import { fetchNatoriProjectCollection } from '@/features/natori/data/supabaseProjects';
import type { NatoriProject } from '@/features/natori/types/projects';
import type { PortfolioDisplayContent } from '@/features/natori/types/portfolioDisplay';

export default function OwnerScreen({ surface, projectId, portfolioContent }: {
  surface: 'estimate' | 'management'; projectId: string; portfolioContent: PortfolioDisplayContent;
}) {
  const [project, setProject] = useState<NatoriProject | null>(null);
  const [failed, setFailed] = useState(false);
  const [control, setControl] = useState('');
  useEffect(() => {
    let mounted = true;
    void fetchNatoriProjectCollection(projectId).then(({ projects }) => {
      if (!mounted) return;
      const entry = projects.find((candidate) => candidate.id === projectId);
      if (entry) setProject(entry); else setFailed(true);
    }).catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, [projectId]);
  if (failed) return <p role="alert">Phase 7 actual owner project read failed</p>;
  if (!project) return <p role="status">Loading Phase 7 owner project</p>;
  if (surface === 'estimate') return <EstimateJourney project={project} portfolioContent={portfolioContent} />;
  // Callback feedback is fixture-local only. It preserves the controls for screen
  // inspection and makes no claim to verify their production mutation semantics.
  return <>
    <ProjectCard project={project} today={new Date('2026-10-02T03:00:00Z')}
      onToggleTask={(_, taskId) => setControl('Task control: ' + taskId)}
      onAdvanceStatus={() => setControl('Advance control')}
      onConfirmPayment={() => setControl('Payment control')}
      onOpenMail={(_, kind) => setControl('Mail control: ' + kind)}
      onEditDetails={async () => { throw new Error('Phase 7 capture does not update project details'); }} />
    <p role="status" className="mt-3 text-sm text-gray-600">{control}</p>
  </>;
}
`);
for (const [surface, variant] of [['gallery', 'full'], ['showcase', 'showcase']]) {
  fixture(`${fixtureRoot}/${surface}/page.tsx`, `import PortfolioLanding from '@/features/natori/components/portfolio/PortfolioLanding';
import { readPhase7Content } from '../fixtureReads';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const content = await readPhase7Content();
  return <div aria-label="Phase 7 ${surface}" data-phase7-surface="${surface}"><PortfolioLanding content={content} variant="${variant}" structuredIntake /></div>;
}
`);
}
fixture(`${fixtureRoot}/intake/page.tsx`, `import PortfolioContactPage from '@/features/natori/components/portfolio/PortfolioContactPage';
import { readPhase7Content } from '../fixtureReads';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const content = await readPhase7Content();
  return <div aria-label="Phase 7 intake" data-phase7-surface="intake"><PortfolioContactPage content={content} mode="quote" structuredIntake /></div>;
}
`);
for (const surface of ['estimate', 'management']) {
  fixture(`${fixtureRoot}/${surface}/page.tsx`, `import OwnerScreen from '../OwnerScreen';
import { readPhase7Content, readPhase7OwnerProjectId } from '../fixtureReads';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const projectId = await readPhase7OwnerProjectId('${surface}');
  const content = await readPhase7Content();${surface === 'management' ? "\n  const paymentProjectId = await readPhase7OwnerProjectId('estimate');" : ''}
  return <main aria-label="Phase 7 ${surface}" data-phase7-surface="${surface}" className="min-h-screen bg-gray-50 px-4 py-6"><div className="mx-auto max-w-3xl"><OwnerScreen surface="${surface}" projectId={projectId} portfolioContent={content} />${surface === 'management' ? '<div className="mt-6"><OwnerScreen surface="management" projectId={paymentProjectId} portfolioContent={content} /></div>' : ''}</div></main>;
}
`);
}
fixture(`${fixtureRoot}/quote/[token]/page.tsx`, `import QuoteAcceptPage from '../../../natori/quote/[token]/page';
import { assertPhase7Fixture } from '../../fixtureReads';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  assertPhase7Fixture();
  return <div aria-label="Phase 7 quote" data-phase7-surface="quote"><QuoteAcceptPage params={params} /></div>;
}
`);

const palettes = [['#ffd6e4', '#bce9f5'], ['#d9cafa', '#fff0c8'], ['#c4ead4', '#ffd2e2']];
for (let index = 1; index <= 8; index++) {
  const [paper, accent] = palettes[(index - 1) % palettes.length];
  fixture(`public/phase7-art/work-${index}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960" role="img" aria-labelledby="title desc"><title id="title">Phase 7 synthetic work ${index}</title><desc id="desc">Synthetic geometric artwork for layout evidence; not the artist's artwork.</desc><rect width="720" height="960" fill="${paper}"/><circle cx="360" cy="360" r="240" fill="${accent}"/><path d="M70 830L360 490L650 830Z" fill="#fffaf3"/><circle cx="180" cy="180" r="50" fill="#fffaf3"/><circle cx="545" cy="200" r="28" fill="#fffaf3"/><text x="360" y="905" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#51404f">SYNTHETIC WORK ${index}</text></svg>\n`);
}
const contract = {
  kind: 'phase7-actual-read-and-render-screen-fixture',
  source: 'integrated repository only; no prepared-product overlay',
  accepted6B_normalized_sha256: accepted6B,
  generated_fixture_sha256: generated,
  actual_source_sha256: actualSourceSignatures,
  routes: ['gallery', 'showcase', 'intake', 'estimate', 'management'].map((surface) => ({ surface, path: `/ja/fixture-phase7/${surface}`, label: `Phase 7 ${surface}` })),
  quote: { path: '/ja/fixture-phase7/quote/<synthetic-token>', label: 'Phase 7 quote', reader: 'unchanged actual QuoteAcceptPage -> getNatoriQuoteByToken' },
  capture_widths: [1280, 360, 390],
  project_id_variables: ['PHASE_7_ESTIMATE_PROJECT_ID', 'PHASE_7_MANAGEMENT_PROJECT_ID'],
  management_today: '2026-10-02T03:00:00Z',
  limitations: ['Synthetic art does not establish artist preference.', 'Management callback feedback verifies display only.', 'Offline font transport is configured by the runner and must be disclosed in screen evidence.'],
};
fixture('phase7-surface-contract.json', JSON.stringify(contract, null, 2) + '\n');
writeFileSync(checksumPath, JSON.stringify(checksums, null, 2) + '\n');
console.log('Prepared Phase 7 actual read/render surfaces and declared synthetic artwork');
