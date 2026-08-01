// Who Is Heating the Planet? (CS 416 narrative visualization)
// Martini glass structure: scenes 1-3 tell the story, scene 4 is free exploration.
// Data: Our World in Data (Global Carbon Budget 2025), preprocessed into data/co2.csv

// ---------------- parameters (the state of the visualization) ----------------
const focusCountries = ["China", "United States", "India", "Russia", "Japan", "United Kingdom"];

let currentScene = 0;      // which scene is displayed (0-3)
let metric = "total";      // "total" or "percap", the y-axis used in the explorer
let selected = focusCountries.slice();   // countries shown in the explorer

let allData = [];          // rows of data/co2.csv
let countryList = [];      // every country in the dataset
let minYear, maxYear;

// chart layout
const width = 960, height = 540;
const margin = { top: 30, right: 150, bottom: 44, left: 64 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

const WORLD_AVG = 4.73;    // world per-person emissions in 2024 (tonnes)

// fixed colors so the six focus countries look the same in every scene
const colors = {
  "World": "#3d4552",
  "China": "#d62728",
  "United States": "#1f77b4",
  "India": "#e8871a",
  "Russia": "#8c564b",
  "Japan": "#2ca02c",
  "United Kingdom": "#9467bd",
  "European Union (27)": "#17becf"
};
const extraColor = d3.scaleOrdinal(d3.schemeSet2.concat(d3.schemeDark2));
function colorOf(c) { return colors[c] || extraColor(c); }

const scenes = [
  {
    title: "Global Emissions Keep Climbing",
    subtitle: "Global annual CO2 emissions from fossil fuels and industry, 1850-2024",
    copy: "In 1850 the world emitted about 0.2 billion tonnes of CO2 per year. In 2024 it " +
      "was a record 38.6 billion tonnes, almost 200 times more. Most of that growth came " +
      "after 1950, and the curve has never really turned down. Even COVID in 2020 only " +
      "made a small dent, and it was gone within a year. Click Next to see which " +
      "countries are behind this."
  },
  {
    title: "Who Emits the Most Has Changed",
    subtitle: "Annual CO2 emissions for six major emitters, 1850-2024",
    copy: "For most of this history, emissions came from the West. Britain was the biggest " +
      "emitter in the 1800s, and the US led through the whole 20th century until it peaked " +
      "in 2005 (it is down about 20% since). Then China industrialized faster than any " +
      "country ever, passed the US in 2006, and now emits more than the other five " +
      "countries in this chart combined. India is now third. But totals are only part " +
      "of the story."
  },
  {
    title: "Per Person, It Looks Different",
    subtitle: "Annual CO2 emissions per person for the same six countries",
    copy: "Per person, the picture changes. The average American emits 14.2 tonnes per " +
      "year, about 1.6x the average person in China and 6.5x the average person in India. " +
      "The UK, where industrialization started, is now below the world average. So who is " +
      "responsible depends on whether you count countries or people. Now you can explore " +
      "the data yourself."
  },
  {
    title: "Explore the Data",
    subtitle: "45 countries plus World and EU totals, both metrics, 1850-2024",
    copy: "Some things to try: add Qatar (41 tonnes per person, the highest in the world) " +
      "and compare it with Ethiopia (0.1). Look at what happened to Russia and Ukraine " +
      "after the Soviet Union fell in 1991. Or flip any set of countries between total " +
      "and per person and watch the story change."
  }
];

// ---------------- data loading ----------------
d3.csv("data/co2.csv", function (d) {
  return {
    country: d.country,
    year: +d.year,
    total: +d.total_mt / 1000,   // megatonnes -> billions of tonnes (Gt)
    percap: d.per_capita_t === "" ? null : +d.per_capita_t
  };
}).then(function (data) {
  allData = data;
  countryList = [...new Set(data.map(d => d.country))].sort();
  minYear = d3.min(data, d => d.year);
  maxYear = d3.max(data, d => d.year);
  init();
  render();
}).catch(function (err) {
  console.error("Could not load data/co2.csv", err);
  document.getElementById("scene-copy").style.color = "#c0392b";
  document.getElementById("scene-copy").textContent =
    "ERROR: could not load data/co2.csv: " + err.message +
    " (if you opened index.html straight from disk, run a local web server instead)";
});

// ---------------- small data helpers ----------------
function getSeries(country, whichMetric) {
  const points = [];
  for (const d of allData) {
    if (d.country !== country) continue;
    const v = (whichMetric === "total") ? d.total : d.percap;
    if (v != null) points.push({ year: d.year, value: v });
  }
  return points;
}

function getValue(country, year, whichMetric) {
  const row = allData.find(d => d.country === country && d.year === year);
  if (!row) return null;
  return (whichMetric === "total") ? row.total : row.percap;
}

function formatValue(v, whichMetric) {
  if (whichMetric === "percap") return v.toFixed(2) + " t";
  if (v >= 1) return v.toFixed(2) + " Gt";
  const mt = v * 1000;
  return (mt < 10 ? mt.toFixed(1) : Math.round(mt)) + " Mt";
}

// ---------------- rendering ----------------
function render() {
  const s = scenes[currentScene];
  document.getElementById("scene-title").textContent = "Scene " + (currentScene + 1) + ": " + s.title;
  document.getElementById("scene-subtitle").textContent = s.subtitle;
  const copy = document.getElementById("scene-copy");
  copy.style.color = "";
  copy.textContent = s.copy;

  // the explorer controls only exist in the last scene (martini glass)
  const controls = document.getElementById("controls");
  const hint = document.getElementById("explore-hint");
  if (currentScene === 3) {
    controls.classList.remove("hidden");
    hint.classList.remove("hidden");
  } else {
    controls.classList.add("hidden");
    hint.classList.add("hidden");
  }

  document.getElementById("btn-back").disabled = (currentScene === 0);
  document.getElementById("btn-next").disabled = (currentScene === 3);
  const dots = document.querySelectorAll("#scene-dots .dot");
  for (let i = 0; i < dots.length; i++) {
    if (i === currentScene) dots[i].classList.add("active");
    else dots[i].classList.remove("active");
  }

  document.getElementById("tooltip").style.display = "none";

  // clear the svg and rebuild the scene from scratch
  d3.select("#chart").selectAll("*").remove();
  if (currentScene === 0) drawScene1();
  else if (currentScene === 1) drawScene2();
  else if (currentScene === 2) drawScene3();
  else drawScene4();
}

// Shared chart template used by every scene: axes, gridlines, one line per
// country, and a name label at the end of each line.
function drawBase(countries, whichMetric, options) {
  options = options || {};
  const g = d3.select("#chart").append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const seriesList = [];
  for (const c of countries) {
    const points = getSeries(c, whichMetric);
    if (points.length > 0) seriesList.push({ country: c, points: points });
  }

  const x = d3.scaleLinear().domain([minYear, maxYear]).range([0, innerW]);
  let yMax = 0;
  for (const s of seriesList) yMax = Math.max(yMax, d3.max(s.points, p => p.value));
  const y = d3.scaleLinear().domain([0, yMax * 1.06]).nice().range([innerH, 0]);

  const grid = g.append("g").attr("class", "grid")
    .call(d3.axisLeft(y).ticks(6).tickSize(-innerW).tickFormat(""));
  grid.select(".domain").remove();

  g.append("g").attr("class", "axis")
    .attr("transform", "translate(0," + innerH + ")")
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));

  const yAxis = g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
  yAxis.select(".domain").remove();

  g.append("text").attr("class", "axis-title")
    .attr("x", -margin.left + 10).attr("y", -14)
    .text(whichMetric === "total" ? "billion tonnes of CO2 per year (Gt)"
                                  : "tonnes of CO2 per person per year");

  const lineGen = d3.line().x(p => x(p.year)).y(p => y(p.value));

  if (options.area) {
    const areaGen = d3.area().x(p => x(p.year)).y0(innerH).y1(p => y(p.value));
    g.append("path")
      .attr("fill", "#1f77b4").attr("opacity", 0.1)
      .attr("d", areaGen(seriesList[0].points));
  }

  for (const s of seriesList) {
    g.append("path")
      .attr("class", "series")
      .attr("fill", "none")
      .attr("stroke", colorOf(s.country))
      .attr("stroke-width", 2.2)
      .attr("d", lineGen(s.points));
    const last = s.points[s.points.length - 1];
    g.append("text")
      .attr("class", "line-label")
      .attr("x", x(last.year) + 7)
      .attr("y", y(last.value) + 4)
      .attr("fill", colorOf(s.country))
      .text(s.country);
  }

  // dashed world-average reference line for the per-person scenes
  if (options.worldAvg && WORLD_AVG < y.domain()[1]) {
    g.append("line").attr("class", "ref-line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", y(WORLD_AVG)).attr("y2", y(WORLD_AVG));
    g.append("text").attr("class", "ref-label")
      .attr("x", 250).attr("y", y(WORLD_AVG) + 15)
      .text("World average, 2024: 4.7 t per person");
  }

  return { g: g, x: x, y: y };
}

