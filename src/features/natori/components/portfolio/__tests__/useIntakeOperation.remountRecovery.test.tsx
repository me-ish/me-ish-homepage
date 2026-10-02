// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useIntakeOperation } from '@/features/natori/components/portfolio/useIntakeOperation';
import { createFrozenIntakeOperation, loadFrozenIntakeOperation, saveFrozenIntakeOperation } from '@/features/natori/data/intakeOperationClient';
import { createInitialPortfolioRequestFormState, buildNatoriRequestDataV1, portfolioOptionChoices } from '@/features/natori/lib/portfolioRequestForm';
import { defaultPortfolioContent } from '@/features/natori/constants/portfolioContent';
import { canonicalizeIntake, canonicalIntakeJson } from '@/features/natori/lib/intakeOperation';

const key = 'natori-intake-operation-v1', fetchMock = vi.fn();
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
function fields() {
  const state = createInitialPortfolioRequestFormState(); state.message = 'Synthetic remount inquiry';
  return { name: 'Synthetic Client', email: 'synthetic@example.invalid', formVersion: 'etorie-request-v1',
    requestData: JSON.stringify(buildNatoriRequestDataV1(state, portfolioOptionChoices(defaultPortfolioContent))), referenceLinks: '[]' };
}
const response = (operationState: string) => new Response(JSON.stringify({ operationState }), { status: 200 });
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { cleanup(); sessionStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('preserves B reload identity when an unmounted A manual check finally reports failed', async () => {
  const a = await createFrozenIntakeOperation(fields(), []); saveFrozenIntakeOperation(key, a);
  const lateManualA = deferred<Response>();
  fetchMock.mockResolvedValueOnce(response('processing')).mockImplementationOnce(() => lateManualA.promise)
    .mockResolvedValueOnce(response('failed')).mockResolvedValueOnce(new Response('{}', { status: 503 }));
  const oldCallback = vi.fn(), newCallback = vi.fn();
  const old = renderHook(() => useIntakeOperation(oldCallback));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  let oldCheck!: Promise<void>;
  act(() => { oldCheck = old.result.current.check(); });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); old.unmount();
  const next = renderHook(() => useIntakeOperation(newCallback));
  await waitFor(() => expect(next.result.current.frozen).toBe(false));
  const form = new FormData(); for (const [name, value] of Object.entries(fields())) form.set(name, value);
  await act(async () => { await next.result.current.submit(form, []); });
  const b = loadFrozenIntakeOperation(key);
  expect(b?.operationId).not.toBe(a.operationId); expect(b?.requestHash).toBe(a.requestHash);
  expect(next.result.current.frozen).toBe(true);
  await act(async () => { lateManualA.resolve(response('failed')); await oldCheck; });
  expect(loadFrozenIntakeOperation(key)).toEqual(b);
  expect(next.result.current.operation?.operationId).toBe(b?.operationId);
  expect(oldCallback).not.toHaveBeenCalled(); expect(newCallback).not.toHaveBeenCalled();
});

it('does not overwrite B or send A when A finishes hashing after its form unmounts', async () => {
  const digest = deferred<ArrayBuffer>();
  const digestSpy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => digest.promise);
  fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
  const form = new FormData(); for (const [name, value] of Object.entries(fields())) form.set(name, value);
  const old = renderHook(() => useIntakeOperation(vi.fn()));
  let oldSubmit!: Promise<void>;
  act(() => { oldSubmit = old.result.current.submit(form, []); });
  await waitFor(() => expect(digestSpy).toHaveBeenCalledTimes(1)); old.unmount();
  const next = renderHook(() => useIntakeOperation(vi.fn()));
  await act(async () => { await next.result.current.submit(form, []); });
  const b = loadFrozenIntakeOperation(key); expect(b).not.toBeNull();
  const bytes = new TextEncoder().encode(canonicalIntakeJson(canonicalizeIntake(fields(), [])));
  await act(async () => { digest.resolve(await crypto.subtle.digest('SHA-256', bytes)); await oldSubmit; });
  expect(loadFrozenIntakeOperation(key)).toEqual(b);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(next.result.current.frozen).toBe(true);
});

