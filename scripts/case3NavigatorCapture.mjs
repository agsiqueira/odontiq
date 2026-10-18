// Local-only verification proxy. Never records Authorization or API keys.
import http from "node:http";
import fs from "node:fs";
const output = process.env.CASE3_CAPTURE;
if (!output) throw Error("CASE3_CAPTURE is required");
let fault = null;
http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/__fault") {
    let body = ""; for await (const chunk of req) body += chunk;
    fault = JSON.parse(body); res.end("armed"); return;
  }
  let body = ""; for await (const chunk of req) body += chunk;
  const record = { at: new Date().toISOString(), path: req.url, request: JSON.parse(body) };
  const classification = body.includes("schemaVersion") && body.includes("student-current");
  record.kind = body.includes("currentProviderMessage") ? "explanation" : classification ? "classifier" : "generation";
  try {
    if (fault && (!fault.kind || fault.kind === record.kind)) {
      record.injected = true; record.status = fault.status; record.response = "injected local verification failure";
      if (--fault.remaining <= 0) fault = null;
    } else {
      const upstream = await fetch(`https://api.ai.it.ufl.edu${req.url}`, {
        method: "POST", headers: { "content-type": "application/json", authorization: req.headers.authorization }, body,
      });
      record.status = upstream.status; record.response = await upstream.text();
    }
    fs.appendFileSync(output, JSON.stringify(record) + "\n");
    res.writeHead(record.status, { "content-type": "application/json" }); res.end(record.response);
  } catch (error) {
    record.error = error.message; fs.appendFileSync(output, JSON.stringify(record) + "\n");
    res.writeHead(502); res.end('{"error":"local upstream transport failure"}');
  }
}).listen(3011, "127.0.0.1", () => console.log("Navigator capture proxy listening on loopback 3011"));
