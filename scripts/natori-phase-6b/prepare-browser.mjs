import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

// Run only against the existing disposable Phase T browser-app snapshot.
const output = process.argv[2];
if (process.env.PHASE_6B_BROWSER !== 'ephemeral') throw new Error('EPHEMERAL_REQUIRED');
if (!output || !/[\\/]natori-phase-(?:t|6b)\.[^\\/]+[\\/]browser-app$/.test(output)) throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const target = realpathSync(output);
if (target === realpathSync(process.cwd())) throw new Error('LIVE_DIRECTORY_REJECTED');
const checksumPath = resolve(target, 'source-checksums.json');
if (!existsSync(checksumPath)) throw new Error('VERIFIED_APP_SNAPSHOT_REQUIRED');
const checksums = JSON.parse(readFileSync(checksumPath, 'utf8'));
const put = (name, text) => {
  const path = resolve(target, name);
  if (!path.startsWith(target + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('PATH_REJECTED');
  if (existsSync(path)) throw new Error('FIXTURE_ALREADY_EXISTS');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  checksums[name] = createHash('sha256').update(text).digest('hex');
};
// Audit the actual copied bytes for every scoped6B product module and the historical public fixture.
const phase6bRenderedSourcePaths = Object.freeze([
  "src/features/natori/components/consultation/ConsultationThread.tsx",
  "src/features/natori/components/dashboard/inquiry/InquiryRequestSummary.tsx",
  "src/features/natori/components/portfolio/PortfolioCommissionForm.tsx",
  "src/features/natori/components/portfolio/PortfolioHero.tsx",
  "src/features/natori/components/portfolio/PortfolioHeroSlider.tsx",
  "src/features/natori/components/portfolio/PortfolioInquiryDialog.tsx",
  "src/features/natori/components/portfolio/PortfolioLanding.tsx",
  "src/features/natori/components/portfolio/PortfolioMobileCta.tsx",
  "src/features/natori/components/portfolio/PortfolioPricing.tsx",
  "src/features/natori/components/portfolio/PortfolioStructuredCommissionForm.tsx",
  "src/features/natori/components/portfolio/PortfolioWorkflow.tsx",
  "src/features/natori/components/portfolio/edit/PortfolioEditor.tsx",
  "src/features/natori/components/portfolio/edit/PortfolioPreviewClient.tsx",
  "src/features/natori/components/quote/DeliveryAcceptCard.tsx",
  "src/features/natori/components/quote/QuoteAcceptCard.tsx",
  "src/features/natori/constants/natoriPrimaryAction.ts",
  "src/features/natori/constants/portfolioContactCopy.ts",
  "src/features/natori/lib/__tests__/fixtures/portfolioWorkflow.public-20261001.json",
  "src/features/natori/lib/portfolioContent.ts",
  "src/features/natori/lib/portfolioDisplay.ts",
  "src/features/natori/lib/portfolioWorkflow.ts",
  "src/features/natori/server/portfolioContactService.ts",
  "src/features/natori/server/portfolioSiteService.ts",
  "src/features/natori/types/portfolio.ts",
  "src/features/natori/types/portfolioDisplay.ts"
]);
for (const name of phase6bRenderedSourcePaths) {
  const destination = resolve(target, name);
  if (!destination.startsWith(target + (process.platform === 'win32' ? '\\' : '/'))) throw new Error('PATH_REJECTED');
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(process.cwd(), name), destination);
  checksums[name] = createHash('sha256').update(readFileSync(destination)).digest('hex');
}
const observedPublicWorkflow = JSON.parse(readFileSync(resolve(process.cwd(), 'src/features/natori/lib/__tests__/fixtures/portfolioWorkflow.public-20261001.json'), 'utf8')).workflow;
put('src/app/[locale]/fixture-phase6b/page.tsx', `import Fixture from './fixture';
export default function Page() {
  if(process.env.PHASE_6B_BROWSER!=='ephemeral') throw new Error('Fixture disabled');
  return <Fixture/>;
}
`);
put('src/app/[locale]/fixture-phase6b/fixture.tsx', `'use client';
import { defaultPortfolioContent } from '@/features/natori/constants/portfolioContent';
import { buildNatoriInquiryRequestView } from '@/features/natori/lib/inquiryRequestView';
import PortfolioHero from '@/features/natori/components/portfolio/PortfolioHero';
import PortfolioStyles from '@/features/natori/components/portfolio/PortfolioStyles';
import PortfolioMobileCta from '@/features/natori/components/portfolio/PortfolioMobileCta';
import PortfolioCommissionForm from '@/features/natori/components/portfolio/PortfolioCommissionForm';
import PortfolioPricing from '@/features/natori/components/portfolio/PortfolioPricing';
import PortfolioWorkflow from '@/features/natori/components/portfolio/PortfolioWorkflow';
import ConsultationThread from '@/features/natori/components/consultation/ConsultationThread';
import QuoteAcceptCard from '@/features/natori/components/quote/QuoteAcceptCard';
import DeliveryAcceptCard from '@/features/natori/components/quote/DeliveryAcceptCard';
import InquiryRequestSummary from '@/features/natori/components/dashboard/inquiry/InquiryRequestSummary';
const content={...defaultPortfolioContent,workflow:${JSON.stringify(observedPublicWorkflow)},artistName:'Synthetic artist',commissionOpen:true,massProductionOpen:true,heroImage:'/phase6b-a.svg',heroImages:['/phase6b-a.svg','/phase6b-b.svg'],works:[]};
const shortMessage='一行目：ご相談です\\n二行目：表情の希望\\n三行目：配信に使用\\n四行目：商用利用あり\\n五行目：公開は相談\\n六行目：AI学習は禁止です';
const longMessage='色と表情についてご相談です。\\n'.repeat(40)+'最後の条件：AI学習は禁止です。';
function request(message:string){return buildNatoriInquiryRequestView({schemaVersion:1,formVersion:'etorie-request-v1',inquiryMode:'consultation',requestType:'undecided',requestTypeOther:null,commissionScope:'undecided',commissionScopeOther:null,options:[],usageTypes:[],usageTypeOther:null,commercialUse:'unknown',publicationPolicy:'unknown',budget:{kind:'undecided',min:null,max:null,currency:'JPY'},deadline:{kind:'undecided',date:null,note:''},characterFeatures:'',expressionMood:'',composition:'',colorDirection:'',referenceNotes:'',message,legacySource:null});}
export default function Fixture(){return <main className='pf-portfolio-root min-h-screen bg-white text-[#302A33]'>
  <PortfolioStyles/><button type='button' data-testid='outside-focus' className='m-5 border p-3'>Outside slider</button>
  <div data-testid='hero'><PortfolioHero content={content} contactPath='#form'/></div>
  <div data-testid='workflow'><PortfolioWorkflow content={content}/></div>
  <div data-testid='pricing'><PortfolioPricing content={content} structuredIntake contactPath='#form'/></div>
  <section data-testid='short-summary' className='mx-auto max-w-xl p-5'><InquiryRequestSummary view={request(shortMessage)}/></section>
  <section data-testid='long-summary' className='mx-auto max-w-xl p-5'><InquiryRequestSummary view={request(longMessage)}/></section>
  <section data-testid='consultation' className='mx-auto max-w-xl p-5'><ConsultationThread mode='client' token='phase6b-synthetic-only' initialMessages={[]} closed={false}/></section>
  <section data-testid='quote' className='p-5'><QuoteAcceptCard token='phase6b-synthetic-only' title='Synthetic quote' clientName='Synthetic' amount={12000} acceptedAt={null} expiresAt='2099-12-31T00:00:00.000Z'/></section>
  <section data-testid='delivery' className='p-5'><DeliveryAcceptCard token='phase6b-synthetic-only' title='Synthetic delivery' clientName='Synthetic' files={[{fileName:'Synthetic.svg',sizeBytes:1024,url:'/phase6b-a.svg'}]} acceptedAt={null} canAccept/></section>
  <section data-testid='delivery-disabled' className='p-5'><DeliveryAcceptCard token='phase6b-synthetic-only' title='Synthetic unavailable' clientName='Synthetic' files={[]} acceptedAt={null} canAccept={false}/></section>
  <section id='form' data-testid='form' className='mx-auto max-w-xl p-5'><PortfolioCommissionForm content={content} structuredIntake initialMode='consultation' demoMode/></section>
  <PortfolioMobileCta href='#form'/>
</main>;}
`);
for (const [name, color] of [['a', '#EC4899'], ['b', '#56AFA0']]) {
  put(`public/phase6b-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#FFF9FC"/><circle cx="300" cy="300" r="180" fill="${color}"/><text x="300" y="310" text-anchor="middle" fill="#302A33" font-size="36">Synthetic ${name}</text></svg>`);
}
// Do not replace fonts here. Phase T's existing isolated build owns offline font
// handling; contrast uses computed foreground/background regardless of font.
checksums.phase6bFixture = 'Synthetic browser-only rendering; no DB, provider or mail';
writeFileSync(checksumPath, JSON.stringify(checksums, null, 2));
console.log('Phase 6B synthetic browser fixture prepared');