it('only the mounted form receives the completed receipt when an old manual response arrives later', async () => {
  const a = await createFrozenIntakeOperation(fields(), []); saveFrozenIntakeOperation(key, a);
  const lateManualA = deferred<Response>();
  const completed = () => new Response(JSON.stringify({ operationState: 'completed', accepted: true, receipt: a.operationId }), { status: 200 });
  fetchMock.mockResolvedValueOnce(response('processing')).mockImplementationOnce(() => lateManualA.promise).mockImplementationOnce(completed);
  const oldCallback = vi.fn(), nextCallback = vi.fn();
  const old = renderHook(() => useIntakeOperation(oldCallback)); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  let oldCheck!: Promise<void>; act(() => { oldCheck = old.result.current.check(); });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)); old.unmount();
  renderHook(() => useIntakeOperation(nextCallback));
  await waitFor(() => expect(nextCallback).toHaveBeenCalledExactlyOnceWith({ receipt: a.operationId, clientEmail: 'synthetic@example.invalid' }));
  await act(async () => { lateManualA.resolve(completed()); await oldCheck; });
  expect(oldCallback).not.toHaveBeenCalled();
  expect(loadFrozenIntakeOperation(key)).toEqual(a);
});

it('preserves B storage even when the former A form remains mounted', async () => {
  const a = await createFrozenIntakeOperation(fields(), []); saveFrozenIntakeOperation(key, a);
  const oldResponse = deferred<Response>();
  fetchMock.mockResolvedValueOnce(response('processing')).mockImplementationOnce(() => oldResponse.promise)
    .mockResolvedValueOnce(response('failed')).mockResolvedValueOnce(new Response('{}', { status: 503 }));
  const old = renderHook(() => useIntakeOperation(vi.fn())); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  let oldCheck!: Promise<void>; act(() => { oldCheck = old.result.current.check(); }); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const next = renderHook(() => useIntakeOperation(vi.fn())); await waitFor(() => expect(next.result.current.frozen).toBe(false));
  const form = new FormData(); for (const [name, value] of Object.entries(fields())) form.set(name, value);
  await act(async () => { await next.result.current.submit(form, []); }); const b = loadFrozenIntakeOperation(key);
  await act(async () => { oldResponse.resolve(response('failed')); await oldCheck; });
  expect(loadFrozenIntakeOperation(key)).toEqual(b); expect(next.result.current.frozen).toBe(true);
});

it('does not let an older disabled lifecycle catch/finally clear a newer job busy or notice', async () => {
  const oldDigest = deferred<ArrayBuffer>(), pendingB = deferred<Response>();
  const digestSpy = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => oldDigest.promise);
  fetchMock.mockImplementation(() => pendingB.promise);
  const hook = renderHook(({ enabled }) => useIntakeOperation(vi.fn(), enabled), { initialProps: { enabled: true } });
  const form = new FormData(); for (const [name, value] of Object.entries(fields())) form.set(name, value);
  let oldSubmit!: Promise<void>; act(() => { oldSubmit = hook.result.current.submit(form, []); });
  await waitFor(() => expect(digestSpy).toHaveBeenCalledTimes(1));
  hook.rerender({ enabled: false }); hook.rerender({ enabled: true });
  let newSubmit!: Promise<void>; act(() => { newSubmit = hook.result.current.submit(form, []); });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const b = loadFrozenIntakeOperation(key), message = hook.result.current.message;
  await act(async () => { oldDigest.reject(new Error('Synthetic old digest rejected')); await oldSubmit; });
  expect(hook.result.current.busy).toBe(true); expect(hook.result.current.message).toBe(message);
  expect(loadFrozenIntakeOperation(key)).toEqual(b);
  await act(async () => { pendingB.resolve(new Response('{}', { status: 503 })); await newSubmit; });
  expect(hook.result.current.busy).toBe(false); expect(hook.result.current.frozen).toBe(true);
});
