// Construction-only fixture mounting actual Pricing and Contact components.
import {copyFileSync,mkdirSync,readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output||!/\/natori-phase-t\.[A-Za-z0-9]+\/browser-app$/.test(output)||realpathSync(output)===realpathSync(process.cwd()))throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksumPath=resolve(output,'source-checksums.json'),checksums=JSON.parse(readFileSync(checksumPath,'utf8'));
for(const path of [
 'src/app/api/natori/portfolio/contact/route.ts',
 ...['PortfolioPricing','PortfolioContactPage','PortfolioCommissionForm','PortfolioStructuredCommissionForm','PortfolioStyles','PortfolioFormStyles','PortfolioLegalNotice','portfolioFonts','useIntakeOperation','IntakeRecoveryPanel'].map(name=>'src/features/natori/components/portfolio/'+name+(name==='portfolioFonts'||name==='useIntakeOperation'?'.ts':'.tsx')),
 ...['portfolioRequestForm','portfolioFormFeedback','portfolioFormValidation','requestPresentation','restoreIntakeForm','inquiryRequestView','requestSchema','referenceLinks'].map(name=>'src/features/natori/lib/'+name+'.ts'),
 'src/features/natori/constants/portfolioContent.ts',
]){
 mkdirSync(dirname(resolve(output,path)),{recursive:true});copyFileSync(path,resolve(output,path));checksums[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
}
const fixtures={
 'src/app/api/fixture-phase5-request-view/route.ts':"import {canUseNatoriManagement} from '@/features/natori/server/requireNatoriAdmin';\nimport {listNatoriAdminProjects} from '@/features/natori/server/projectsService';\nimport {buildNatoriInquiryRequestView} from '@/features/natori/lib/inquiryRequestView';\nexport const dynamic='force-dynamic';\nexport async function GET(request:Request){\n if(process.env.PHASE_5_BROWSER!=='ephemeral')return new Response(null,{status:404});\n if(!await canUseNatoriManagement())return new Response(null,{status:401});\n const projectId=new URL(request.url).searchParams.get('projectId');\n if(!projectId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))return new Response(null,{status:400});\n const result=await listNatoriAdminProjects(projectId);if(result.kind!=='ok')return new Response(null,{status:503});\n const project=result.projects.find(row=>row.id===projectId);if(!project)return new Response(null,{status:404});\n return Response.json({projectId:project.id,requestData:project.request_data,view:buildNatoriInquiryRequestView(project.request_data),referenceLinks:result.referenceLinks.filter(row=>row.project_id===project.id).sort((a,b)=>a.sort_order-b.sort_order).map(row=>({url:row.url,label:row.label})),referenceFiles:result.referenceFiles.filter(row=>row.project_id===project.id).length},{headers:{'Cache-Control':'no-store'}});\n}\n",
 'src/app/[locale]/fixture-phase5/page.tsx':`import PortfolioPricing from '@/features/natori/components/portfolio/PortfolioPricing';
import PortfolioStyles from '@/features/natori/components/portfolio/PortfolioStyles';
import {defaultPortfolioContent} from '@/features/natori/constants/portfolioContent';
import {portfolioFontEn,portfolioFontJp} from '@/features/natori/components/portfolio/portfolioFonts';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{locale:string}>}){
 if(process.env.PHASE_5_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 const {locale}=await params;const contactPath='/'+locale+'/fixture-phase5/contact';
 return <main className={portfolioFontJp.variable+' '+portfolioFontEn.variable+' '+portfolioFontJp.className+' pf-portfolio-root'}><PortfolioStyles/><PortfolioPricing content={defaultPortfolioContent} contactPath={contactPath} structuredIntake/><section id="form"><a href={contactPath+'?mode=quote&structured=1'}>見積もりをお願いしたい</a></section></main>;
}
`,
 'src/app/[locale]/fixture-phase5/contact/page.tsx':`import PortfolioContactPage from '@/features/natori/components/portfolio/PortfolioContactPage';
import {defaultPortfolioContent} from '@/features/natori/constants/portfolioContent';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{locale:string}>,searchParams:Promise<{mode?:string,plan?:string,planLabel?:string}>}){
 if(process.env.PHASE_5_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 const [path,query]=await Promise.all([params,searchParams]);
 return <PortfolioContactPage content={defaultPortfolioContent} mode={query.mode} plan={query.plan} planLabel={query.planLabel} structuredIntake backHref={'/'+path.locale+'/fixture-phase5'}/>;
}
`};
for(const [path,source]of Object.entries(fixtures)){mkdirSync(dirname(resolve(output,path)),{recursive:true});writeFileSync(resolve(output,path),source);checksums[path]=createHash('sha256').update(source).digest('hex');}
checksums.phase5Fixture='Actual Pricing and Contact components, published defaults, structured quote mode; no demoMode and actual intake route';
writeFileSync(checksumPath,JSON.stringify(checksums,null,2));
