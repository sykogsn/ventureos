import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import {
  AUTH_NAVIGATION_CACHE_CONTROL,
  applyAuthNavigationHeaders,
} from "./navigation-headers";

describe("auth navigation headers", () => {
  it("marks navigations as private and unstoreable", () => {
    const response = applyAuthNavigationHeaders(NextResponse.next());
    assert.equal(
      response.headers.get("Cache-Control"),
      AUTH_NAVIGATION_CACHE_CONTROL,
    );
    assert.match(AUTH_NAVIGATION_CACHE_CONTROL, /no-store/);
  });
});
