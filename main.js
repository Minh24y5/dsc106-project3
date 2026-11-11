const MASK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAGAAAAAAAAAAAAAAGAAAAAAAAAEAAAAGAAAAAAAAAAAAAAHgAAAAAAAOCAAAAHwAAMAAAO+AAAAAH4AAeAAAP+AAAAAH4AAfIAAf+AAAAAH+AA/IAAH8AAAAAP+AA/oAADoAAAAAP/AA/gAAAoAAAAAf/AA/gAAQcAAAAAf+AA/gAAEYAAAAAf4AB/wACwAAAAAAPwAB/4AGQAAAAAAfAA//4AACAAAAABEAB//wCBAAAAAAGAAB//sGHAAAAAAaAAB//eHvAAAAAB4AAB//eP/wAAAAD4gAA//7//4AAAAD/gAAfo///4AAAAH/wAAHA///4QAAAP/wAAYL///+AAAAP/+AAGcf///oAAAP/8wAP/////wAAAf//gAr/////4gAA/+PAABv////gwHz/4IAADx/////QB///2OGA3f/////j/8uOPgAft7////AAPowf4AACI/+MAAAGqA/8AAAwPgIAAAAH5/+AMAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const W = 960, H = 480, $ = s => document.querySelector(s), css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const SC = { s126: { name: "Low emissions", color: "#2a8f6a" }, s585: { name: "High emissions", color: "#c4452d" } };
const VIEWS = [["s126", "Low emissions (SSP1-2.6)"], ["s585", "High emissions (SSP5-8.5)"], ["diff", "The difference"]];
const CITIES = [["Seattle", 47.6, -122.3], ["San Diego", 32.7, -117.2], ["Denver", 39.7, -105], ["Mexico City", 19.4, -99.1], ["New York", 40.7, -74], ["São Paulo", -23.5, -46.6], ["Lima", -12, -77], ["London", 51.5, -.1], ["Madrid", 40.4, -3.7], ["Cairo", 30, 31.2], ["Lagos", 6.5, 3.4], ["Nairobi", -1.3, 36.8], ["Cape Town", -33.9, 18.4], ["Moscow", 55.8, 37.6], ["Delhi", 28.6, 77.2], ["Beijing", 39.9, 116.4], ["Tokyo", 35.7, 139.7], ["Jakarta", -6.2, 106.8], ["Sydney", -33.9, 151.2], ["Perth", -31.9, 115.9], ["Anchorage", 61.2, -149.9], ["Reykjavik", 64.1, -21.9], ["Paris", 48.9, 2.4], ["Berlin", 52.5, 13.4], ["Rome", 41.9, 12.5], ["Istanbul", 41, 29], ["Dubai", 25.2, 55.3], ["Mumbai", 19.1, 72.9], ["Bangkok", 13.8, 100.5], ["Singapore", 1.35, 103.8], ["Seoul", 37.6, 127], ["Shanghai", 31.2, 121.5], ["Karachi", 24.9, 67], ["Tehran", 35.7, 51.4], ["Addis Ababa", 9, 38.7], ["Johannesburg", -26.2, 28], ["Buenos Aires", -34.6, -58.4], ["Bogotá", 4.7, -74.1], ["Santiago", -33.4, -70.7], ["Toronto", 43.7, -79.4], ["Chicago", 41.9, -87.6], ["Los Angeles", 34.1, -118.2], ["Auckland", -36.8, 174.8], ["Oslo", 59.9, 10.8], ["Athens", 38, 23.7], ["Miami", 25.8, -80.2], ["Phoenix", 33.4, -112.1], ["Dhaka", 23.8, 90.4], ["Manila", 14.6, 121], ["Kinshasa", -4.3, 15.3], ["Lisbon", 38.7, -9.1], ["Hanoi", 21, 105.8]];