// Annotation template used in every scene: a ring on the data point, a
// connector line, a bold title, and body text (lines broken by hand).
// Everything fades in together just after the chart appears.
function annotate(g, px, py, dx, dy, titleText, bodyLines, anchor) {
  const a = g.append("g").attr("class", "annotation").attr("opacity", 0);
  a.append("line").attr("class", "anno-line")
    .attr("x1", px).attr("y1", py)
    .attr("x2", px + dx).attr("y2", py + dy);
  a.append("circle").attr("class", "anno-dot")
    .attr("cx", px).attr("cy", py).attr("r", 4.5);
  const t = a.append("g")
    .attr("transform", "translate(" + (px + dx) + "," + (py + dy) + ")")
    .attr("text-anchor", anchor || "start");
  t.append("text").attr("class", "anno-title").text(titleText);
  for (let i = 0; i < bodyLines.length; i++) {
    t.append("text").attr("class", "anno-body")
      .attr("y", 17 + i * 15)
      .text(bodyLines[i]);
  }
  a.transition().delay(500).duration(400).attr("opacity", 1);
}

// ---------------- the four scenes ----------------
function drawScene1() {
  const c = drawBase(["World"], "total", { area: true });
  annotate(c.g, c.x(1950), c.y(getValue("World", 1950, "total")), -205, -130,
    "The post-war boom",
    ["Emissions took off after World", "War II. Annual output is up", "6.5x since 1950."]);
  annotate(c.g, c.x(2020), c.y(getValue("World", 2020, "total")), -80, -60,
    "The 2020 COVID dip",
    ["Lockdowns only cut emissions", "5% in 2020, and they bounced", "back within a year."], "end");
  annotate(c.g, c.x(2024), c.y(getValue("World", 2024, "total")), 10, 30,
    "2024: highest ever",
    ["38.6 billion tonnes,", "a new record."]);
}

