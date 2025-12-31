// import * as z from "zod";
// import { ScanConfigSchema } from "@artinet/agent-relay";
// import { RelayServer } from "./server.js";

//for smithery
// export const configSchema = z.object({
//   callerId: z.string(),
//   syncInterval: z.number().optional(),
//   scanConfig: ScanConfigSchema.optional(),
// });
// type Config = z.infer<typeof configSchema>;
// export default async function createServer({ config }: { config: Config }) {
//   const server = new RelayServer({
//     name: "agent-relay-server",
//     version: "0.0.1",
//   });
//   await server.init({
//     callerId: config.callerId,
//     syncInterval: config.syncInterval ?? 2500,
//     scanConfig: {
//       ...(config.scanConfig ?? {}),
//       host: config.scanConfig?.host ?? "localhost",
//       startPort: config.scanConfig?.startPort ?? 3000,
//       endPort: config.scanConfig?.endPort ?? 3100,
//       threads: config.scanConfig?.threads ?? 10,
//       fallbackPath:
//         config.scanConfig?.fallbackPath ?? "/.well-known/agent-card.json",
//     },
//   });
//   return server.server;
// }

export * from "./server.js";
export * from "@artinet/agent-relay";
