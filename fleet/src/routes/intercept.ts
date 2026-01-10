/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import { RequestAgentRoute } from "./request/types/definitions.js";
import { API } from "@artinet/types";

export class InterceptBuilder<
  Req extends API.APIRequest = RequestAgentRoute["request"],
  Res extends API.APIResponse = RequestAgentRoute["response"],
  Context extends armada.BaseContext = RequestAgentRoute["context"]
> {
  constructor(
    private readonly intercepts: armada.Intercept<
      Req,
      Res,
      Req | Res,
      Context
    >[] = []
  ) {}

  build(): armada.Intercept<Req, Res, Req | Res, Context>[] {
    return this.intercepts;
  }

  request(
    action: armada.Intercept<Req, Res, Req, Context>["action"],
    trigger?: armada.Intercept<Req, Res, Req, Context>["trigger"]
  ): InterceptBuilder<Req, Res, Context> {
    this.intercepts.push({
      action,
      trigger: trigger ?? true,
      phase: armada.Phase.REQUEST,
    });
    return new InterceptBuilder(this.intercepts);
  }

  response(
    action: armada.Intercept<Req, Res, Res, Context>["action"],
    trigger?: armada.Intercept<Req, Res, Res, Context>["trigger"]
  ): InterceptBuilder<Req, Res, Context> {
    this.intercepts.push({
      action,
      trigger: trigger ?? true,
      phase: armada.Phase.RESPONSE,
    });
    return new InterceptBuilder(this.intercepts);
  }
}
export type Middleware = InterceptBuilder;
export const Middleware = InterceptBuilder;
