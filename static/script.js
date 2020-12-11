(async function () {
  const config = await fetch("static/site").then(response => response.json())
  //Update title
    document.title = config.title ?? "Downtime"
    document.querySelector(".name").innerText = document.title
  //Update logo/favicon
    if (config.favicon) {
      //Update logo
        const img = document.createElement("img")
        img.src = config.favicon
      //Update favicon
        let favicon = document.querySelector("link[rel~='icon']")
        if (!favicon) {
          favicon = document.createElement("link")
          favicon.rel = "icon"
          document.querySelector("head").appendChild(favicon)
        }
        favicon.href = config.favicon
    }
  //Update
    ;(async function update() {
      try {
        const {hosts} = await fetch("hosts/list").then(response => response.json())
        for (const {name, status} of hosts) {
          let img = document.querySelector(`img[data-status='${status}']`)
          if (!img) {
            img = document.createElement("img")
            img.dataset.status = status
            img.alt = name
            document.querySelector("main").append(img)
          }
          img.src = `${status}?t=${Date.now()}`
        }
      } catch {} finally {
        setTimeout(update, (config.refresh_rate_sec ?? 2*60)*1000)
      }
    })()
})()