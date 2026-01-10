/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

import * as armada from "@artinet/armada";
import * as sdk from "@artinet/sdk";

export class InMemoryStore
  extends sdk.Manager<armada.StoredAgent>
  implements armada.IDataStore<armada.StoredAgent>
{
  async search(query: string): Promise<armada.StoredAgent[]> {
    return Array.from(this.data.values()).filter(
      (value) =>
        value.uri.includes(query) ||
        value.name.includes(query) ||
        value.configuration?.instructions?.includes?.(query)
    );
  }
}
