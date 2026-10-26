import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  preview: vi.fn(),
  dispatch: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ rpc: m.rpc, from: m.from }),
}));
vi.mock("../natoriOwner", () => ({
  resolveNatoriManagementContext: async () => ({
    ownerId: "22222222-2222-4222-8222-222222222222",
    operator: { kind: "shared-key" },
  }),
}));
vi.mock("../acceptanceNotifications", () => ({
  buildAcceptanceNotificationPayload: m.preview,
  dispatchAcceptanceNotification: m.dispatch,
}));
import {
  readCaseAdministration,
  commandCaseAdministration,
  lookupCaseAdministration,
} from "../caseAdministration";
import { caseAdminRequest, caseAdminView } from "../../lib/caseAdministration";
const projectId = "11111111-1111-4111-8111-111111111111",
  operationId = "33333333-3333-4333-8333-333333333333",
  notificationId = "44444444-4444-4444-8444-444444444444",
  revision = "a".repeat(64);
const request = (action: unknown) => ({
  projectId,
  operationId,
  revision,
  action,
});
beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "natori_case_admin_replay_v1"
        ? null
        : { result: "applied", projectId },
    error: null,
  }));
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: m.single,
  };
  m.from.mockReturnValue(query);
  m.single.mockResolvedValue({
    data: {
      id: notificationId,
      purpose: "quote_accept_artist",
      snapshot: {},
      payload: null,
    },
    error: null,
  });
  m.preview.mockReturnValue({
    to: ["recipient@example.invalid"],
    from: "fixture@example.invalid",
    reply_to: "reply@example.invalid",
    subject: "合成通知",
    text: "本文",
    headers: {},
  });
});
it("normalizes reference links on the server and preserves the same business input for replay",async()=>{
 await commandCaseAdministration(request({command:"reference-link",mode:"add",linkId:null,url:"https://EXAMPLE.invalid:443/ref#fragment",label:"合成資料"}));
 expect(m.rpc).toHaveBeenCalledWith("natori_case_context_command_v1",expect.objectContaining({p_project:projectId,p_input:expect.objectContaining({normalizedUrl:"https://example.invalid/ref"})}));
 expect(m.dispatch).not.toHaveBeenCalled();
});
it("rejects credentialed or non-HTTPS references before any database write",async()=>{
 for(const url of ["http://example.invalid","https://user:pass@example.invalid","javascript:alert(1)"])
  await expect(commandCaseAdministration(request({command:"reference-link",mode:"add",linkId:null,url,label:null}))).rejects.toThrow();
 expect(m.rpc).not.toHaveBeenCalled();
});
describe("workspace administration server boundary", () => {
  it("rejects forged owner/operator and an absent confirmation revision before any DB call", async () => {
    await expect(
      commandCaseAdministration({
        ...request({ command: "manual-payment" }),
        ownerId: operationId,
      }),
    ).rejects.toThrow();
    await expect(
      commandCaseAdministration({
        ...request({ command: "manual-payment" }),
        revision: null,
      }),
    ).rejects.toThrow();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("uses server owner/operator and sends a frozen revision to the locked wrapper", async () => {
    await commandCaseAdministration(request({ command: "manual-payment" }));
    expect(m.rpc).toHaveBeenLastCalledWith(
      "natori_case_admin_command_v1",
      expect.objectContaining({
        p_owner: "22222222-2222-4222-8222-222222222222",
        p_operator: { kind: "shared-key" },
        p_revision: revision,
        p_project: projectId,
        p_command: "manual-payment",
      }),
    );
  });
  it.each(["applied", "queued"])(
    "a saved %s receipt is returned before decrypting or dispatching",
    async (result) => {
      m.rpc.mockResolvedValue({
        data: { result, projectId, notificationId, replayed: true },
        error: null,
      });
      m.preview.mockImplementation(() => {
        throw Error("retired payload");
      });
      expect(
        await commandCaseAdministration(
          request({
            command: "retry-notice",
            notificationId,
            previewHash: revision,
          }),
        ),
      ).toMatchObject({ result, replayed: true });
      expect(m.from).not.toHaveBeenCalled();
      expect(m.preview).not.toHaveBeenCalled();
      expect(m.dispatch).not.toHaveBeenCalled();
    },
  );
  it("a conflicting operation never proceeds to a new notification", async () => {
    m.rpc.mockResolvedValue({ data: { result: "conflict" }, error: null });
    expect(
      await commandCaseAdministration(
        request({
          command: "retry-notice",
          notificationId,
          previewHash: revision,
        }),
      ),
    ).toEqual({ result: "conflict" });
    expect(m.dispatch).not.toHaveBeenCalled();
    expect(m.from).not.toHaveBeenCalled();
  });
  it("a lost replay query is uncertain and never falls through to mutation", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(
      commandCaseAdministration(request({ command: "manual-payment" })),
    ).rejects.toThrow("unconfirmed");
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });
  it("changed recipient/content rejects confirmation without invoking the writer", async () => {
    expect(
      await commandCaseAdministration(
        request({
          command: "retry-notice",
          notificationId,
          previewHash: revision,
        }),
      ),
    ).toEqual({ result: "confirmation_stale" });
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("an unavailable/erased encrypted body cannot be regenerated for retry", async () => {
    m.preview.mockImplementation(() => {
      throw Error("retired");
    });
    expect(
      await commandCaseAdministration(
        request({
          command: "retry-notice",
          notificationId,
          previewHash: revision,
        }),
      ),
    ).toEqual({ result: "confirmation_stale" });
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });
  it("new registration derives initial tasks on the server and records no accepted or paid facts", async () => {
    await commandCaseAdministration({
      operationId,
      projectId: null,
      revision: null,
      action: {
        command: "create",
        data: {
          mode: "external",
          title: "架空相談",
          clientName: "合成依頼者",
          clientEmail: "",
          type: "illustration",
          status: "inquiry",
          amount: 0,
          deliveryPlan: "normal",
          startDate: "2026-10-22",
          dueDate: "2026-12-01",
          note: "",
        },
      },
    });
    const args = m.rpc.mock.calls.at(-1)![1];
    expect(args.p_project).toBeNull();
    expect(args.p_input.tasks.length).toBeGreaterThan(0);
    expect(args.p_input.project).not.toHaveProperty("quote_accepted_at");
    expect(args.p_input.project).not.toHaveProperty("paid_at");
  });
  it("operation lookup is GET-only with the authenticated owner", async () => {
    m.rpc.mockResolvedValue({
      data: { projectId, result: "applied", operationId },
      error: null,
    });
    await lookupCaseAdministration(operationId);
    expect(m.rpc).toHaveBeenCalledWith(
      "natori_case_admin_lookup_v1",
      {
        p_owner: "22222222-2222-4222-8222-222222222222",
        p_operation: operationId,
      },
      { get: true },
    );
    expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("historical completion cannot be created as an inferred registration payment", () => {
    expect(
      caseAdminRequest.safeParse({
        operationId,
        projectId: null,
        revision: null,
        action: {
          command: "create",
          data: {
            mode: "manual",
            title: "合成",
            clientName: "合成",
            clientEmail: "",
            type: "illustration",
            status: "completed",
            amount: 0,
            deliveryPlan: "normal",
            startDate: "2026-10-22",
            dueDate: "2026-12-01",
            note: "",
          },
        },
      }).success,
    ).toBe(false);
  });
  it("partial notice history is explicit rather than invalidating the whole admin schema", () => {
    expect(caseAdminView.shape.complete.parse(false)).toBe(false);
  });
});

it("exact notification read uses only the requested owned row and rejects a substituted scope",async()=>{
 const view={project:{id:projectId,status:"quoted",nextAction:"",title:"合成",clientName:"合成",clientEmail:null,amount:12000,type:"illustration",deliveryPlan:"normal",priority:null,startDate:null,dueDate:null,createdAt:"2026-10-22",note:null,requestData:null,mutationRevision:0,tasks:[],paymentConfirmedAt:null,paidAt:null,paidAmount:null,completedAt:null,deliveryAcceptedAt:null,deliveredMailAt:null,deletedAt:null},revision,complete:false,acceptance:{at:null,amount:null},quote:null,notices:[{id:notificationId,purpose:"quote_accept_artist",status:"unknown",attempt_no:1,quote_id:null,deadline:null,created_at:"2026-10-22",sent_at:null,retry_candidate:false}],selectedNotice:{id:notificationId,latestId:notificationId,isLatest:true}};
 m.rpc.mockResolvedValue({data:view,error:null});
 expect((await readCaseAdministration(projectId,notificationId))?.notices[0].status).toBe("unknown");
 expect(m.rpc).toHaveBeenCalledExactlyOnceWith("natori_case_admin_notice_read_v1",{p_owner:"22222222-2222-4222-8222-222222222222",p_project:projectId,p_notice:notificationId},{get:true});
 expect(m.from).not.toHaveBeenCalled();expect(m.dispatch).not.toHaveBeenCalled();
 m.rpc.mockResolvedValue({data:{...view,selectedNotice:{...view.selectedNotice,id:operationId}},error:null});
 await expect(readCaseAdministration(projectId,notificationId)).rejects.toThrow("scope_mismatch");
});
