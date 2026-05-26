import {
  Agent,
  fetch as undiciFetch,
  type Dispatcher,
  type RequestInit as UndiciRequestInit
} from "undici";
import { DepsHttp2Mode } from "./types";

const agents = new Map<Exclude<DepsHttp2Mode, "auto">, Agent>();

function agentForMode(mode: Exclude<DepsHttp2Mode, "auto">): Agent {
  let agent = agents.get(mode);
  if (!agent) {
    agent = new Agent({ allowH2: mode === "on" });
    agents.set(mode, agent);
  }
  return agent;
}

export function depsDispatcher(http2Mode: DepsHttp2Mode): Dispatcher | undefined {
  if (http2Mode === "auto") {
    return undefined;
  }
  return agentForMode(http2Mode);
}

/** Merge undici dispatcher settings for dependency provider HTTP calls. */
export function depsFetchInit(http2Mode: DepsHttp2Mode, init: UndiciRequestInit = {}): UndiciRequestInit {
  const dispatcher = depsDispatcher(http2Mode);
  if (!dispatcher) {
    return init;
  }
  return { ...init, dispatcher };
}

export async function depsFetch(url: string, http2Mode: DepsHttp2Mode, init: UndiciRequestInit) {
  const requestInit = depsFetchInit(http2Mode, init);
  if (http2Mode === "auto") {
    return globalThis.fetch(url, requestInit as RequestInit);
  }
  return undiciFetch(url, requestInit);
}