const proj = d3.geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
const maskBytes = Uint8Array.from(atob(MASK), c => c.charCodeAt(0));
const isLand = i => (maskBytes[i >> 3] >> (7 - (i & 7))) & 1;                  // 4° land mask (coastlines, Land/Ocean tag, % of land)
let D, view = "s585", pix, PLON, PLAT, sel = -1, coord = [0, 0], place = "", token = 0, ranked = [];
const geoCache = {};

/* ---------- map colours: weather-style bands ---------- */
const EDGES = [-40, -30, -20, -10, -4, 4, 10, 20, 30, 40];
const COLORS = ["#6b1d0a", "#a33a0c", "#d4610f", "#f08c2c", "#f8c56a", "#efece3", "#bfe6c0", "#6fcb97", "#2faaa6", "#2078c0", "#35389c"];
const BANDS = COLORS.map(c => d3.rgb(c)), band = v => { let i = 0; while (i < EDGES.length && v >= EDGES[i]) i++; return i };
d3.select("#bar").selectAll("i").data(COLORS).join("i").style("background", d => d);
d3.select("#bar").selectAll("span").data(EDGES).join("span").style("left", (d, i) => (i + 1) / COLORS.length * 100 + "%").text(d => (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(d));

/* ---------- helpers ---------- */
const fromReal = R => ({ ...R, nx: 360 / R.step, ny: 180 / R.step, N: (360 / R.step) * (180 / R.step) });
const ll = c => [-90 + D.step / 2 + Math.floor(c / D.nx) * D.step, -180 + D.step / 2 + (c % D.nx) * D.step];
const cellOf = (lat, lon) => Math.min(D.ny - 1, Math.max(0, Math.floor((lat + 90) / D.step))) * D.nx + Math.min(D.nx - 1, Math.floor((lon + 180) / D.step));
const val = (v, c) => { if (v == "diff") { const a = D.s585.chg[c], b = D.s126.chg[c]; return a == null || b == null ? null : a - b } return D[v].chg[c] };
const sg = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(0), amt = p => `${Math.abs(p).toFixed(0)}% ${p >= 0 ? "higher" : "lower"}`;
const nm = c => { const [a, o] = ll(c); return Math.abs(a).toFixed(0) + "°" + (a < 0 ? "S" : "N") + ", " + Math.abs(o).toFixed(0) + "°" + (o < 0 ? "W" : "E") };
const fmtC = ([a, o]) => `${Math.abs(a).toFixed(2)}°${a < 0 ? "S" : "N"}, ${Math.abs(o).toFixed(2)}°${o < 0 ? "W" : "E"}`;
const wlat = i => Math.cos((-90 + D.step / 2 + Math.floor(i / D.nx) * D.step) * Math.PI / 180);
function nearestCity(lat, lon) { let b = null, bd = 1e9; for (const c of CITIES) { const d = d3.geoDistance([lon, lat], [c[2], c[1]]) * 6371; if (d < bd) { bd = d; b = c } } return bd < 800 ? `Near ${b[0]}` : null }
let lastOsmCall = 0;
async function placeName(lat, lon) {
  const k = lat.toFixed(1) + "," + lon.toFixed(1); if (k in geoCache) return geoCache[k];
  const now = Date.now();
  if (now - lastOsmCall < 800) {
    await new Promise(r => setTimeout(r, 800 - (now - lastOsmCall)));
  }
  lastOsmCall = Date.now();
  let n = null;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const a = ((await res.json()).address) || {};
      n = [...new Set([a.city || a.town || a.village || a.county || a.state_district, a.state || a.region, a.country].filter(Boolean))].join(", ") || null;
    }
  } catch (e) { }
  return geoCache[k] = n || nearestCity(lat, lon) || (isLand(cellOf(lat, lon)) ? "Land region" : "Open ocean");
}

