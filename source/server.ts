//Import
  import * as fs from "https://deno.land/std@0.80.0/fs/mod.ts"
  import * as Server from "https://deno.land/std@0.80.0/http/server.ts"

//Serve requests
  const server = Server.serve({hostname:"0.0.0.0", port:4000})
  for await (const request of server) {
    const path = request.url.replace(/^[/]/, "").replace(/[?].*$/, "").replace(/^$/, "index.html")
    if (await fs.exists(path))
      request.respond({status:200, body:await Deno.readTextFile(path)})
    else
      request.respond({status:404})
  }