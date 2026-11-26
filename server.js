import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const app = express();

// 1. Initialize the Base Server Capabilities
const mcpCapabilities = {
  name: "My Universal Web MCP Server",
  version: "1.0.0"
};

// 2. Define Web-Ready HTTP Cloud Routing Endpoints
// Each distinct connection request gets its own transport wrapper lifecycle mapped natively
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  
  // Create an independent server session instance dynamically for this connection
  const sessionServer = new Server(mcpCapabilities, { capabilities: { tools: {} } });
  
  // Setup Tool Discovery Capabilities
  sessionServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "fetch-mock-data",
        description: "The mock database resource to pull data from, such as 'posts' or 'users'",
        inputSchema: {
          type: "object",
          properties: {
            endpoint: { type: "string", description: "Resource name like 'posts' or 'users'" }
          },
          required: ["endpoint"]
        }
      }
    ]
  }));

  // Setup Action Tool Handling Configurations
  sessionServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "fetch-mock-data") {
      const endpoint = request.params.arguments?.endpoint || "posts";
      try {
        const response = await fetch(`https://typicode.com{endpoint}`);
        if (!response.ok) throw new Error(`HTTP status ${response.status}`);
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
    throw new Error(`Tool not found: ${request.params.name}`);
  });

  // Track and attach this specific session to its active network transport channel
  req.app.set("mcpSession", sessionServer);
  await sessionServer.connect(transport);
});

// Endpoint where incoming JSON-RPC execution payloads are securely handled
app.post("/messages", express.json(), async (req, res) => {
  const sessionServer = req.app.get("mcpSession");
  
  if (sessionServer) {
    // Route the message directly to the active SDK session instance
    const transport = sessionServer.transport;
    if (transport && typeof transport.handleMessage === "function") {
      await transport.handleMessage(req.body, res);
    } else {
      res.status(500).send("Active transport wrapper channel is uninitialized.");
    }
  } else {
    // If ChatGPT hits messages first during discovery, respond with valid schemas instantly
    res.json({
      jsonrpc: "2.0",
      result: {
        tools: [
          {
            name: "fetch-mock-data",
            description: "The mock database resource to pull data from, such as 'posts' or 'users'",
            inputSchema: { type: "object", properties: { endpoint: { type: "string" } }, required: ["endpoint"] }
          }
        ]
      },
      id: req.body.id || 1
    });
  }
});

// 3. Fire up the web listener explicitly bound to 0.0.0.0
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Custom MCP Web Server is listening on port: ${PORT}`);
});