/* ---------- headline strip ---------- */
function headline() {
  const gm = k => { let a = 0, b = 0; for (let i = 0; i < D.N; i++) { const v = D[k].chg[i], p = D.base[i]; if (v == null || p == null) continue; a += wlat(i) * p * (1 + v / 100); b += wlat(i) * p } return 100 * (a / b - 1) };
  const dry = k => { let a = 0, b = 0; for (let i = 0; i < D.N; i++) { const v = D[k].chg[i]; if (v == null || !isLand(i)) continue; b += wlat(i); if (v < 0) a += wlat(i) } return 100 * a / b };
  $("#headline").innerHTML = `By 2081–2100, global rainfall is about <b>${sg(gm("s126"))}%</b> with strong emission cuts and <b>${sg(gm("s585"))}%</b> if emissions keep rising. In the high-emission world <b>${dry("s585").toFixed(0)}%</b> of land gets drier, versus <b>${dry("s126").toFixed(0)}%</b> in the low-emission world.`;
}

/* ---------- map ---------- */
const off = document.createElement("canvas"); off.width = W; off.height = H;
const ctx = $("#cv").getContext("2d"); $("#cv").width = W; $("#cv").height = H;
const svg = d3.select("#ov").attr("viewBox", `0 0 ${W} ${H}`);
let currentTransform = d3.zoomIdentity;
let gMap, markOuter, markInner, worldGeo = null;

function renderCanvas() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(currentTransform.x, currentTransform.y);
  ctx.scale(currentTransform.k, currentTransform.k);
  ctx.beginPath();
  d3.geoPath(proj, ctx)({ type: "Sphere" });
  ctx.fillStyle = css("--ocean");
  ctx.fill();
  ctx.clip();
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

function updateMark() {
  if (sel < 0) return;
  const p = proj([coord[1], coord[0]]);
  if (!p) {
    if (markOuter) markOuter.attr("display", "none");
    if (markInner) markInner.attr("display", "none");
    return;
  }
  const k = currentTransform.k;
  if (markOuter) {
    markOuter.attr("display", null)
      .attr("cx", p[0])
      .attr("cy", p[1])
      .attr("r", 7 / k)
      .style("stroke-width", (2.5 / k) + "px");
  }
  if (markInner) {
    markInner.attr("display", null)
      .attr("cx", p[0])
      .attr("cy", p[1])
      .attr("r", 3 / k)
      .style("stroke-width", (1.5 / k) + "px");
  }
}

const zoom = d3.zoom()
  .scaleExtent([1, 8])
  .translateExtent([[-W * 0.1, -H * 0.1], [W * 1.1, H * 1.1]])
  .on("start", () => {
    d3.select(".stage").classed("is-dragging", true);
  })
  .on("zoom", event => {
    currentTransform = event.transform;
    renderCanvas();
    if (gMap) gMap.attr("transform", currentTransform);
    updateMark();
  })
  .on("end", () => {
    d3.select(".stage").classed("is-dragging", false);
  });

svg.call(zoom);

async function loadWorldGeo() {
  try {
    const r = await fetch("data/world.json");
    if (!r.ok) return;
    const topo = await r.json();
    if (window.topojson) {
      worldGeo = {
        land: topojson.feature(topo, topo.objects.land),
        borders: topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b)
      };
      if (gMap) {
        const pathGen = d3.geoPath(proj);
        gMap.select(".coast").attr("d", pathGen(worldGeo.land));
        gMap.select(".country-borders").attr("d", pathGen(worldGeo.borders));
      }
    }
  } catch (e) { }
}
loadWorldGeo();