function drawScene2() {
  const c = drawBase(focusCountries, "total", {});
  annotate(c.g, c.x(1850), c.y(getValue("United Kingdom", 1850, "total")), 16, -170,
    "Britain led the way",
    ["In 1850, Britain alone", "produced 62% of the", "world's CO2 emissions."]);
  annotate(c.g, c.x(2006), c.y(getValue("China", 2006, "total")), -190, -140,
    "China passes the US in 2006",
    ["China industrialized faster than", "any country in history. It now", "emits more than the other five", "countries in this chart combined."]);
  annotate(c.g, c.x(2005), c.y(getValue("United States", 2005, "total")), -105, -12,
    "US peak: 2005", []);
}

function drawScene3() {
  const c = drawBase(focusCountries, "percap", { worldAvg: true });
  annotate(c.g, c.x(1973), c.y(getValue("United States", 1973, "percap")), -195, 12,
    "US peak: 1973",
    ["Per person, US emissions", "peaked in 1973 at 22 tonnes.", "They are down 36% since."]);
  annotate(c.g, c.x(1971), c.y(getValue("United Kingdom", 1971, "percap")), -80, -32,
    "UK peak: 1971", []);
  annotate(c.g, c.x(2022), c.y(getValue("United Kingdom", 2022, "percap")), 17, 26,
    "2022: below average", []);
  annotate(c.g, c.x(2024), c.y(getValue("China", 2024, "percap")), 8, 40,
    "China: 8.7 t", ["1.8x the world average"]);
  annotate(c.g, c.x(2024), c.y(getValue("India", 2024, "percap")), 8, 26,
    "India: 2.2 t", ["6.5x below the US"]);
}

function drawScene4() {
  if (selected.length === 0) {
    d3.select("#chart").append("text")
      .attr("x", width / 2).attr("y", height / 2)
      .attr("text-anchor", "middle").attr("fill", "#5b6472")
      .text("Add a country to begin exploring.");
    return;
  }
  const c = drawBase(selected, metric, { worldAvg: metric === "percap" });
  addHover(c.g, c.x, c.y);
}

