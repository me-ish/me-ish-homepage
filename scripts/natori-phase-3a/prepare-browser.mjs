import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output?.includes('/natori-phase-t.')||!output.endsWith('/browser-app'))throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums=JSON.parse(readFileSync(resolve(output,'source-checksums.json'),'utf8'));
for(const path of ['src/app/api/natori/portfolio/contact/route.ts']){
 mkdirSync(dirname(resolve(output,path)),{recursive:true});copyFileSync(path,resolve(output,path));checksums[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
}
const fixture='src/app/[locale]/fixture-intake/[mode]/page.tsx';mkdirSync(dirname(resolve(output,fixture)),{recursive:true});
writeFileSync(resolve(output,fixture),`import PortfolioCommissionForm from '@/features/natori/components/portfolio/PortfolioCommissionForm';
import {defaultPortfolioContent} from '@/features/natori/constants/portfolioContent';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{mode:string}>}){
 if(process.env.PHASE_3A_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 const {mode}=await params;return <PortfolioCommissionForm content={defaultPortfolioContent} structuredIntake={mode==='structured'}/>;
}
`);
checksums['fixtureIntake']='test-only page mounting actual public forms and actual intake API';
writeFileSync(resolve(output,'source-checksums.json'),JSON.stringify(checksums,null,2));