function buildMap() {
  pix = new Int32Array(W * H).fill(-1); PLON = new Float32Array(W * H); PLAT = new Float32Array(W * H);
  for (let y = 0; y < H; y++)for (let x = 0; x < W; x++) {
    const p = proj.invert([x + .5, y + .5]);
    if (p && p[0] >= -180 && p[0] < 180 && p[1] > -90 && p[1] < 90) { const n = y * W + x; pix[n] = Math.floor((p[1] + 90) / D.step) * D.nx + Math.floor((p[0] + 180) / D.step); PLON[n] = p[0]; PLAT[n] = p[1] }
  }
  svg.selectAll("*").remove();
  gMap = svg.append("g").attr("class", "map-group").attr("transform", currentTransform);

  const pathGen = d3.geoPath(proj);
  const coastPath = gMap.append("path").attr("class", "coast");
  const bordersPath = gMap.append("path").attr("class", "country-borders");

  if (worldGeo) {
    coastPath.attr("d", pathGen(worldGeo.land));
    bordersPath.attr("d", pathGen(worldGeo.borders));
  } else {
    const tf = d3.geoTransform({ point(x, y) { const p = proj([-180 + x * 4, -90 + y * 4]); this.stream.point(p[0], p[1]) } });
    const m = d3.contours().size([90, 45]).thresholds([.5])(Array.from({ length: 90 * 45 }, (_, i) => isLand(i)))[0];
    coastPath.attr("d", d3.geoPath(tf)(m));
  }

  gMap.append("path").attr("class", "sphere").attr("d", pathGen({ type: "Sphere" }));
  markOuter = gMap.append("circle").attr("class", "mark").attr("display", "none");
  markInner = gMap.append("circle").attr("class", "mark-center").attr("display", "none");
}
function paint() {
  const N = D.N, P = new Float32Array(N).fill(NaN), A = new Float32Array(N).fill(1);
  for (let c = 0; c < N; c++) { const v = val(view, c); if (v != null) P[c] = v; if (view != "diff" && D[view].agree[c] != null) A[c] = D[view].agree[c] }
  const img = new ImageData(W, H), d = img.data;
  for (let n = 0; n < pix.length; n++) {
    const c = pix[n]; if (c < 0) continue;
    const fx = (PLON[n] + 180) / D.step - .5, fy = (PLAT[n] + 90) / D.step - .5, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
    let s = 0, wt = 0;                                                  // bilinear blend -> smooth band edges
    for (let dj = 0; dj < 2; dj++)for (let di = 0; di < 2; di++) {
      const j = Math.min(D.ny - 1, Math.max(0, j0 + dj)), i = (i0 + di + D.nx) % D.nx, v = P[j * D.nx + i];
      if (v === v) { const w = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty); s += w * v; wt += w }
    }
    if (wt < 1e-6) { d[4 * n] = d[4 * n + 1] = d[4 * n + 2] = 150; d[4 * n + 3] = 255; continue }   // too dry for a % change -> grey
    const r = BANDS[band(s / wt)]; let R = r.r, G = r.g, B = r.b;
    if (A[c] < .8 && ((n % W) + Math.floor(n / W)) % 7 < 2) { R = R * .4 + 153; G = G * .4 + 153; B = B * .4 + 153 }   // hatching: models disagree
    d[4 * n] = R; d[4 * n + 1] = G; d[4 * n + 2] = B; d[4 * n + 3] = 255
  }
  off.getContext("2d").putImageData(img, 0, 0);
  renderCanvas();
  $("#lgd").textContent = view == "diff" ? "High minus low emissions, in percentage points of rainfall (← drier in the high world · wetter →)" : "Rainfall change, 2081–2100 vs 1995–2014, in % (← drier · wetter →)";
}

/* ---------- place card ---------- */
const ser = (k, c) => { const t = D[k].ts[c]; return { m: t.slice(0, 30), lo: t.slice(30, 60), hi: t.slice(60, 90) } };
const per = (a, y0, y1) => d3.mean(a.filter((_, i) => D.bins[i] >= y0 && D.bins[i] <= y1));      // mean over 5-year bins starting y0..y1
const mmYr = (c, v) => D.base[c] == null ? null : D.base[c] * 365 * (1 + (v || 0) / 100);
const fm = n => n == null ? "" : "≈" + (n >= 100 ? Math.round(n / 10) * 10 : Math.round(n)).toLocaleString() + " mm";
const feel = n => n < 250 ? "arid" : n < 500 ? "dry" : n < 1000 ? "moderate" : n < 1500 ? "wet" : n < 2500 ? "very wet" : "extremely wet";
function rankPct(k, c) {
  let a = 0, b = 0; const v = D[k].chg[c];
  for (let i = 0; i < D.N; i++) { const x = D[k].chg[i]; if (x == null) continue; const w = wlat(i); b += w; if (x < v) a += w } return 100 * a / b
}
const trend = p => p >= 50 ? `wetter than ${p.toFixed(0)}% of places` : `drier than ${(100 - p).toFixed(0)}% of places`;