// ---------------- hover tooltip (free-form exploration, scene 4 only) ----------------
function addHover(g, x, y) {
  const tooltip = document.getElementById("tooltip");

  const focusLine = g.append("line")
    .attr("y1", 0).attr("y2", innerH)
    .attr("stroke", "#8a93a1").attr("stroke-dasharray", "3 3")
    .style("display", "none");
  const focusDots = g.append("g");

  g.append("rect")
    .attr("width", innerW).attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const mx = d3.pointer(event)[0];
      let year = Math.round(x.invert(mx));
      if (year < minYear) year = minYear;
      if (year > maxYear) year = maxYear;

      const rows = [];
      for (const c of selected) {
        const v = getValue(c, year, metric);
        if (v != null) rows.push({ country: c, value: v });
      }
      if (rows.length === 0) {
        // no data at this year for any selected country, so hide everything
        focusLine.style("display", "none");
        focusDots.selectAll("circle").remove();
        tooltip.style.display = "none";
        return;
      }
      rows.sort((a, b) => b.value - a.value);

      focusLine.style("display", null).attr("x1", x(year)).attr("x2", x(year));
      focusDots.selectAll("circle").remove();
      for (const r of rows) {
        focusDots.append("circle")
          .attr("cx", x(year)).attr("cy", y(r.value)).attr("r", 3.5)
          .attr("fill", colorOf(r.country))
          .attr("stroke", "#fff").attr("stroke-width", 1.2);
      }

      let html = '<div class="tt-year">' + year + "</div>";
      for (const r of rows) {
        html += '<div class="tt-row"><span class="swatch" style="background:' + colorOf(r.country) +
          '"></span><span>' + r.country + '</span><span class="tt-val">' +
          formatValue(r.value, metric) + "</span></div>";
      }
      tooltip.innerHTML = html;
      let left = event.pageX + 14;
      if (left > window.innerWidth - 210) left = event.pageX - 200;
      tooltip.style.left = left + "px";
      tooltip.style.top = (event.pageY - 30) + "px";
      tooltip.style.display = "block";
    })
    .on("mouseleave", function () {
      focusLine.style("display", "none");
      focusDots.selectAll("circle").remove();
      tooltip.style.display = "none";
    });
}

// ---------------- triggers: every control changes a parameter, then re-renders ----------------
function showScene(i) {
  if (i < 0 || i > 3) return;
  currentScene = i;
  render();
}

function init() {
  // scene dots
  const dotsDiv = document.getElementById("scene-dots");
  for (let i = 0; i < scenes.length; i++) {
    const b = document.createElement("button");
    b.className = "dot";
    b.title = "Scene " + (i + 1) + ": " + scenes[i].title;
    b.onclick = function () { showScene(i); };
    dotsDiv.appendChild(b);
  }

  document.getElementById("btn-back").onclick = function () { showScene(currentScene - 1); };
  document.getElementById("btn-next").onclick = function () { showScene(currentScene + 1); };

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.key === "ArrowRight") showScene(currentScene + 1);
    if (e.key === "ArrowLeft") showScene(currentScene - 1);
  });

  // some browsers restore the checked radio after a reload, so read it back
  metric = document.querySelector('input[name="metric"]:checked').value;
  const radios = document.querySelectorAll('input[name="metric"]');
  for (const r of radios) {
    r.onchange = function () { metric = this.value; render(); };
  }

  document.getElementById("country-select").onchange = function () {
    if (!this.value) return;
    selected.push(this.value);
    updateControls();
    render();
  };

  updateControls();
}

// rebuild the country chips and the dropdown from the current selection
function updateControls() {
  const chipsDiv = document.getElementById("chips");
  chipsDiv.innerHTML = "";
  for (const c of selected) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = '<span class="swatch" style="background:' + colorOf(c) + '"></span>' + c;
    const btn = document.createElement("button");
    btn.textContent = "x";
    btn.title = "Remove " + c;
    btn.onclick = function () {
      selected = selected.filter(s => s !== c);
      updateControls();
      render();
    };
    chip.appendChild(btn);
    chipsDiv.appendChild(chip);
  }

  const select = document.getElementById("country-select");
  select.innerHTML = '<option value="">+ Add a country...</option>';
  for (const c of countryList) {
    if (selected.includes(c)) continue;
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  }
}
