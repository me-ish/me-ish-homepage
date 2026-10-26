import { chromium, expect as baseExpect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const expect = baseExpect.configure({ timeout: 20000 });

export async function checkAdministrationBrowser({
  out,
  app,
  api,
  password,
  users,
  owner,
  other,
  ids,
  sql,
  check,
  screenOnly=false,historyOnly=false,continuityOnly=false,scaleOnly=false,metrics,setScaleFault,
}) {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const checks = [],
    errors = [],
    external = [];
  const mark = (label) => {
    checks.push(label);
    check(label);
  };
  const provider = () => {
    try {
      return readFileSync(out + "/provider.jsonl", "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(JSON.parse);
    } catch {
      return [];
    }
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if ([app, api].includes(u.origin)) return route.continue();
      if (u.hostname === "fonts.googleapis.com")
        return route.fulfill({
          status: 200,
          contentType: "text/css",
          body: "",
        });
      external.push(u.hostname);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dialog) => dialog.accept());
    const endpoint = app + "/api/natori/admin/case-administration";
    expect(
      (await context.request.get(endpoint + "?projectId=" + ids[0])).status(),
    ).toBe(401);
    await page.goto(app + "/__case-local-bootstrap.html");
    const login = async (email) => {
      expect(
        await page.evaluate(
          async ({ email, password }) =>
            (
              await window.localAuth.auth.signInWithPassword({
                email,
                password,
              })
            ).error?.message,
          { email, password },
        ),
      ).toBeUndefined();
    };
    await login(users.outsider.email);
    expect(
      (await context.request.get(endpoint + "?projectId=" + ids[0])).status(),
    ).toBe(401);
    await page.evaluate(() => window.localAuth.auth.signOut());
    await login(users.staff.email);
    expect((await context.request.post(endpoint, { data: {} })).status()).toBe(
      403,
    );
    for (const id of [ids[10], "ffffffff-ffff-4fff-8fff-ffffffffffff"])
      expect(
        (await context.request.get(endpoint + "?projectId=" + id)).status(),
      ).toBe(404);
    mark(
      "Admin real local Auth/middleware: unauthenticated/nonstaff, CSRF, foreign and missing cases denied",
    );
    const get = async (id) =>
      (await (await context.request.get(endpoint + "?projectId=" + id)).json())
        .view;
    const post = async (data) => {
      const r = await context.request.post(endpoint, {
        headers: { "x-requested-with": "me-ish" },
        data,
      });
      expect(r.status()).toBe(200);
      return r.json();
    };
    const action = async (id, command, extra = {}) => ({
      operationId: randomUUID(),
      projectId: id,
      revision: (await get(id)).revision,
      action: { command, ...extra },
    });
    const open = async (id, section = "overview") => {
      await page.goto(app + `/natori/dashboard?case=${id}&section=${section}`);
      await expect(
        page.getByRole("region", { name: "既存操作の統合" }),
      ).toBeVisible();
    };
    const confirm = () => page.getByRole("region", { name: "案件操作の確認" });
    const finish = async () => {
      await confirm()
        .getByRole("button", { name: "確認した内容で実行", exact: true })
        .click();
      await expect(
        confirm().getByRole("button", { name: "確認済みの操作を閉じる" }),
      ).toBeEnabled();
      await confirm()
        .getByRole("button", { name: "確認済みの操作を閉じる" })
        .click();
    };
    if(continuityOnly||scaleOnly){
      const helper=await import('../natori-case-continuity/verify-browser.mjs');
      await (scaleOnly?helper.checkScaleBrowser:helper.checkContinuityBrowser)({page,context,app,api,owner,other,sql,mark,provider,out,metrics,setScaleFault});
      await page.goto(app+'/__case-local-bootstrap.html');await page.evaluate(()=>window.localAuth.auth.signOut());
      expect((await context.request.get(endpoint+'?projectId='+ids[0])).status()).toBe(401);
      const known=new Set(['www.googletagmanager.com','va.vercel-scripts.com']),unexpected=external.filter(host=>!known.has(host));
      expect(unexpected).toEqual([]);expect(errors).toEqual([]);mark('Focused signout denies reads; no unexpected external request or unhandled browser error');
      await context.close();return {checks,errors,external,unexpected,real:'normal schema/local Auth/PostgREST/middleware/API/UI',doubles:'provider transport and Storage catalog; no hosted/Google/iPhone acceptance'};
    }
    if(historyOnly){
      await (await import('../natori-case-history/verify-browser.mjs')).checkHistoryBrowser({page,context,app,api,owner,other,sql,mark,provider,out,users,password});
      await page.goto(app+'/__case-local-bootstrap.html');await page.evaluate(()=>window.localAuth.auth.signOut());
      for(const path of ['case-detail','case-history'])expect((await context.request.get(app+'/api/natori/admin/'+path+'?projectId='+ids[0])).status()).toBe(401);
      const known=new Set(['www.googletagmanager.com','va.vercel-scripts.com']);const unexpected=external.filter(host=>!known.has(host));expect(unexpected).toEqual([]);expect(errors).toEqual([]);
      mark('History signout rejects exact detail/history; no provider or unexpected external requests, no unhandled browser errors');
      await context.close();return {checks,errors,external,unexpected,real:'normal schema/local Auth/PostgREST/middleware/API/UI; business reads only',doubles:'provider transports; Storage catalog; Google/iPhone/hosted not exercised'};
    }
    if(screenOnly){
      await (await import('./verify-screen-browser.mjs')).checkScreenBrowser({page,context,app,owner,sql,post,mark,provider,out});
      await page.goto(app+'/__case-local-bootstrap.html');await page.evaluate(()=>window.localAuth.auth.signOut());
      expect((await context.request.get(endpoint+'?projectId='+ids[0])).status()).toBe(401);
      const known=new Set(['www.googletagmanager.com','va.vercel-scripts.com']),unexpected=external.filter(host=>!known.has(host));
      expect(unexpected).toEqual([]);expect(errors).toEqual([]);mark('Screen signout denies API reads; external attempts blocked; no unhandled errors');
      await context.close();return {checks,errors,external,unexpected,real:'normal business schema / real local Auth/PostgREST/middleware/API/UI',doubles:'Stripe/Resend transports and unavailable Storage; screen-only focused regression'};
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1050 });
      await page.goto(app + "/natori/dashboard?entry=cases");
      await expect(
        page.getByText("表示を取得しました", { exact: true }),
      ).toBeAttached();
      const registration = page.getByRole("region", {
        name: "新しい案件の登録",
      });
      await registration
        .getByRole("button", { name: "案件を登録", exact: true })
        .click();
      await registration.getByLabel("登録方法").selectOption("manual");
      const title = `合成操作案件${width}`;
      await registration
        .getByLabel("登録する案件名", { exact: true })
        .fill(title);
      await registration
        .getByLabel("登録する依頼者名", { exact: true })
        .fill("合成依頼者");
      await registration
        .getByLabel("登録する連絡先メール", { exact: true })
        .fill("synthetic@example.invalid");
      await registration
        .getByLabel("登録する管理額", { exact: true })
        .fill("12000");
      await registration
        .getByRole("button", { name: "登録内容の確認へ" })
        .click();
      await expect(confirm()).toContainText("12000 JPY");
      await confirm()
        .getByRole("button", { name: "確認した内容で実行", exact: true })
        .click();
      await registration
        .getByRole("button", { name: "登録した案件を開く" })
        .click();
      const id = sql(
        `select id from natori_projects where title='${title}' and user_id='${owner}'`,
      );
      expect(id).toMatch(/^[a-f0-9-]{36}$/);
      await expect(
        page.getByRole("region", { name: "案件の共通案内" }),
      ).toContainText(title);
      expect(
        sql(
          `select count(*) from natori_case_work_records where project_id='${id}' and kind='origin' and data->>'origin'='manual'`,
        ),
      ).toBe("1");
      mark(
        `Admin ${width}px registration confirmation creates one case with explicit manual origin`,
      );
      await page
        .getByLabel("担当メモ", { exact: true })
        .fill("保持する基本情報");
      await page.getByRole("button", { name: "基本情報の確認へ" }).click();
      await expect(confirm()).toContainText("保持する基本情報");
      await finish();
      expect(sql(`select note from natori_projects where id='${id}'`)).toBe(
        "保持する基本情報",
      );
      mark(
        `Admin ${width}px basic edit uses frozen case/revision and preserves the saved memo`,
      );
      await open(id, "transaction");
      await page.getByRole("button", { name: "手動入金の確認へ" }).click();
      await expect(confirm()).toContainText(
        "Stripeの成功・見積承諾は生成しません",
      );
      // Change the confirmed amount from a different local writer before executing.
      sql(`update natori_projects set amount=13000 where id='${id}'`);
      await finish();
      expect(
        sql(
          `select payment_confirmed_at is null from natori_projects where id='${id}'`,
        ),
      ).toBe("t");
      await expect(
        page.getByText("現在の管理額：13000 JPY", { exact: false }),
      ).toBeVisible();
      await page.getByRole("button", { name: "手動入金の確認へ" }).click();
      await expect(confirm()).toContainText("13000 JPY");
      await finish();
      expect(
        sql(
          `select count(*) from natori_payment_transactions where project_id='${id}' and status='manual' and amount=13000`,
        ),
      ).toBe("1");
      expect(
        sql(
          `select stripe_payment_session_id is null and quote_accepted_at is null from natori_projects where id='${id}'`,
        ),
      ).toBe("t");
      await expect(
        page.getByText(/現在の管理額：13000 JPY.*入金記録あり/),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "手動入金の確認へ" }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: out + `/admin-${width}.png`,
        fullPage: true,
      });
      mark(
        `Admin ${width}px stale manual amount rejected; refreshed explicit confirmation records manual evidence once, without Stripe or acceptance`,
      );
    }
    const data = {
      mode: "external",
      title: "合成外部相談",
      clientName: "外部依頼者",
      clientEmail: "external@example.invalid",
      type: "illustration",
      status: "inquiry",
      amount: 12000,
      deliveryPlan: "normal",
      startDate: "2026-10-22",
      dueDate: "2026-12-01",
      note: "担当登録",
    };
    const create = {
      operationId: randomUUID(),
      projectId: null,
      revision: null,
      action: { command: "create", data },
    };
    const [a, b] = await Promise.all([post(create), post(create)]);
    expect(a.projectId).toBe(b.projectId);
    const externalId = a.projectId;
    expect(
      sql(
        `select type||'/'||(amount is null)::text||'/'||(due_date is null)::text from natori_projects where id='${externalId}'`,
      ),
    ).toBe("undecided/true/true");
    expect(
      (
        await post({
          ...create,
          action: {
            ...create.action,
            data: { ...data, title: "変更した内容" },
          },
        })
      ).result,
    ).toBe("conflict");
    mark(
      "Admin parallel registration and changed-content replay preserve one external case with unknown type/amount/deadline",
    );
    await open(externalId);
    await page
      .getByLabel("見送りの理由", { exact: true })
      .fill("担当が明示した見送り理由");
    await page.reload();
    await expect(page.getByLabel("見送りの理由", { exact: true })).toHaveValue(
      "担当が明示した見送り理由",
    );
    await page.getByRole("button", { name: "見送りの確認へ" }).click();
    await finish();
    await page.getByRole("button", { name: "保管の確認へ" }).click();
    await finish();
    await page.getByRole("button", { name: "保管から復元の確認へ" }).click();
    await finish();
    expect(
      sql(`select status from natori_projects where id='${externalId}'`),
    ).toBe("closed");
    await page.getByRole("button", { name: "相談再開の確認へ" }).click();
    await finish();
    expect(
      sql(`select status from natori_projects where id='${externalId}'`),
    ).toBe("inquiry");
    mark(
      "Admin close reason survives reload; close, archive, restore and reopen are separate confirmed operations",
    );
    await open(externalId, "transaction");
    await page
      .getByLabel("案件種別（制作タスク）", { exact: true })
      .selectOption("illustration");
    await page.getByRole("button", { name: "種別を確定", exact: true }).click();
    await expect(
      page.getByText("イラスト · 確定済み", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("制作するもの", { exact: true })
      .fill("合成イラスト1点");
    await page.getByLabel("制作範囲", { exact: true }).selectOption("bust_up");
    await page.getByLabel("用途", { exact: true }).fill("合成の利用確認");
    await page.getByLabel("商用利用", { exact: true }).selectOption("no");
    await page.getByLabel("実績公開の条件", { exact: true }).fill("公開不可");
    await page.getByLabel("納品日", { exact: true }).fill("2026-12-01");
    await page.getByRole("button", { name: /条件を保存して金額へ/ }).click();
    await page.getByRole("button", { name: "明細を追加", exact: true }).click();
    await page.reload();
    await expect(page.getByLabel("明細名", { exact: true })).toHaveValue(
      "追加作業",
    );
    await page.getByRole("spinbutton", { name: /単価/ }).fill("18000");
    await page
      .getByRole("button", { name: /明細を保存して送信確認へ/ })
      .click();
    await expect(page.getByLabel("本文", { exact: true })).toHaveValue(
      /合成イラスト/,
    );
    await page.getByRole("button", { name: "個別メールの編集を保存" }).click();
    await expect(
      page.getByRole("button", { name: "個別メールの編集を保存" }),
    ).toBeEnabled();
    await page.getByRole("checkbox").check();
    const beforeMail = provider().length;
    await page.getByRole("button", { name: /正式見積り.*発行/ }).click();
    await expect(page.getByText(/第1版は保存済みです/)).toBeVisible();
    expect(
      sql(
        `select count(*) from natori_quotes where project_id='${externalId}'`,
      ),
    ).toBe("1");
    await page.reload();
    await expect(page.getByText(/第1版は保存済みです/)).toBeVisible();
    expect(provider().length).toBe(beforeMail + 1);
    mark(
      "Admin existing quote conditions/items/mail UI, type confirmation and click-only draft recovery issue one version; reload does not send again",
    );
    const renotify = async (version) => {
      const request = page.waitForRequest(
        (r) =>
          r.url().endsWith("/api/natori/admin/quote-notification") &&
          r.method() === "POST",
      );
      await page
        .getByRole("button", {
          name: `第${version}版を同じ内容で再通知`,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "再通知する", exact: true })
        .click();
      return (await request).postDataJSON();
    };
    const countBeforeRenotify = provider().length,
      repeat = await renotify(1);
    await expect.poll(() => provider().length).toBe(countBeforeRenotify + 1);
    await expect(
      page.getByRole("button", {
        name: "第1版を同じ内容で再通知",
        exact: true,
      }),
    ).toBeEnabled();
    const replay = await context.request.post(
      app + "/api/natori/admin/quote-notification",
      { headers: { "x-requested-with": "me-ish" }, data: repeat },
    );
    expect(replay.status()).toBe(200);
    expect(provider().length).toBe(countBeforeRenotify + 1);
    mark(
      "Admin same-version notice replay returns the saved result with zero extra provider requests",
    );
    await page
      .getByRole("button", { name: "新しい版の作成を確認", exact: true })
      .click();
    await page.getByRole("button", { name: /条件を保存して金額へ/ }).click();
    await page.getByRole("spinbutton", { name: /単価/ }).fill("19000");
    await page
      .getByRole("button", { name: /明細を保存して送信確認へ/ })
      .click();
    await expect(page.getByLabel("本文", { exact: true })).toBeVisible();
    if (
      await page
        .getByRole("button", { name: "本文全体をこの候補へ更新", exact: true })
        .count()
    )
      await page
        .getByRole("button", { name: "本文全体をこの候補へ更新", exact: true })
        .click();
    await page.getByRole("button", { name: "個別メールの編集を保存" }).click();
    await expect(
      page.getByRole("button", { name: "個別メールの編集を保存" }),
    ).toBeEnabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /正式見積り.*発行/ }).click();
    await expect(page.getByText(/第2版は保存済みです/)).toBeVisible();
    expect(
      sql(
        `select count(*) from natori_quotes where project_id='${externalId}'`,
      ),
    ).toBe("2");
    expect(
      sql(
        `select superseded_at is not null from natori_quotes where project_id='${externalId}' and version=1`,
      ),
    ).toBe("t");
    sql(
      `select * from natori_accept_quote((select token_hash from natori_quotes where project_id='${externalId}' and version=2))`,
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "新しい版の作成を確認", exact: true }),
    ).toHaveCount(0);
    const acceptedMailCount = provider().length;
    await renotify(2);
    await expect.poll(() => provider().length).toBe(acceptedMailCount + 1);
    expect(
      sql(
        `select quote_accepted_amount from natori_projects where id='${externalId}'`,
      ),
    ).toBe("19000");
    expect(
      sql(
        `select count(*) from natori_quotes where project_id='${externalId}'`,
      ),
    ).toBe("2");
    mark(
      "Admin revised quote supersedes only the prior version; acceptance locks edits while same-version notification preserves amount and acceptance",
    );
    // Generic initial notifications have no encrypted body until the first sender freezes it.
    const notice = randomUUID(),
      target = ids[0];
    sql(
      `insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,status) select '${notice}','admin-browser/${notice}',p.id,q.id,'quote_accept_artist',jsonb_build_object('title',p.title,'clientName',p.client_name,'amount',q.amount,'acceptedAt',q.accepted_at),'pending' from natori_projects p join natori_quotes q on q.id=p.active_quote_id where p.id='${target}'`,
    );
    await open(target, "transaction");
    // The notice ID is included in the frozen confirmation, not the list row.
    const recovery = page.getByRole("button", {
      name: "この通知の復旧内容を確認",
      exact: true,
    });
    await recovery.last().click();
    await expect(confirm()).toContainText("reply@example.invalid");
    await expect(confirm()).toContainText("見積もりが承諾されました");
    const mailCount = provider().length;
    await finish();
    await expect
      .poll(() =>
        sql(`select status from natori_notification_jobs where id='${notice}'`),
      )
      .toBe("sent");
    expect(provider().length).toBe(mailCount + 1);
    mark(
      "Admin notification recovery shows actual recipient/content and sends only the confirmed series through the local transport double",
    );
    const operation = await action(target, "retry-notice", {
      notificationId: notice,
      previewHash: "a".repeat(64),
    });
    expect((await post(operation)).result).toBe("confirmation_stale");
    expect(
      sql(
        `select count(*) from natori_notification_jobs where notification_key='admin-browser/${notice}'`,
      ),
    ).toBe("1");
    const unknown = randomUUID();
    sql(
      `insert into natori_notification_jobs(id,notification_key,project_id,quote_id,purpose,snapshot,status) values('${unknown}','admin-unknown/${unknown}','${target}',null,'quote_accept_artist','{}','unknown')`,
    );
    await open(target, "transaction");
    expect(
      (await get(target)).notices.find((n) => n.id === unknown).retry_candidate,
    ).toBe(false);
    mark(
      "Admin sent/unknown notifications do not offer blind retries or create another provider key",
    );
    const frozen = await action(target, "details", {
      patch: {
        title: "応答喪失後の保存",
        client_name: "架空依頼者",
        amount: 12000,
        delivery_plan: "normal",
        start_date: null,
        due_date: "2026-11-12",
        note: "同一操作",
      },
    });
    expect((await post(frozen)).result).toBe("applied");
    sql(`update natori_projects set title='後の更新' where id='${target}'`);
    expect((await post(frozen)).replayed).toBe(true);
    expect(sql(`select title from natori_projects where id='${target}'`)).toBe(
      "後の更新",
    );
    mark(
      "Admin response-loss replay returns saved receipt without overwriting a later change",
    );
    await page.goto(app + "/natori/dashboard?entry=cases");
    await expect(
      page.getByText("表示を取得しました", { exact: true }),
    ).toBeAttached();
    const registration = page.getByRole("region", { name: "新しい案件の登録" });
    await registration
      .getByRole("button", { name: "案件を登録", exact: true })
      .click();
    await registration
      .getByLabel("登録する案件名", { exact: true })
      .fill("応答を遮断した合成登録");
    await registration
      .getByLabel("登録する依頼者名", { exact: true })
      .fill("合成依頼者");
    await registration
      .getByRole("button", { name: "登録内容の確認へ" })
      .click();
    const drop = async (route) => {
      await route.fetch();
      await route.abort("failed");
    };
    await context.route(endpoint, drop, { times: 1 });
    await confirm()
      .getByRole("button", { name: "確認した内容で実行", exact: true })
      .click();
    await expect(
      page.getByText(
        "結果を確認できません。同じ操作の記録を照会してください。",
        { exact: true },
      ),
    ).toBeVisible();
    const original = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("natori-case-admin/new")),
    );
    await page.reload();
    await expect(confirm()).toContainText(original.request.operationId);
    await expect(
      confirm().getByRole("button", { name: "実行前の確認を取り消す" }),
    ).toBeDisabled();
    await confirm()
      .getByRole("button", { name: "同じ操作の結果を照会", exact: true })
      .click();
    await expect(
      confirm().getByRole("button", { name: "確認済みの操作を閉じる" }),
    ).toBeEnabled();
    expect(
      sql(
        "select count(*) from natori_projects where title='応答を遮断した合成登録'",
      ),
    ).toBe("1");
    mark(
      "Admin actual response interception after commit, reload and same-ID lookup recover one registration without a replacement command",
    );
    await (await import('./verify-screen-browser.mjs')).checkScreenBrowser({page,context,app,owner,sql,post,mark,provider,out});
    await page.goto(app + "/__case-local-bootstrap.html");
    await page.evaluate(() => window.localAuth.auth.signOut());
    expect(
      (await context.request.get(endpoint + "?projectId=" + target)).status(),
    ).toBe(401);
    expect(
      (
        await context.request.post(endpoint, {
          headers: { "x-requested-with": "me-ish" },
          data: frozen,
        })
      ).status(),
    ).toBe(401);
    const knownTelemetry=new Set(['www.googletagmanager.com','va.vercel-scripts.com']);
    const unexpected=external.filter(host=>!knownTelemetry.has(host));
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    mark(
      "Admin expired/signout session denies reads and writes; known telemetry blocked before network, no unexpected external targets or unhandled errors",
    );
    await context.close();
    return {
      checks,
      errors,
      external,
      unexpected,
      real: "normal business schema / local GoTrue / PostgREST / middleware / API / UI",
      doubles:
        "Stripe and Resend transports; no real mail or payment; Storage catalog only",
    };
  } finally {
    await browser.close();
  }
}