function fan(c) {
  const el = d3.select("#fan").html(""), w = Math.max(260, el.node().clientWidth || 320), h = 190, m = { l: 40, r: 14, t: 10, b: 22 }, bins = D.bins, xs = d3.scaleLinear([1950, 2100], [m.l, w - m.r]);
  const S = { s126: ser("s126", c), s585: ser("s585", c) }, all = [...S.s126.lo, ...S.s126.hi, ...S.s585.lo, ...S.s585.hi];
  const ys = d3.scaleLinear([Math.min(0, d3.min(all)), Math.max(0, d3.max(all))], [h - m.b, m.t]).nice(), X = i => xs(bins[i] + 2.5), fut = d3.range(12, 30);
  const g = el.append("svg").attr("viewBox", `0 0 ${w} ${h}`);                 // viewBox = real pixels, so text stays a fixed size
  g.append("line").attr("class", "base").attr("x1", m.l).attr("x2", w - m.r).attr("y1", ys(0)).attr("y2", ys(0));
  for (const k of ["s126", "s585"]) {
    const s = S[k], col = SC[k].color;
    g.append("path").attr("fill", col).attr("opacity", .2).attr("d", d3.area().x(X).y0(i => ys(s.lo[i])).y1(i => ys(s.hi[i]))(fut));
    g.append("path").attr("class", "ln").attr("stroke", col).attr("d", d3.line().x(X).y(i => ys(s.m[i]))(fut))
  }
  g.append("path").attr("class", "ln").attr("stroke", "var(--mute)").attr("d", d3.line().x(X).y(i => ys(S.s126.m[i]))(d3.range(0, 13)));
  g.selectAll("text.y").data(ys.ticks(4)).join("text").attr("x", m.l - 5).attr("y", d => ys(d) + 4).attr("text-anchor", "end").text(d => (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(d) + "%");
  g.selectAll("text.x").data([1950, 2000, 2050, 2100]).join("text").attr("x", d => xs(d)).attr("y", h - 5).attr("text-anchor", d => d == 2100 ? "end" : d == 1950 ? "start" : "middle").text(d => d);
}
function card(c) {
  const a = D.s126.chg[c], b = D.s585.chg[c], today = D.base[c] == null ? null : D.base[c] * 365;
  const head = `<h2 id="place">${place}</h2><div class="coords">${fmtC(coord)}</div>
    <div class="tags"><span>${isLand(c) ? "Land" : "Ocean"}</span>${today != null ? `<span>Today ${fm(today)} a year · ${feel(today)}</span>` : ""}</div>`;
  if (a == null || b == null) { $("#card").innerHTML = head + "<p>Almost no rain falls here, so a % change would be misleading.</p>"; return }
  const S = { s126: ser("s126", c), s585: ser("s585", c) }, E = k => [per(S[k].lo, 2080, 2095), per(S[k].hi, 2080, 2095)];
  const midA = per(S.s126.m, 2040, 2055), midB = per(S.s585.m, 2040, 2055), [loA, hiA] = E("s126"), [loB, hiB] = E("s585");
  const rg = (l, h) => `<small>range ${sg(l)} to ${sg(h)}%</small>`, cell = (v, x) => `${sg(v)}%<small>${fm(mmYr(c, v))} a year</small>${x || ""}`;
  const gapMM = today == null ? "" : `<small>${fm(Math.abs(today * (b - a) / 100))} a year</small>`;
  const n = D.models || 0, ag = Math.min(D.s126.agree[c], D.s585.agree[c]), k1 = Math.round(D.s126.agree[c] * n), k2 = Math.round(D.s585.agree[c] * n);
  $("#card").innerHTML = `<div class="card-grid">
  <div class="card-main">${head}
    <p class="lead">By 2081–2100, yearly rainfall here could be <b>${amt(a)}</b> than today if emissions are cut, or <b>${amt(b)}</b> if they keep rising. Our choices shift the outcome by <b>${Math.abs(b - a).toFixed(0)} percentage points</b>.</p>
    <table class="tbl"><thead><tr><th></th><th class="lo">Low</th><th class="hi">High</th><th>Gap</th></tr></thead><tbody>
      <tr><td>Mid-century<small>2040–2059</small></td><td>${cell(midA)}</td><td>${cell(midB)}</td><td>${sg(midB - midA)} pts</td></tr>
      <tr><td>End of century<small>2081–2100</small></td><td>${cell(a, rg(loA, hiA))}</td><td>${cell(b, rg(loB, hiB))}</td><td>${sg(b - a)} pts${gapMM}</td></tr>
    </tbody></table>
    <p class="agree ${ag >= .8 ? "ok" : "warn"}">${n ? `Low: ${k1} of ${n} models agree on the direction. High: ${k2} of ${n}. ` : ""}${ag >= .8 ? "Fairly confident." : "Models disagree here, so treat with caution."}</p>
  </div>
  <div class="card-side">
    <h4>Rainfall vs 1995–2014, 1950–2100</h4><div id="fan"></div>
    <div class="key"><span style="color:${SC.s126.color}">━ ${SC.s126.name}</span><span style="color:${SC.s585.color}">━ ${SC.s585.name}</span><span>▒ range across models</span></div>
    <p class="note">Against the rest of the planet, this spot trends ${trend(rankPct("s126", c))} with low emissions and ${trend(rankPct("s585", c))} with high emissions. Ranges show the spread among the ${n || "several"} models.</p>
  </div>
</div>`;
  fan(c);
}
function centerOn(lat, lon, targetK = 2.8) {
  const p = proj([lon, lat]);
  if (!p) return;
  const k = Math.min(8, Math.max(currentTransform.k, targetK));
  const x = Math.min(W * 0.1, Math.max(W * 0.9 - W * k, W / 2 - p[0] * k));
  const y = Math.min(H * 0.1, Math.max(H * 0.9 - H * k, H / 2 - p[1] * k));
  svg.transition().duration(650).ease(d3.easeCubicOut)
    .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(k));
}
function go(c, pt, label, shouldCenter = false) {
  sel = c; coord = pt || ll(c); place = label || "Locating…";
  updateMark();
  if (shouldCenter) centerOn(coord[0], coord[1]);
  card(c); const t = ++token;
  if (!label) placeName(coord[0], coord[1]).then(x => { if (t === token) { place = x; d3.select("#place").text(x) } });
}

