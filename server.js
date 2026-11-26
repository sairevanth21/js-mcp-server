import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// 1. Initialize the Express Application and the MCP Core Instance
const app = express();
const server = new McpServer({
  name: "My Universal Web MCP Server",
  version: "1.0.0",
});

// 2. Register Your Actionable Tool
server.tool(
  "fetch-mock-data",
  {
    endpoint: z.string().describe("The mock database resource to pull data from, such as 'posts' or 'users'")
  },
  async ({ endpoint }) => {
    try {
      const response = await fetch(`https://typicode.com{endpoint}`);
      if (!response.ok) throw new Error(`Server returned HTTP status ${response.status}`);
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

// 3. Robust, Standardized SSE Transport Binding (Handles ChatGPT & Cline automatically)
let activeTransport = null;

// The endpoint ChatGPT hits to look up tools and track routes
app.get("/sse", async (req, res) => {
  activeTransport = new SSEServerTransport("/messages", res);
  await server.connect(activeTransport);
});

// The message endpoint where incoming JSON-RPC execution payloads are automatically handled
app.post("/messages", express.json(), async (req, res) => {
  if (activeTransport) {
    await activeTransport.handleMessage(req, res);
  } else {
    // If ChatGPT hits messages first during discovery, instantly spin up a fallback bridge
    activeTransport = new SSEServerTransport("/messages", res);
    await server.connect(activeTransport);
    await activeTransport.handleMessage(req, res);
  }
});

// 4. Fire up the web listener explicitly bound to 0.0.0.0 for external cloud access
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Custom MCP Web Server is listening on port: ${PORT}`);
});
