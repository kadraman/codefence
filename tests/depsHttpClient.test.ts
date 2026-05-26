import assert from "node:assert/strict";
import test from "node:test";
import type { RequestInit as UndiciRequestInit } from "undici";
import { depsDispatcher, depsFetch, depsFetchInit } from "../src/scan/deps/httpClient";

test("depsFetchInit leaves default fetch for auto", () => {
  const init: UndiciRequestInit = depsFetchInit("auto", { method: "POST" });
  assert.equal(init.dispatcher, undefined);
  assert.equal(init.method, "POST");
});

test("depsFetchInit attaches undici dispatcher for on and off", () => {
  const onInit: UndiciRequestInit = depsFetchInit("on");
  const offInit: UndiciRequestInit = depsFetchInit("off");
  assert.ok(onInit.dispatcher);
  assert.ok(offInit.dispatcher);
  assert.notEqual(onInit.dispatcher, offInit.dispatcher);
});

test("depsFetch uses global fetch for auto mode", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;

  globalThis.fetch = (async () => {
    called = true;
    return {
      ok: true,
      json: async () => ({})
    } as Response;
  }) as typeof fetch;

  try {
    await depsFetch("https://example.com/querybatch", "auto", { method: "POST" });
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("depsDispatcher reuses agents per explicit mode", () => {
  assert.equal(depsDispatcher("auto"), undefined);
  const onA = depsDispatcher("on");
  const onB = depsDispatcher("on");
  const off = depsDispatcher("off");
  assert.equal(onA, onB);
  assert.notEqual(onA, off);
});