/* ---------- cities where the choice matters most, surprise ---------- */
function rank() {
  ranked = CITIES.map(([n, la, lo]) => { const c = cellOf(la, lo), a = D.s126.chg[c], b = D.s585.chg[c]; return a == null || b == null ? null : { n, la, lo, c, d: b - a } })
    .filter(Boolean).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  $("#movers").innerHTML = ranked.slice(0, 6).map((r, i) => `<button data-i="${i}"><span>${r.n}</span><b>${sg(r.d)} pts</b></button>`).join("");
}
function goCity(r) { inp.value = r.n; showList([]); go(r.c, [r.la, r.lo], r.n, true) }
function surprise() { const pool = ranked.slice(0, Math.ceil(ranked.length / 2)).filter(r => r.n !== place); if (pool.length) goCity(pool[Math.floor(Math.random() * pool.length)]) }

/* ---------- search box (built-in city list) ---------- */
const inp = $("#city"), sug = d3.select("#sug"), norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
let items = [], act = -1;
function showList(l) { items = l; act = -1; sug.selectAll("li").data(l).join("li").text(d => d[0]).on("mousedown", (e, d) => { e.preventDefault(); pickCity(d) }); sug.property("hidden", !l.length) }
function pickCity(d) { if (!D) return; inp.value = d[0]; showList([]); go(cellOf(d[1], d[2]), [d[1], d[2]], d[0], true) }
inp.oninput = () => { const q = norm(inp.value.trim()); showList(q.length < 2 ? [] : CITIES.filter(c => norm(c[0]).includes(q)).slice(0, 6)) };
inp.onkeydown = e => {
  const n = items.length;
  if (e.key == "ArrowDown" || e.key == "ArrowUp") { e.preventDefault(); if (n) { act = (act + (e.key == "ArrowDown" ? 1 : -1) + n) % n; sug.selectAll("li").classed("on", (d, i) => i === act) } }
  else if (e.key == "Enter") { e.preventDefault(); const q = norm(inp.value.trim()), m = items[act] || items[0] || CITIES.find(c => norm(c[0]) == q); if (m) pickCity(m) }
  else if (e.key == "Escape") showList([])
};
$("#drop").onclick = () => sug.node().hidden ? showList([...CITIES].sort((a, b) => a[0].localeCompare(b[0]))) : showList([]);
document.addEventListener("click", e => { if (!e.target.closest(".combo")) showList([]) });

