# 💹 Usage

## 💬 How to use ?

0. Fork this repository
1. Edit [config.yml](config.yml) to add your hosts and settings.
2. (optional) Go to repository `settings` and enable GitHub pages.

You're done !

Connections tests are stored in [hosts](hosts) while generated SVG images are available in [status](status) folder.
You can embed these images anywhere you want, and they'll be updated auto-magically !

Repository can be private and it'll still works if you enabled GitHub pages.

## 🧰 How it works ?

Each 5 minutes (or upon push), the runner will load your `config.yml`.

For each specified hosts, using either `curl`, `ncat` or `telnet`, it will perform a connection test.
Results are saved in [hosts](hosts), compacted each day, and dismissed after 48h.
SVG images that you can embed everywhere for status will be generated in [status](status).

These are commited with the default `GITHUB_TOKEN` so you don't need to create a personal token.

## 🗃️ Structure

* `└── config.yml` contains action configuration

* `└── .github` contains GitHub related files
  * `└── workflows` contains GitHub action workflows
    * `└── connection_tests.yml.yml` contains source code of the connection tests

* `└── source` contains source code
  * `├── tests.ts` contains the connection tests source code
    * To run locally, use `deno run --allow-net --allow-read --allow-write --allow-run --unstable source/tests.ts`
  * `└── server.ts` contains a local server which can be used for development
    * To run locally, use `deno run --allow-net=0.0.0.0 --allow-read --unstable source/server.ts`

* `├── index.html` contains site entry point
* `└── static` contains site static assets
  * `├── script.js` contains executed JavaScript by client
  * `├── styles.css` contains CSS stylesheet applied to client
  * `└── site` contains site config data as JSON `⚙️`

* `├── status` contains SVG images displaying the status for each host/endpoint `⚙️`
* `└── hosts` contains connection tests results for each host/endpoint as JSON `⚙️`
  * `└── list` contains the list of hosts as JSON used by client `⚙️`

* `└── templates` contains templates files
  * `└── status.svg` contains the SVG template used to generate SVG images

Files marked with `⚙️` are auto-generated.
