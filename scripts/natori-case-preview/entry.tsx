import { createRoot } from 'react-dom/client';
import { CaseWorkspacePreview, type CasePreviewLoader } from '../../src/features/natori/components/caseWorkspace/CaseWorkspacePreview';
import type { CaseWorkspaceRecord } from '../../src/features/natori/types/caseWorkspace';
const load:CasePreviewLoader=async(mode,signal)=>{
  const response=await fetch(`/fixtures.json?mode=${encodeURIComponent(mode)}`,{signal,cache:'no-store'});
  if(!response.ok)throw new Error('Synthetic read failed');
  return await response.json() as CaseWorkspaceRecord[];
};
createRoot(document.getElementById('root')!).render(<CaseWorkspacePreview load={load}/>);