/* ---------- loading the real data ---------- */
const note = t => { $("#notice").hidden = !t; $("#notice span").textContent = t || "" };
function welcomeCard() {
  $("#card").innerHTML = `
    <h2>Global Climate Atlas</h2>
    <div class="coords">2081–2100 Projections vs 1995–2014 Baseline</div>
    <div class="tags"><span>Global Overview</span><span>34 Climate Models</span></div>
    <p class="lead">Select a scenario above to see how global rainfall shifts under sharp emission cuts versus continued high emissions.</p>
    <div class="welcome-guide">
      <h4>Ways to explore:</h4>
      <ul>
        <li><b>Click anywhere</b> on the map to inspect local projections.</li>
        <li><b>Search a city</b> or click <b>Surprise me</b> above to explore high-divergence locations.</li>
        <li><b>Pan and zoom</b> using the controls, mouse wheel, or touch pinch.</li>
      </ul>
    </div>
  `;
}
function start(R) {
  D = fromReal(R); sel = -1;
  $("#src").textContent = `${D.source} Grid: ${D.step}° cells. Change = 2081–2100 average vs 1995–2014 average. Cells with very little rain are left grey.`;
  buildMap(); paint(); headline(); rank(); welcomeCard();
}
async function load() {
  try {
    const r = await fetch("data/rain_data.json"); if (!r.ok) throw new Error(r.status + " " + r.statusText);
    start(await r.json()); note("");
  } catch (e) {
    note(`Couldn’t load data/rain_data.json (${e.message}). Run make_data.py first, then start a local server in this folder (python -m http.server) and open http://localhost:8000. Or pick the file by hand:`);
  }
}

/* ---------- wiring ---------- */
d3.select("#chips").selectAll("button").data(VIEWS).join("button")
  .text(d => d[1])
  .attr("role", "radio")
  .attr("aria-checked", d => d[0] == view)
  .classed("on", d => d[0] == view)
  .on("click", (e, d) => {
    view = d[0];
    d3.selectAll("#chips button").classed("on", x => x[0] == view).attr("aria-checked", x => x[0] == view);
    if (D) paint();
  });
$("#surprise").onclick = () => { if (D) surprise() };
$("#movers").onclick = e => { const b = e.target.closest("button"); if (b && D) goCity(ranked[+b.dataset.i]) };
$("#pick").onclick = () => $("#file").click();
$("#file").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { start(JSON.parse(await f.text())); note("") } catch (err) { alert("Couldn’t read that file: " + err.message) }
};

