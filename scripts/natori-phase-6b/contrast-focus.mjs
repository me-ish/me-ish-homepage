export async function resetContrastFocus(page) {
  await page.getByTestId('outside-focus').evaluate(element => element.focus({ preventScroll: true }));
}

export async function focusForContrast(page, locator) {
  // Tab establishes genuine keyboard modality. Its default navigation is not
  // under test here (the old test also focused the target programmatically).
  // Keep our reset control from scrolling to the Hero and hiding the mobile CTA.
  await page.getByTestId('outside-focus').evaluate(element => {
    element.addEventListener('keydown', event => {
      if (event.key === 'Tab') event.preventDefault();
    }, { once: true });
  });
  await page.keyboard.press('Tab');
  await locator.evaluate(element => (element.closest('button,a') ?? element).focus({ preventScroll: true }));
}

export async function verifyContrastFocus(browser, expect) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await context.route('**/*', route => route.abort('blockedbyclient'));
    const page = await context.newPage();
    await page.setContent(`<style>body{margin:0;height:3000px}#hero{height:600px}a{position:fixed;bottom:20px}a:focus-visible{outline:3px solid black}</style>
      <section id="hero"><button data-testid="outside-focus">Reset</button></section><a href="#" id="cta">Synthetic CTA</a>
      <script>new IntersectionObserver(entries=>{document.querySelector('#cta').hidden=entries[0].isIntersecting}).observe(document.querySelector('#hero'))</script>`);
    const target = page.locator('#cta');
    await page.evaluate(() => scrollTo(0, 900)); await expect(target).toBeVisible();
    await page.getByTestId('outside-focus').focus(); await expect(target).toBeHidden();
    await page.evaluate(() => scrollTo(0, 900)); await expect(target).toBeVisible();
    // Start the corrected probe in pointer modality with focus off the reset
    // control, so a retained keyboard state cannot make it pass accidentally.
    await page.mouse.click(200, 400);
    await resetContrastFocus(page); await focusForContrast(page, target);
    await expect(target).toBeVisible();
    await expect(target).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(900);
    expect(await target.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle === 'solid')).toBe(true);
    return { oldResetHidesCta: true, correctedResetKeepsCta: true, scrollUnchanged: true, keyboardFocusVisible: true };
  } finally { await context.close(); }
}
