import { expect as baseExpect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {writeFileSync} from 'node:fs';
const expect = baseExpect.configure({ timeout: 20000 });
export async function checkScreenBrowser({
  page,
  context,
  app,
  owner,
  sql,
  post,
  mark,
  provider,
  out,
}) {
  const created = await post({
    operationId: randomUUID(),
    projectId: null,
    revision: null,
    action: {
      command: "create",
      data: {
        mode: "manual",
        title: "画面統合の合成案件",
        clientName: "架空依頼者",
        clientEmail: "screen@example.invalid",
        type: "illustration",
        status: "inquiry",
        amount: 12000,
        deliveryPlan: "normal",
        startDate: "2026-10-20",
        dueDate: "2026-11-05",
        note: "受付メモの原文",
      },
    },
  });
  const id = created.projectId,
    at = provider().length;
  const original = {
    schemaVersion: 1,
    formVersion: "etorie-request-v1",
    inquiryMode: "consultation",
    requestType: "illustration",
    requestTypeOther: null,
    commissionScope: "full_body",
    commissionScopeOther: null,
    options: [],
    usageTypes: ["streaming"],
    usageTypeOther: null,
    commercialUse: "unknown",
    publicationPolicy: "unknown",
    budget: { kind: "undecided", min: null, max: null, currency: "JPY" },
    deadline: { kind: "undecided", date: null, note: "" },
    characterFeatures: "架空のキャラクター",
    expressionMood: "明るい",
    composition: "正面",
    colorDirection: "青",
    referenceNotes: "合成の資料注記",
    message: "合成の原回答本文",
    legacySource: null,
  };
  sql(
    `update natori_projects set request_data='${JSON.stringify(original)}'::jsonb where id='${id}';insert into natori_user_profiles(user_id,display_name,handle,portfolio_url,links_url,daily_capacity_hours) values('${owner}','合成担当','fixture','https://example.invalid/synthetic-portfolio','/natori/links',5) on conflict(user_id) do update set display_name=excluded.display_name,handle=excluded.handle,portfolio_url=excluded.portfolio_url,links_url=excluded.links_url,daily_capacity_hours=5;`,
  );
  const sourceReads=[];
  const sourceRequests=new WeakMap();let sourceSequence=0;
  page.on('request',request=>{if(request.url()===app+'/api/natori/admin/case-context?projectId='+id)sourceRequests.set(request,++sourceSequence);});
  page.on('response',response=>{if(sourceRequests.has(response.request()))void response.json().then(data=>{sourceReads.push({sequence:sourceRequests.get(response.request()),status:response.status(),revision:data.revision,memo:data.project?.nextAction,links:data.links?.length});}).catch(()=>{});});
  const source = () => page.getByRole("region", { name: "元の依頼と受付資料" }),
    confirmation = () =>
      source().getByRole("region", { name: "案件操作の確認" });
  const finish = async () => {
    const response=page.waitForResponse(r=>r.url()===app+'/api/natori/admin/case-administration'&&r.request().method()==='POST');
    await confirmation()
      .getByRole("button", { name: "確認した内容で実行", exact: true })
      .click();
    expect((await (await response).json()).result).toBe('applied');
    await expect(
      confirmation().getByRole("button", { name: "確認済みの操作を閉じる" }),
    ).toBeEnabled();
    await confirmation()
      .getByRole("button", { name: "確認済みの操作を閉じる" })
      .click();
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.goto(
      `${app}/natori/inquiries?project=${id}&q=画面統合&sort=due&view=conversation`,
    );
    await expect(
      page.getByRole("heading", { name: "画面統合の合成案件", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading",{name:"相談",exact:true})).toBeVisible();
    await expect(
      source().getByText("合成の原回答本文", { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await source().screenshot({path:`${out}/screen-intake-${width}.png`});
    expect(await source().getByRole("textbox").count()).toBe(3);
    // An interrupted reset leaves its old draft blocked on purpose. Explicitly
    // discard that synthetic draft and wait for the fresh API revision.
    await source().getByRole('button',{name:'入力を閉じて最新の保存内容を使う'}).click();
    await expect(source().getByLabel('担当の次回メモ')).toBeEnabled().catch(async error=>{writeFileSync(out+'/screen-failure.json',JSON.stringify({text:await source().innerText(),draft:await page.evaluate(id=>sessionStorage.getItem(`natori-case-intake-draft/${id}`),id),reads:sourceReads,current:sql(`select natori_case_context_revision_v1('${id}')`)},null,2));throw error;});
    await source().getByLabel("担当の次回メモ").fill(`確認メモ ${width}`);
    await source()
      .getByRole("button", { name: "次回メモの保存内容を確認" })
      .click();
    await finish();
    if(width===390){
      // Hold one automatic source read AFTER pointerdown. The explicit read-only
      // discard must still receive pointerup/click while writes remain blocked.
      const url=app+'/api/natori/admin/case-context?projectId='+id;
      let release,started,finished;let holdError=null;let holdNext=true,armed=false;
      const gate=new Promise(resolve=>{release=resolve;}),held=new Promise(resolve=>{started=resolve;}),completed=new Promise(resolve=>{finished=resolve;});
      const pause=async route=>{
        if(holdNext&&armed){holdNext=false;started();try{await gate;await route.continue();}catch(error){holdError=error;}finally{finished();}}
        else await route.continue();
      };
      await page.route(url,pause);
      try{
        const button=source().getByRole("button",{name:"入力を閉じて最新の保存内容を使う"});
        await expect(button).toBeEnabled();await button.scrollIntoViewIfNeeded();
        const box=await button.boundingBox();expect(box).not.toBeNull();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        armed=true;const sourceRequest=page.waitForRequest(url,{timeout:20000});
        await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await sourceRequest;await held;
        await expect(source().getByLabel('担当の次回メモ')).toBeDisabled();
        await expect(button).toBeEnabled();await page.mouse.up();
        await expect(source().getByLabel('担当の次回メモ')).toBeEnabled();
        mark('Screen interrupted pointer gesture can explicitly discard/fetch during an automatic read, without enabling stale writes');
      }finally{release();if(!holdNext)await completed;await page.unroute(url,pause);if(holdError)throw holdError;}
    }else await source()
      .getByRole("button", { name: "入力を閉じて最新の保存内容を使う" })
      .click();
    await expect(source().getByLabel('担当の次回メモ')).toBeEnabled().catch(async error=>{writeFileSync(out+'/screen-failure.json',JSON.stringify({text:await source().innerText(),draft:await page.evaluate(id=>sessionStorage.getItem(`natori-case-intake-draft/${id}`),id),reads:sourceReads,current:sql(`select natori_case_context_revision_v1('${id}')`)},null,2));throw error;});
    expect(
      JSON.parse(
        sql(`select request_data from natori_projects where id='${id}'`),
      ),
    ).toEqual(original);
    await source()
      .getByLabel("参考リンクURL")
      .fill(`https://example.invalid/ref-${width}`);
    await source().getByLabel("リンクのラベル").fill(`合成資料 ${width}`);
    await source()
      .getByRole("button", { name: "リンクの保存内容を確認" })
      .click();
    await finish();
    await expect(
      source().getByRole("link", { name: `合成資料 ${width}` }),
    ).toHaveAttribute("href", `https://example.invalid/ref-${width}`);
    await source()
      .getByRole("button", { name: "入力を閉じて最新の保存内容を使う" })
      .click();
    await expect(source().getByLabel('担当の次回メモ')).toBeEnabled().catch(async error=>{writeFileSync(out+'/screen-failure.json',JSON.stringify({text:await source().innerText(),draft:await page.evaluate(id=>sessionStorage.getItem(`natori-case-intake-draft/${id}`),id),reads:sourceReads,current:sql(`select natori_case_context_revision_v1('${id}')`)},null,2));throw error;});
    await page.reload();
    await expect(
      source().getByText("合成の原回答本文", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "← 案件へ戻る", exact: true }).click();
    expect(new URL(page.url()).searchParams.get("q")).toBe("画面統合");
    expect(new URL(page.url()).searchParams.get("source")).toBe("inquiries");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("due");
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "画面統合の合成案件", exact: true }),
    ).toBeVisible();
    mark(
      `Screen ${width}px original intake, confirmed memo/reference save and source query/sort/selection survive reload and browser history without changing request_data`,
    );
    await page.goto(`${app}/natori/estimate?inquiry=${id}&q=画面統合`);
    await expect(
      page.getByRole("heading", { name: "取引", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "画面統合の合成案件", exact: true }),
    ).toBeVisible();
    mark(
      `Screen ${width}px old estimate inquiry URL opens that exact case transaction with common guidance`,
    );
  }
  // A supplied catalogue row remains visible as submitted when no real Storage service can sign it.
  sql(
    `insert into natori_inquiry_reference_files(project_id,storage_path) values('${id}','${id}/synthetic-only.webp');`,
  );
  await page.goto(`${app}/natori/dashboard?case=${id}&section=overview`);
  await expect(
    source().getByText(
      "提出済みの資料です。リンクを取得できません。再読み込みしてください。",
    ),
  ).toBeVisible();
  const denied = await context.request.get(
    `${app}/api/natori/admin/case-context?projectId=ffffffff-ffff-4fff-8fff-ffffffffffff`,
  );
  expect(denied.status()).toBe(404);
  mark(
    "Screen missing Storage signing preserves submitted-file evidence and missing case returns 404 without a file path",
  );
  sql(
    `update natori_projects set status='rough',payment_confirmed_at=clock_timestamp(),paid_at=clock_timestamp(),paid_amount=12000 where id='${id}';`,
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.goto(
      `${app}/natori/dashboard?entry=schedule&date=2026-10-31&month=2026-11&q=画面統合&sort=priority`,
    );
    await expect(
      page.getByRole("link", { name: /画面統合の合成案件/ }),
    ).toBeVisible();
    await expect(
      page.getByText("制作工程の予定日", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: /画面統合の合成案件/ }).click();
    await expect(
      page.getByRole("heading", { name: "画面統合の合成案件", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "← 2026-10-31の予定へ戻る" }).click();
    expect(new URL(page.url()).searchParams.get("month")).toBe("2026-11");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("priority");
    await page.screenshot({
      path: out + `/screen-plan-${width}.png`,
      fullPage: true,
    });
    mark(
      `Screen ${width}px production plan includes a cross-month workday distinct from due date; same selected day/month/query/priority return preserved`,
    );
  }
  const adminView=async project=>(await (await context.request.get(`${app}/api/natori/admin/case-administration?projectId=${project}`)).json()).view;
  const beforeDate=await adminView(id),p=beforeDate.project;
  const patch={title:p.title,client_name:p.clientName,amount:p.amount,delivery_plan:p.deliveryPlan,start_date:p.startDate,due_date:'2026-11-06',note:p.note};
  expect((await post({operationId:randomUUID(),projectId:id,revision:beforeDate.revision,action:{command:'details',patch}})).result).toBe('applied');
  expect((await post({operationId:randomUUID(),projectId:id,revision:beforeDate.revision,action:{command:'details',patch:{...patch,due_date:'2026-11-07'}}})).result).toBe('stale');
  expect((await adminView(id)).project.dueDate).toBe('2026-11-06');
  mark('Screen concurrent date changes use the existing revision guard: a stale second change cannot overwrite the saved plan date');
  const ended=await post({operationId:randomUUID(),projectId:null,revision:null,action:{command:'create',data:{mode:'external',title:'終了の合成相談',clientName:'架空依頼者',clientEmail:'ended@example.invalid',type:'illustration',status:'inquiry',amount:0,deliveryPlan:'normal',startDate:'2026-10-22',dueDate:'2026-11-05',note:'合成相談'}}});
  const endedView=await adminView(ended.projectId);expect((await post({operationId:randomUUID(),projectId:ended.projectId,revision:endedView.revision,action:{command:'close',reason:'隔離された試験の見送り'}})).result).toBe('applied');
  await page.goto(`${app}/natori/inquiries?project=${ended.projectId}&filter=ended&q=合成`);await expect(page.getByRole('heading',{name:'終了の合成相談',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'← 案件へ戻る',exact:true}).click();expect(new URL(page.url()).searchParams.get('intakeFilter')).toBe('ended');
  await expect(page.getByRole('link',{name:/終了の合成相談/})).toBeVisible();await expect(page.getByRole('link',{name:/画面統合の合成案件/})).toHaveCount(0);
  mark('Screen legacy ended filter remains ended on return instead of falling back to all active cases');
  await page.goto(`${app}/natori/dashboard?case=${id}&section=overview&q=画面統合&sort=due`);
  await page.getByRole("link", { name: "設定・管理機能", exact: true }).click();
  const utility = page.getByRole("region", { name: "設定と既存の管理機能" });
  await utility.getByRole("button", { name: /プロフィール設定/ }).click();
  await expect(utility.getByLabel("表示名", { exact: true })).toHaveValue(
    "合成担当",
  );
  await utility.getByLabel("表示名", { exact: true }).fill("更新した合成担当");
  await utility.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    utility.getByText("保存しました。", { exact: true }),
  ).toBeVisible();
  const profile = JSON.parse(
    sql(
      `select jsonb_build_object('name',display_name,'handle',handle,'portfolio',portfolio_url,'links',links_url,'hours',daily_capacity_hours) from natori_user_profiles where user_id='${owner}'`,
    ),
  );
  expect(profile).toEqual({
    name: "更新した合成担当",
    handle: "fixture",
    portfolio: "https://example.invalid/synthetic-portfolio",
    links: "/natori/links",
    hours: 5,
  });
  await expect(
    utility.getByRole("link", { name: "ポートフォリオを編集" }),
  ).toHaveAttribute("target", "_blank");
  await expect(
    utility.getByRole("link", { name: "ポートフォリオを編集" }),
  ).toHaveAttribute("href", "/natori/portfolio/edit");
  await expect(
    utility.getByRole("link", { name: "リンク集を編集" }),
  ).toHaveAttribute("href", "/natori/links/edit");
  await expect(utility.getByRole("link",{name:"ポートフォリオを見る"})).toHaveAttribute("href","https://example.invalid/synthetic-portfolio");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await utility.screenshot({path:`${out}/screen-settings-390.png`});
  await page.getByRole("link", { name: "← 元の案件画面へ戻る" }).click();
  await expect(
    page.getByRole("heading", { name: "画面統合の合成案件", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe("画面統合");
  expect(provider().length).toBe(at);
  mark(
    "Screen settings reuses the owner API, saves all fields without erasing existing links/capacity, opens public editors separately and returns to the exact case without provider calls",
  );
  await page.goto(`${app}/natori/dashboard?case=${id}&utility=estimate`);
  const calculator=page.getByRole('region',{name:'案件未登録の概算ツール'});
  await expect(calculator.getByRole('button',{name:'料金プリセットの初期設定を確認'})).toBeVisible();
  expect(sql(`select count(*) from natori_pricing_configs where user_id='${owner}'`)).toBe('0');
  await calculator.getByRole('button',{name:'料金プリセットの初期設定を確認'}).click();
  await expect(calculator.getByRole('button',{name:'つなぐ用',exact:true})).toBeVisible();
  expect(sql(`select count(*) from natori_pricing_configs where user_id='${owner}'`)).toBe('2');
  const before=sql(`select md5(string_agg(row_to_json(p)::text,',' order by p.id)) from natori_pricing_configs p where user_id='${owner}'`);
  const repeated=await context.request.post(app+'/api/natori/admin/pricing',{headers:{'x-requested-with':'me-ish'},data:{seeds:[{presetKey:'tsunagu',name:'上書きさせない',config:{},isDefault:false,sortOrder:0}]}});
  expect(repeated.status()).toBe(200);
  expect(sql(`select md5(string_agg(row_to_json(p)::text,',' order by p.id)) from natori_pricing_configs p where user_id='${owner}'`)).toBe(before);
  expect(provider().length).toBe(at);
  mark('Screen missing pricing presets remain read-only until explicit confirmation; the existing owner API initializes two once and duplicate initialization preserves saved pricing without provider calls');
}
