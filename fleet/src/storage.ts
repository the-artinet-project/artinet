import * as armada from "@artinet/armada";
import * as SDK from "@artinet/sdk";

export class InMemoryStore
  extends SDK.Manager<armada.StoredAgent>
  implements armada.IDataStore<armada.StoredAgent>
{
  async search(query: string): Promise<armada.StoredAgent[]> {
    return Array.from(this.data.values()).filter(
      (value) =>
        value.agentId.includes(query) ||
        value.name.includes(query) ||
        value.prompt.includes(query)
    );
  }
}
