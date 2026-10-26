// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateJourney from "@/features/natori/components/dashboard/EstimateJourney";
import { estimateDraftSchema } from "@/features/natori/lib/estimateDraft";
import type { NatoriProject } from "@/features/natori/types/projects";

vi.mock("@/features/natori/data/supabaseProjects", () => ({
  confirmNatoriProjectType: vi.fn(),
}));
const project: NatoriProject = {
  id: "60000000-0000-4000-8000-000000000001",
  title: "動画サムネイル",
  clientName: "依頼者",
  clientEmail: "requester@example.com",
  type: "illustration",
  amount: null,
  dueDate: null,
  status: "inquiry",
  nextAction: "相談",
  tasks: [],
};
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () =>
      options?.method === "PUT"
        ? {
            draft: {
              ...estimateDraftSchema.parse(
                (({ projectId: _id, revision: _rev, ...draft }) => draft)(
                  JSON.parse(String(options.body)),
                ),
              ),
              revision: 1,
            },
          }
        : { draft: null },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EstimateJourney", () => {
  it("keeps external requests on the conditions -> price -> review path without guessing their initial amount", async () => {
    render(<EstimateJourney project={project} portfolioContent={null} />);
    expect(await screen.findByText("今回決まった条件")).toBeTruthy();
    expect(screen.getByLabelText("制作するもの")).toHaveProperty("value", "");
    await userEvent.click(
      screen.getByRole("button", { name: /条件を保存して金額へ/ }),
    );
    expect(await screen.findByText("今回の金額を決める")).toBeTruthy();
    expect(screen.getByText("未入力")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "明細を追加" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /単価/ }), {
      target: { value: "3500" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /明細を保存して送信確認へ/ }),
    );
    expect(await screen.findByText("相手に見える内容を確認")).toBeTruthy();
    expect(screen.getByText(/送信前に決める項目/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /正式見積り/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("estimate-draft?projectId="),
      expect.anything(),
    );
  });

  it("retains edits made while a workspace draft save is in flight", async () => {
    sessionStorage.clear();
    let complete!: () => void;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method !== "PUT")
        return { ok: true, json: async () => ({ draft: null }) };
      const sent = JSON.parse(String(options.body));
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      return {
        ok: true,
        json: async () => ({ draft: { ...sent, revision: 1 } }),
      };
    });
    const onDirty = vi.fn();
    render(
      <EstimateJourney
        project={project}
        portfolioContent={null}
        workspace={{ revision: "a".repeat(64), onChanged: vi.fn(), onDirty }}
      />,
    );
    const field = await screen.findByLabelText("制作するもの");
    fireEvent.change(field, { target: { value: "最初の入力" } });
    await userEvent.click(
      screen.getByRole("button", { name: /条件を保存して金額へ/ }),
    );
    fireEvent.change(field, { target: { value: "保存待ち中の追加内容" } });
    complete();
    await screen.findByText("今回の金額を決める");
    await waitFor(() =>
      expect(
        JSON.parse(
          sessionStorage.getItem(`natori-case-quote-draft/${project.id}`)!,
        ).draft.agreedTerms.deliverables,
      ).toBe("保存待ち中の追加内容"),
    );
    expect(onDirty).toHaveBeenLastCalledWith(true);
    sessionStorage.clear();
  });

  it("restores a click-added item together with the saved revision after remount", async () => {
    sessionStorage.clear();
    const workspace = {
      revision: "a".repeat(64),
      onChanged: vi.fn(),
      onDirty: vi.fn(),
    };
    const first = render(
      <EstimateJourney
        project={project}
        portfolioContent={null}
        workspace={workspace}
      />,
    );
    await screen.findByText("今回決まった条件");
    await userEvent.click(
      screen.getByRole("button", { name: /条件を保存して金額へ/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "明細を追加" }));
    await waitFor(() =>
      expect(
        JSON.parse(
          sessionStorage.getItem(`natori-case-quote-draft/${project.id}`)!,
        ).saved.revision,
      ).toBe(1),
    );
    first.unmount();
    render(
      <EstimateJourney
        project={project}
        portfolioContent={null}
        workspace={workspace}
      />,
    );
    expect(await screen.findByLabelText("明細名")).toHaveProperty(
      "value",
      "追加作業",
    );
    expect(screen.queryByText(/保存した見積下書きを確認できません/)).toBeNull();
    sessionStorage.clear();
  });
});

describe('current flow unresolved quote result',()=>{
 it('keeps an unresolved identity and offers a GET-only result lookup without another POST',async()=>{
  sessionStorage.clear();const op='quote:synthetic:unknown';
  fetchMock.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.includes('structured-quote')?{enabled:true,lookupOnly:true,issue:{quoteId:'60000000-0000-4000-8000-000000000004',version:1,notificationStatus:'unknown',operationId:op}}:{draft:null}}));
  render(<EstimateJourney project={project} portfolioContent={null} workspace={{revision:'a'.repeat(64),onChanged:vi.fn(),onDirty:vi.fn()}}/>);
  const lookup=await screen.findByRole('button',{name:'送信せず見積操作の結果を照会'});fireEvent.click(lookup);
  await waitFor(()=>expect(fetchMock.mock.calls.some(c=>String(c[0]).includes(`operationId=${encodeURIComponent(op)}`))).toBe(true));
  expect(fetchMock.mock.calls.every(c=>c[1]?.method!=='POST')).toBe(true);
  expect((screen.getByRole('button',{name:'第1版を同じ内容で再通知'}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText('新しい版の作成を確認')).toBeNull();sessionStorage.clear();
 });
});
