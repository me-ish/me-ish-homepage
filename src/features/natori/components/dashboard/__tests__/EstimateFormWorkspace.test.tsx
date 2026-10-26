// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),seed:vi.fn(),projects:vi.fn()}));
vi.mock("../../../data/supabasePricing",async()=>({...await vi.importActual<typeof import("../../../data/supabasePricing")>("../../../data/supabasePricing"),fetchOwnPricingPresets:m.load,updatePricingPresetConfig:m.save,seedDefaultPricingPresets:m.seed}));
vi.mock("../../../data/supabaseProjects",()=>({fetchNatoriProjects:m.projects}));
import EstimateForm from "../EstimateForm";
import {NatoriPricingLoadError} from "../../../data/supabasePricing";
import {createDefaultNatoriPricingConfig} from "../../../lib/pricing";
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("matchMedia",(query:string):MediaQueryList=>({matches:true,media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn(()=>true)}));});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("rejects a workspace pricing read 401 and never seeds presets or loads unsafe mail-registration paths",async()=>{
 m.load.mockRejectedValue(new NatoriPricingLoadError(401,"expired"));const reject=vi.fn();render(<EstimateForm workspaceOnly onAccessRejected={reject}/>);
 await waitFor(()=>expect(reject).toHaveBeenCalledTimes(1));expect(m.seed).not.toHaveBeenCalled();expect(m.projects).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"見積もり作成"}).hasAttribute("disabled")).toBe(true);
});
it("clears cached pricing and rejects access when an explicit workspace preset save returns 401",async()=>{
 m.load.mockResolvedValue([{id:"11111111-1111-4111-8111-111111111111",presetKey:"tsunagu",name:"合成プリセット",config:createDefaultNatoriPricingConfig(),isDefault:true,sortOrder:0}]);m.save.mockRejectedValue(new NatoriPricingLoadError(401,"expired"));
 const reject=vi.fn();render(<EstimateForm workspaceOnly onAccessRejected={reject}/>);await screen.findByRole("button",{name:"合成プリセット"});
 const toggle=screen.queryByRole("button",{name:"料金表を表示"});if(toggle)fireEvent.click(toggle);fireEvent.change(screen.getAllByRole("spinbutton")[0],{target:{value:"9001"}});fireEvent.click(screen.getByRole("button",{name:"このプリセットを保存"}));
 await waitFor(()=>expect(reject).toHaveBeenCalledTimes(1));expect(screen.queryByRole("button",{name:"合成プリセット"})).toBeNull();expect(m.seed).not.toHaveBeenCalled();
});
it("initializes missing presets only after explicit confirmation and reuses saved values returned by the existing idempotent API",async()=>{
 m.load.mockResolvedValue([]);m.seed.mockResolvedValue([{id:"11111111-1111-4111-8111-111111111111",presetKey:"tsunagu",name:"保存済みの料金",config:createDefaultNatoriPricingConfig(),isDefault:true,sortOrder:0}]);
 const confirm=vi.spyOn(window,"confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
 render(<EstimateForm workspaceOnly/>);const initialize=await screen.findByRole("button",{name:"料金プリセットの初期設定を確認"});expect(m.seed).not.toHaveBeenCalled();
 fireEvent.click(initialize);expect(m.seed).not.toHaveBeenCalled();fireEvent.click(initialize);
 await screen.findByRole("button",{name:"保存済みの料金"});expect(m.seed).toHaveBeenCalledTimes(1);expect(m.projects).not.toHaveBeenCalled();confirm.mockRestore();
});
it("never initializes missing presets from a read-only workspace",async()=>{
 m.load.mockResolvedValue([]);render(<EstimateForm workspaceOnly readOnly/>);
 const initialize=await screen.findByRole("button",{name:"料金プリセットの初期設定を確認"});expect(initialize.hasAttribute('disabled')).toBe(true);fireEvent.click(initialize);expect(m.seed).not.toHaveBeenCalled();
});
