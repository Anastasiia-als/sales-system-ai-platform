const http = require("http"); const fs = require("fs"); const path = require("path");
const puppeteer = require(path.join(__dirname, "..", "node_modules", "puppeteer"));
const ROOT = path.join(__dirname, "..");
const PORT = 4005;
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".jpg":"image/jpeg"};
http.createServer((req,res)=>{ const p=decodeURIComponent(req.url.split("?")[0]);
  let f=path.join(ROOT, p==="/"?"index.html":p);
  fs.readFile(f,(e,d)=>{ if(e){ res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"}); res.end(d); });
}).listen(PORT, async ()=>{
  const browser = await puppeteer.launch({headless:"new",args:["--no-sandbox"]});
  const page = await browser.newPage();
  let errors = [];
  page.on("pageerror", e=>errors.push(e.message.slice(0,150)));
  await page.goto(`http://localhost:${PORT}/#/`, {waitUntil:"domcontentloaded", timeout: 20000});
  await new Promise(r=>setTimeout(r, 1500));
  const routes = ["/audit", "/services", "/scripts", "/trainings", "/automation", "/ai-solutions", "/support", "/cases", "/blog", "/about", "/success", "/privacy", "/refund", "/terms", "/contacts", "/consultation", "/admin", "/portal", "/client", "/"];
  let fails = 0;
  for (const r of routes) {
    await page.evaluate((h)=>{ window.location.hash = "#"+h; }, r);
    await new Promise(res=>setTimeout(res, 800));
    const len = await page.evaluate(()=>document.getElementById("app-content").innerHTML.length);
    const ok = len > 200;
    if (!ok) fails++;
    console.log((ok?"OK  ":"FAIL") + " " + r + " (content " + len + " chars)");
  }
  console.log("pageerrors:", errors.length ? errors : "none");
  await browser.close(); process.exit((fails || errors.length) ? 1 : 0);
});
