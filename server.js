import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. Initialize the Javascript MCP Server
const server = new McpServer({
  name: "My First Local MCP Server",
  version: "1.0.0",
});

// 2. Expose an Actionable Tool for the AI to use
server.tool(
  "fetch-mock-data",
  {
    endpoint: z.string().describe("The mock database resource to pull data from, such as 'posts' or 'users'")
  },
  async ({ endpoint }) => {
    try {
      const response = await fetch(`https://typicode.com{endpoint}`);
      
      if (!response.ok) {
        throw new Error(`Server returned HTTP status ${response.status}`);
      }
      
      const payload = await response.json();
      
      return {
        content: [{ type: "text", text: JSON.stringify(payload.slice(0, 3), null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Failed to fetch payload: ${error.message}` }],
        isError: true
      };
    }
  }
);

// 3. Connect using standard terminal pipelines (Free local transport)
const transport = new StdioServerTransport();
await server.connect(transport);

// Note: Use console.error for logs so we don't break the communication channel
console.error("Local JavaScript MCP Server successfully started.");
