import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

// 1. Initialize the Express Application and the MCP Core Instance
const app = express();
const server = new McpServer({
  name: "My Live Universal Web MCP Server",
  version: "1.0.0",
});

// 2. Register an Actionable Tool
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

// 3. Define Web-Ready HTTP Cloud Routing Endpoints
let activeTransport = null;

app.get("/sse", async (req, res) => {
  activeTransport = new SSEServerTransport("/messages", res);
  await server.connect(activeTransport);
});

// UNIVERSAL HANDLER FIX: Automatically establish an engine instance if hit directly by ChatGPT
app.post("/messages", express.json(), async (req, res) => {
  if (!activeTransport) {
    activeTransport = new SSEServerTransport("/messages", res);
    await server.connect(activeTransport);
  }
  await activeTransport.handleMessage(req.body, res);
});

// 4. Fire up the web listener
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Custom MCP Web Server is listening on port: ${PORT}`);
});
