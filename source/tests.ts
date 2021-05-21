//Imports
  import { ensureDir, exists, walkSync } from "https://deno.land/std@0.97.0/fs/mod.ts"
  import { readAll } from "https://deno.land/std@0.97.0/io/mod.ts"
  import * as YAML from "https://deno.land/std@0.97.0/encoding/yaml.ts"
  import * as ejs from "https://deno.land/x/dejs@0.9.3/mod.ts"
  export default {}

//Types
  type config = any
  type host = any

//Initialization
  const config = YAML.parse(await Deno.readTextFile("config.yml")) as config
  const debug = (left:string, right:string|null = null) => console.debug(`${(right ? left : "*").padEnd(24)} | ${(right ?? left).replace(/\n/g, "\\n").trim()}`)
  await Promise.all(["hosts", "status"].map(directory => ensureDir(directory)))

//Test hosts
  const hosts = await Promise.all(config.hosts.map(async ({name, port = config.defaults?.port ?? 443, ...properties}:host) => {

    //Prepare hostname, filename and paths
      const hostname = `${name}:${port}`
      const filename = encodeURIComponent(hostname).replace(/%[0-9A-F]{2}/gi, "-")
      const path = {hosts:`hosts/${filename}`, status:`status/${filename}.svg`, badges:`status/${filename}-badge.svg`}

    //Prepare host data
      const data = {name, created:new Date()} as host
      //Reload from file
        if (await exists(path.hosts)) {
          Object.assign(data, JSON.parse(await Deno.readTextFile(path.hosts)))
          debug(`loaded ${path.hosts}`)
        }
      //Merge with properties
        Object.assign(data, properties)

    //Perform connection test
      const {use = config.defaults?.use ?? "", timeout = config.defaults?.timeout ?? 30} = data
      debug(hostname, `loaded`)
      //Select command to use
        const command =
          use === "curl" ? `curl -o /dev/null -m ${timeout} -Lsw 'received in %{time_connect} seconds\n' ${hostname}` :
          use === "ncat" ? `ncat -zvw${timeout} ${name} ${port}` :
          `echo -e '\x1dclose\x0d' | telnet ${name} ${443}`
        debug(hostname, `${command}`)
      //Execute command
        const test = Deno.run({cmd:["bash", "-c", command], stdout:"piped", stderr:"piped", stdin:"null"})
        const stdio = (await Promise.all([test.stdout, test.stderr].map(async stdio => new TextDecoder().decode(await readAll(stdio))))).join("\n")
        const {success, code} = await test.status()
        const latency = Number(stdio.match(/received in (?<latency>[0-9.]+) seconds/m)?.groups?.latency)*1000
        debug(hostname, `exited with code ${code} (${success ? "success" : "failed"} - latency ${latency} ms)`)
      //Patch status for curl
        let status = +success
        if ((!status)&&(use === "curl")&&(code === 52)) {
          status = 1
          debug(hostname, `empty curl result, but server is up (code 52)`)
        }

    //Compute results
      const {updated:_last_updated = new Date(), uptime = {tests:[], days:[], overall:NaN, last24h:NaN, latest:NaN}, response_time = {tests:[], days:[], overall:NaN, last24h:NaN, latest:NaN}, tests = 0, status_slow_ms = config.defaults?.status_slow_ms ?? 30*1000} = data
      const last_updated = new Date(_last_updated)
      const updated = new Date()
      for (const {logname, categorie, value} of [
        {logname:"uptime", categorie:uptime, value:status},
        {logname:"response_time", categorie:response_time, value:latency},
      ]) {
        //Skip invalid values
          if (Number.isNaN(value))
            continue
        //Save last value
          categorie.latest = value
          categorie.tests.push({t:updated, v:value})
        //Save overall value
          categorie.overall = Number.isNaN(categorie.overall) ? value : (value+categorie.overall*tests)/(tests+1)
          debug(hostname, `last ${logname} is ${value} (overall ${categorie.overall})`)
        //Save average value over 24 hours
          {
            //Compute average
              const period = new Date(updated)
              period.setHours(-24)
              const filtered = categorie.tests.filter(({t}:{t:Date}) => new Date(t) > period)
              const average = filtered.reduce((sum:number, {v:value}:{v:number}) => sum+value, 0)/filtered.length
            //Save average
              categorie.last24h = average
              debug(hostname, `last 24h ${logname} is ${average}`)
          }
        //Compact values of previous day on new day
          if (last_updated.getDay() !== updated.getDay()) {
            //Compute average
              const yesterday = last_updated.toISOString().substring(0, 10)
              debug(hostname, `compacting ${logname} previous day ${yesterday}`)
              const filtered = categorie.tests.filter(({t}:{t:Date}) => new Date(t).getDay() === last_updated.getDay())
              const average = filtered.reduce((sum:number, {v:value}:{v:number}) => sum+value, 0)/filtered.length
            //Save average
              categorie.days.push({t:yesterday, v:average})
              debug(hostname, `comptacted previous day to ${average} (${filtered.length} values)`)
          }
        //Filter values older than 48h
          {
            //Filter values
              const period = new Date(updated)
              period.setHours(-48)
              const filtered = categorie.tests.filter(({t}:{t:Date}) => new Date(t) > period)
              if (filtered.length < categorie.tests.length) {
                debug(hostname, `filtered ${categorie.tests.length - filtered.length} values of ${name}`)
                categorie.tests = filtered
              }
          }
      }
    //Save result to file
      const result = {port, status_slow_ms,
        ...data, updated, tests:tests+1, uptime, response_time, files:{filename, path},
      }
      delete result.icon
      await Deno.writeTextFile(path.hosts, JSON.stringify(result))

    //Extract domain and favicon
      let domain = name
      try { domain = new URL(`https://${name}`).hostname } catch {
        try { domain = new URL(name).hostname } catch {}
      }
      debug(hostname, `domain is ${domain}`)
      let favicon = null
      try {
        favicon = await fetch(`https://favicongrabber.com/api/grab/${domain}`).then(response => response.json()).then(({icons}) => icons.filter(({src = ""}) => /[.]ico$/.test(src)).shift()?.src) ?? null
        debug(hostname, `fetching favicon from ${favicon}`)
      } catch {
        debug(hostname, `no favicon found`)
      }
    //Load favicon as base64
      const icon = favicon ? await fetch(favicon).then(response => response.blob()).then(blob => new Promise((solve, reject) => {
        const reader = new FileReader()
        reader.onerror = reject
        reader.onload = () => solve(reader.result)
        reader.readAsDataURL(blob)
      })) : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABs0lEQVR4AWL4//8/RRjO8Iucx+noO0O2qmlbUEnt5r3Juas+hsQD6KaG7dqCKPgx72Pe9GIY27btZBrbtm3btm0nO12D7tVXe63jqtqqU/iDw9K58sEruKkngH0DBljOE+T/qqx/Ln718RZOFasxyd3XRbWzlFMxRbgOTx9QWFzHtZlD+aqLb108sOAIAai6+NbHW7lUHaZkDFJt+wp1DG7R1d0b7Z88EOL08oXwjokcOvvUxYMjBFCamWP5KjKBjKOpZx2HEPj+Ieod26U+dpg6lK2CIwTQH0oECGT5eHj+IgSueJ5fPaPg6PZrz6DGHiGAISE7QPrIvIKVrSvCe2DNHSsehIDatOBna/+OEOgTQE6WAy1AAFiVcf6PhgCGxEvlA9QngLlAQCkLsNWhBZIDz/zg4ggmjHfYxoPGEMPZECW+zjwmFk6Ih194y7VHYGOPvEYlTAJlQwI4MEhgTOzZGiNalRpGgsOYFw5lEfTKybgfBtmuTNdI3MrOTAQmYf/DNcAwDeycVjROgZFt18gMso6V5Z8JpcEk2LPKpOAH0/4bKMCAYnuqm7cHOGHJTBRhAEJN9d/t5zCxAAAAAElFTkSuQmCC"

    //Generate status SVG
      await Deno.writeTextFile(path.status, await ejs.renderFileToString("templates/status.svg", {host:{...result, icon}}))
      debug(hostname, `generated ${path.status}`)

    //Generate status badge SVG
      await Deno.writeTextFile(path.badges, await ejs.renderFileToString("templates/badge.svg", {host:{...result, icon}}))
      debug(hostname, `generated ${path.badges}`)

    //Return result
      return result as host
  }))