/* Zoom Controls HUD & View Reset */
function resetView() {
  currentTransform = d3.zoomIdentity;
  svg.transition().duration(450).ease(d3.easeCubicOut).call(zoom.transform, d3.zoomIdentity);
  renderCanvas();
  if (gMap) gMap.attr("transform", d3.zoomIdentity);
  sel = -1;
  coord = [0, 0];
  place = "";
  token++;
  if (markOuter) markOuter.attr("display", "none");
  if (markInner) markInner.attr("display", "none");
  if (inp) inp.value = "";
  showList([]);
  welcomeCard();
}

$("#zoom-in").onclick = () => {
  svg.transition().duration(300).ease(d3.easeCubicOut).call(zoom.scaleBy, 1.6);
};
$("#zoom-out").onclick = () => {
  svg.transition().duration(300).ease(d3.easeCubicOut).call(zoom.scaleBy, 1 / 1.6);
};
$("#zoom-reset").onclick = resetView;

let pointerStart = null;
svg.on("pointerdown", e => {
  pointerStart = [e.clientX, e.clientY];
});

svg.on("click", e => {
  if (e.defaultPrevented) return;
  if (pointerStart) {
    const dist = Math.hypot(e.clientX - pointerStart[0], e.clientY - pointerStart[1]);
    if (dist > 5) return;
  }
  if (!D) return;
  const [px, py] = d3.pointer(e, $("#ov"));
  const [mx, my] = currentTransform.invert([px, py]);
  if (mx < 0 || mx >= W || my < 0 || my >= H) return;
  const c = pix[Math.floor(my) * W + Math.floor(mx)];
  if (c >= 0) {
    const p = proj.invert([mx, my]);
    if (p) go(c, [p[1], p[0]], null, false);
  }
});

svg.on("mousemove", e => {
  const t = $("#tip");
  if (!D || d3.select(".stage").classed("is-dragging")) { t.style.display = "none"; return }
  const [px, py] = d3.pointer(e, $("#ov"));
  const [mx, my] = currentTransform.invert([px, py]);
  if (mx < 0 || mx >= W || my < 0 || my >= H) { t.style.display = "none"; return }
  const c = pix[Math.floor(my) * W + Math.floor(mx)];
  if (!(c >= 0)) { t.style.display = "none"; return }
  const [la, lo] = ll(c), v = val(view, c), r = $("#ov").getBoundingClientRect();
  t.textContent = `${nearestCity(la, lo) || nm(c)} · ${v == null ? "too dry to tell" : sg(v) + (view == "diff" ? " pts" : "%")}`;
  t.style.display = "block";
  t.style.left = (e.clientX - r.left + 12) + "px";
  t.style.top = (e.clientY - r.top + 12) + "px";
});

svg.on("mouseleave", () => $("#tip").style.display = "none");

/* Keyboard navigation for map stage */
const stageEl = $(".stage");
if (stageEl) {
  stageEl.setAttribute("tabindex", "0");
  stageEl.setAttribute("role", "region");
  stageEl.setAttribute("aria-label", "Interactive world precipitation map. Use arrow keys to pan, plus/minus to zoom, 0 to reset.");
  stageEl.addEventListener("keydown", e => {
    const panStep = 60;
    if (e.key === "ArrowLeft") { e.preventDefault(); svg.transition().duration(150).call(zoom.translateBy, panStep, 0); }
    else if (e.key === "ArrowRight") { e.preventDefault(); svg.transition().duration(150).call(zoom.translateBy, -panStep, 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); svg.transition().duration(150).call(zoom.translateBy, 0, panStep); }
    else if (e.key === "ArrowDown") { e.preventDefault(); svg.transition().duration(150).call(zoom.translateBy, 0, -panStep); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); svg.transition().duration(200).call(zoom.scaleBy, 1.4); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.4); }
    else if (e.key === "0") { e.preventDefault(); resetView(); }
  });
}

let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (D && sel >= 0) card(sel) }, 150) });
load();