import { BUILT_IN_BODIES, bodyKey, normalizeBody } from "@/core/connectorbody";
import type { ConnectorBody } from "@/core/types";

/**
 * The connector bodies kept between drawings.
 *
 * A body somebody has typed in once is offered from then on, in every drawing,
 * so the second time is a pick from a list. It lives in the browser's own
 * storage and not in any drawing: the drawing already holds the bodies it uses,
 * so a file that travels to another machine is complete without it.
 */

const KEY = "harness.bodies";
const LIMIT = 500;

export function loadSavedBodies(): ConnectorBody[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.map(normalizeBody).filter((b): b is ConnectorBody => b !== undefined);
  } catch {
    return [];
  }
}

/** Keeps a body for next time, unless it is one that is always on offer or is already kept. */
export function rememberBody(body: ConnectorBody): void {
  const key = bodyKey(body);
  if (BUILT_IN_BODIES.some((b) => bodyKey(b) === key)) return;
  const list = loadSavedBodies();
  if (list.some((b) => bodyKey(b) === key)) return;
  list.push(body);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-LIMIT)));
  } catch {
    // storage is full or switched off: the body is still on the connector
  }
}
