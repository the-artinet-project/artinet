import { fullDeployment } from "@artinet/sdk";
import { deployment } from "./lib/deployment.js";

/*
 * This is a simple example of how to deploy an agent to the Artinet platform.
 * It uses the fullDeployment function to deploy the agent to the platform.
 * The agent is deployed to the platform and the deployment receipt is logged to the console.
 * @returns {Promise<DeploymentReceipt>} - The deployment receipt
 * @throws {Error} - If the deployment fails
 * Deployments are expirimental, if it fails wait up to 10 minutes and check your account before retrying.
 * ALWAYS TEST DEPLOYMENT BEFORE DEPLOYING TO THE ARTINET PLATFORM.
 * @requires ARTINET_API_KEY environment variable to be set
 */

const deploymentReceipt = await fullDeployment(deployment).catch((err) => {
  console.error(err);
});

console.log("Deployment Succeeded:", deploymentReceipt);