//Updates
  {
    //Update hosts list
      await Deno.writeTextFile("hosts/list", JSON.stringify({hosts:hosts.map(({name, files}:host) => ({name, status:files.path.status}))}))
      debug(`updated hosts/list`)

    //Update site config
      await Deno.writeTextFile("static/site", JSON.stringify({...config.site}))
      debug(`updated static/site`)

    //Update readme
      await Deno.writeTextFile("README.md", (await Deno.readTextFile("README.md"))
        .replace(/<!-- <downtime-status> -->[\s\S]*?<!-- <downtime-status[/]> -->/g,
          ["<!-- <downtime-status> -->", ...hosts.map((host:host) => `![${host.title ?? host.name}](/${host.files.path.status})`), "<!-- <downtime-status/> -->"].join("\n"))
      )
      debug(`updated README.md`)
  }

//Cleans
  {
    //Clean generated files among hosts and status
      for (const directory of ["hosts", "status"] as const) {
        //List files to keep
          const keeping = [directory, ...hosts.map((host:host) => host.files.path[directory]), ...{hosts:["hosts/list"], status:[...hosts.map((host:host) => host.files.path.badges)]}[directory]]
        //Iterate through directory
          for (const file of walkSync(directory)) {
            //Clean residual files
              if (!keeping.includes(file.path.replace(/[/\\]/g, "/"))) {
                await Deno.remove(file.path)
                debug(`cleaned residual ${file.path}`)
              }
          }
      }
  }