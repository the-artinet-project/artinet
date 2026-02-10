import * as armada from '@artinet/armada';
export type CreateAgentRoute = armada.AgentsRoute;
export const CreateAgent = armada.CreateAgent;
export const CreateAgentRequestSchema = armada.CreateAgentRequestSchema;
export type CreateAgentMount<Session extends object> = armada.AgentsRouteMount<Session>;
