// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({read:vi.fn(),post:vi.fn()}));
vi.mock('@/features/natori/data/supabaseCasePaymentWorkspace',async original=>({...await original<typeof import('@/features/natori/data/supabaseCasePaymentWorkspace')>(),readCasePaymentView:m.read,postCasePayment:m.post}));
import {CasePaymentPanel} from '../CasePaymentPanel';
const project='33333333-3333-4333-8333-333333333333';
beforeEach(()=>{sessionStorage.clear();m.read.mockResolvedValue({enabled:true,projectId:project,phase:'prepare',reason:'見積承諾済み',deadlinePolicy:'sent_plus_7_days',deadline:null,amount:12000,quoteVersion:1,sentCount:0,canPrepare:true,jobs:[],operationId:null});m.post.mockResolvedValue({result:'prepared',preview:{projectId:project,projectTitle:'Synthetic',operationId:'44444444-4444-4444-8444-444444444444',kind:'initial',quoteVersion:1,amount:12000,deadline:null,deadlinePolicy:'sent_plus_7_days',to:['client@example.invalid'],from:'test@example.invalid',replyTo:'test@example.invalid',bcc:[],subject:'Synthetic',text:'Synthetic body',validUntil:'2099-01-01T00:00:00Z',token:'synthetic',linkPending:true}});});
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('current-operation payment screen',()=>{
 it('requires content confirmation but no date entry, and explains successful resend extension',async()=>{render(<CasePaymentPanel projectId={project} onChanged={()=>{}}/>);await screen.findByRole('button',{name:'初回案内の内容を確認'});expect(screen.queryByLabelText('支払期限')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'初回案内の内容を確認'}));await waitFor(()=>expect(m.post).toHaveBeenCalledWith({action:'prepare',projectId:project}));await screen.findByText('送信成功から7日（再送成功で延長）');const execute=screen.getByRole('button',{name:'確認した案内を実行'}) as HTMLButtonElement;expect(execute.disabled).toBe(true);fireEvent.click(screen.getByRole('checkbox'));expect(execute.disabled).toBe(false);});
});
