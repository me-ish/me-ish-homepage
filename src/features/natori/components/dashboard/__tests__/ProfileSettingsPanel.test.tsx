// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({save:vi.fn()}));
vi.mock("../../../data/supabaseProfile",async()=>({...await vi.importActual<typeof import("../../../data/supabaseProfile")>("../../../data/supabaseProfile"),upsertOwnNatoriProfile:m.save}));
import {ProfileSettingsPanel} from "../NatoriDashboardLegacy";
import {NatoriProfileLoadError} from "../../../data/supabaseProfile";
const profile={userId:"11111111-1111-4111-8111-111111111111",displayName:"合成担当",handle:"fixture",portfolioUrl:"/natori/portfolio",linksUrl:"/natori/links",dailyCapacityHours:5};
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
it("keeps every existing profile field in the reused full-replacement API request",async()=>{
 m.save.mockResolvedValue({...profile,displayName:"変更"});render(<ProfileSettingsPanel profile={profile} onSaved={()=>{}} validateLinks/>);fireEvent.click(screen.getByRole("button",{name:/プロフィール設定/}));
 fireEvent.change(screen.getByLabelText("表示名"),{target:{value:"変更"}});fireEvent.click(screen.getByRole("button",{name:"保存"}));
 await waitFor(()=>expect(m.save).toHaveBeenCalledWith({displayName:"変更",handle:"fixture",portfolioUrl:"/natori/portfolio",linksUrl:"/natori/links",dailyCapacityHours:5}));
});
it("propagates a profile save 401 to the workspace access rejection",async()=>{
 m.save.mockRejectedValue(new NatoriProfileLoadError(401,"expired"));const reject=vi.fn();render(<ProfileSettingsPanel profile={profile} onSaved={()=>{}} validateLinks onAccessRejected={reject}/>);
 fireEvent.click(screen.getByRole("button",{name:/プロフィール設定/}));fireEvent.click(screen.getByRole("button",{name:"保存"}));await waitFor(()=>expect(reject).toHaveBeenCalledTimes(1));
});
