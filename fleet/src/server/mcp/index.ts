import { mountRelayServer } from '@artinet/armada/mcp';
import { Settings } from '../../settings.js';
import { StoredAgent } from '@artinet/armada';
import { RelayServer } from '@artinet/agent-relay-mcp';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

export async function mountMCP(settings: Settings): Promise<RelayServer> {
    const relay = await mountRelayServer(
        {
            implementation: {
                name: 'fleet-mcp',
                version: '0.0.1',
            },
            config: {
                callerId: `fleet-mcp`,
            },
        },
        settings,
        async (data: StoredAgent) => await settings.load(data.configuration!, { ...settings, agentId: data.uri }),
    );
    return relay;
}

export async function mountMCPMem(relay: RelayServer): Promise<InMemoryTransport> {
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await relay.connect(serverTransport);
    return clientTransport;
}
