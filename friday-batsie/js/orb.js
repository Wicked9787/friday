/* Friday orb — cinematic WebGL particle renderer (looks N, F, M, H).
   Additive particles, glossy black core, bloom, filmic tone, auto quality.
   No keys. Procedural and time-driven so it never loops like a video. */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;
  var CORE_R = 0.42;
  var CAM = 3.6;

  var SHELLS4 = [
    { r: 0.58, tilt: [0.35, 0.0, 0.55], spin: 1, seed: 11, cbias: 0.55, speed: 0.22 },
    { r: 0.74, tilt: [-0.55, 0.3, -0.35], spin: -1, seed: 23, cbias: 0.0, speed: 0.16 },
    { r: 0.90, tilt: [1.05, 0.0, 0.25], spin: 1, seed: 37, cbias: 0.45, speed: 0.28 },
    { r: 1.06, tilt: [0.20, 0.5, -0.95], spin: -1, seed: 41, cbias: 0.0, speed: 0.13 }
  ];

  var QUALITY = {
    high: { name: "high", dpr: 2.5, dens: 1.0, dust: 2800, streams: 3200, bloom: 3, point: 1.0 },
    med:  { name: "med",  dpr: 2.0, dens: 0.62, dust: 1600, streams: 1800, bloom: 2, point: 1.08 },
    low:  { name: "low",  dpr: 1.5, dens: 0.36, dust: 800, streams: 900, bloom: 1, point: 1.18 }
  };

  function mulberry(seed) {
    var s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngAt(seed) { return mulberry(seed); }
  function urand(rng, a, b) { return a + (b - a) * rng(); }
  function irand(rng, a, b) { return a + (rng() * (b - a + 1) | 0); }
  function gauss(rng, mu, sig) {
    var u = Math.max(1e-9, rng()), v = rng();
    return mu + sig * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
  function lognormal(rng, mean, sigma) { return Math.exp(mean + sigma * gauss(rng, 0, 1)); }
  function unit(x, y, z) {
    var n = Math.hypot(x, y, z) || 1;
    return [x / n, y / n, z / n];
  }
  function unitRand(rng) {
    return unit(gauss(rng, 0, 1), gauss(rng, 0, 1), gauss(rng, 0, 1));
  }
  function rot(ax, ay, az) {
    az = az || 0;
    var cx = Math.cos(ax), sx = Math.sin(ax);
    var cy = Math.cos(ay), sy = Math.sin(ay);
    var cz = Math.cos(az), sz = Math.sin(az);
    var Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
    var Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
    var Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
    return mulm(Rz, mulm(Rx, Ry));
  }
  function mulm(A, B) {
    var C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], i, j, k;
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
      var s = 0; for (k = 0; k < 3; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
    return C;
  }
  function applym(M, p) {
    return [
      M[0][0] * p[0] + M[0][1] * p[1] + M[0][2] * p[2],
      M[1][0] * p[0] + M[1][1] * p[1] + M[1][2] * p[2],
      M[2][0] * p[0] + M[2][1] * p[1] + M[2][2] * p[2]
    ];
  }
  function sph(lat, lon, r) {
    r = r == null ? 1 : r;
    var cl = Math.cos(lat);
    return [r * cl * Math.cos(lon), r * Math.sin(lat), r * cl * Math.sin(lon)];
  }
  function noise1d(t, rng, n, base) {
    n = n || 4; base = base || 3;
    var v = 0, k, f, ph, seeds = [];
    for (k = 0; k < n; k++) seeds.push([urand(rng, 0.7, 1.3), urand(rng, 0, TAU)]);
    return function (x) {
      var s = 0;
      for (k = 0; k < n; k++) {
        f = base * Math.pow(1.9, k) * seeds[k][0];
        s += Math.sin(x * f + seeds[k][1]) / Math.pow(1.6, k);
      }
      return s / 1.9;
    };
  }
  function dashedKeep(t, nfn, duty) {
    // Approximate a duty cut without a global quantile: keep if noise is high.
    return nfn(t) > (1 - 2 * duty) * 0.35;
  }

  function Fracture(rng, nPlates, missing, gap) {
    this.centers = [];
    this.dead = [];
    this.gap = gap;
    var i;
    for (i = 0; i < nPlates; i++) this.centers.push(unitRand(rng));
    var nDead = Math.round(nPlates * missing);
    var idx = this.centers.map(function (_, i) { return i; });
    for (i = idx.length - 1; i > 0; i--) {
      var j = irand(rng, 0, i), tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    this.dead = idx.slice(0, nDead);
    this._deadSet = {};
    for (i = 0; i < this.dead.length; i++) this._deadSet[this.dead[i]] = true;
  }
  Fracture.prototype.plate = function (p) {
    var best = 0, b2 = 0, d1 = 1e9, d2 = 1e9, i, c, d, dx, dy, dz;
    for (i = 0; i < this.centers.length; i++) {
      c = this.centers[i];
      dx = p[0] - c[0]; dy = p[1] - c[1]; dz = p[2] - c[2];
      d = dx * dx + dy * dy + dz * dz;
      if (d < d1) { d2 = d1; b2 = best; d1 = d; best = i; }
      else if (d < d2) { d2 = d; b2 = i; }
    }
    return { id: best, gap: (Math.sqrt(d2) - Math.sqrt(d1)) < this.gap };
  };
  Fracture.prototype.keep = function (p) {
    var pl = this.plate(p);
    if (this._deadSet[pl.id] || pl.gap) return false;
    return true;
  };
  Fracture.prototype.isEdge = function (p) {
    var pl = this.plate(p);
    return !this._deadSet[pl.id] && pl.gap === false ? false : (!this._deadSet[pl.id] && pl.gap);
  };

  var STRIDE = 12; // floats: pos3, data4, shell1, stream4

  function ParticleBuf() {
    this.arr = [];
  }
  ParticleBuf.prototype.add = function (p, intensity, heat, size, silver, shell, stream) {
    stream = stream || [0, 0, 0, 0];
    this.arr.push(
      p[0], p[1], p[2],
      intensity, heat, size, silver,
      shell,
      stream[0], stream[1], stream[2], stream[3]
    );
  };
  ParticleBuf.prototype.count = function () { return this.arr.length / STRIDE; };
  ParticleBuf.prototype.float32 = function () { return new Float32Array(this.arr); };

  function buildShell(buf, shellIndex, spec, dens, k, user) {
    var rng = rngAt(spec.seed * 997 + 13);
    var M = rot(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
    var r = spec.r;
    var fr = new Fracture(rngAt(spec.seed), 30, 0.46, 0.05);
    var cbias = user ? Math.min(1, 0.45 + spec.cbias) : spec.cbias;
    var nLat = Math.max(40, (220 * dens * r) | 0);
    var nMer = Math.max(40, (200 * dens * r) | 0);
    var nDust = Math.max(80, (2200 * dens * r) | 0);
    var nEq = Math.max(60, (280 * dens) | 0);
    var nEdge = Math.max(80, (700 * dens * r) | 0);
    var nCrack = Math.max(30, (180 * dens) | 0);
    var i, lat, lon, th, p, q, keep, sv, inten, heat, size;

    function put(pt, I, H, S, sil) {
      q = applym(M, [pt[0] * r, pt[1] * r, pt[2] * r]);
      buf.add(q, I * k, H, S, sil, shellIndex, null);
    }

    function ring(lat0, ii, n, duty) {
      var nfn = noise1d(0, rng, 4, 4);
      for (i = 0; i < n; i++) {
        th = urand(rng, 0, TAU);
        if (!dashedKeep(th, nfn, duty)) continue;
        p = sph(lat0 + gauss(rng, 0, 0.004), th);
        if (!fr.keep(p)) continue;
        sv = rng() < cbias ? 1 : 0;
        put(p, ii * urand(rng, 0.5, 1.0), urand(rng, 0.5, 0.9), 0, sv);
      }
    }
    ring(0.5, 0.55, nLat, 0.6);
    ring(-0.5, 0.55, nLat, 0.6);

    for (var mer = 0; mer < 3; mer++) {
      lon = mer * Math.PI / 3 + urand(rng, -0.1, 0.1);
      var nfn = noise1d(0, rng, 4, 6);
      for (i = 0; i < nMer; i++) {
        var t = rng();
        if (!dashedKeep(t * TAU, nfn, 0.55)) continue;
        p = sph((t - 0.5) * TAU, lon);
        if (!fr.keep(p)) continue;
        sv = rng() < cbias ? 1 : 0;
        put(p, 0.45 * urand(rng, 0.5, 1.0), urand(rng, 0.45, 0.8), 0, sv);
      }
    }

    for (i = 0; i < nDust; i++) {
      p = unitRand(rng);
      if (!fr.keep(p)) continue;
      var big = rng() < 0.05;
      sv = rng() < cbias ? 1 : 0;
      put(p, (big ? 0.6 : 0.12) * urand(rng, 0.4, 1.4), urand(rng, 0.3, 0.85), big ? 1 : 0, sv);
    }

    for (i = 0; i < nEdge; i++) {
      p = unitRand(rng);
      var pl = fr.plate(p);
      if (fr._deadSet[pl.id]) continue;
      if (!pl.gap && rng() > 0.08) continue;
      sv = rng() < Math.max(cbias, 0.2) ? 1 : 0;
      put(p, 0.7 * urand(rng, 0.45, 1.0), urand(rng, 0.7, 0.95), rng() < 0.08 ? 1 : 0, sv);
    }
    for (i = 0; i < nCrack; i++) {
      p = unitRand(rng);
      if (fr.keep(p) && rng() > 0.15) continue;
      put(p, 0.5 * urand(rng, 0.4, 1), urand(rng, 0.7, 0.9), 0, rng() < cbias ? 1 : 0);
    }

    // equator orbit ring stays mostly whole
    [[0.0, 2.4], [0.022, 1.0], [-0.022, 0.7]].forEach(function (pair) {
      var nfn2 = noise1d(0, rng, 4, 3);
      for (i = 0; i < nEq; i++) {
        th = urand(rng, 0, TAU);
        if (!dashedKeep(th, nfn2, 0.82)) continue;
        p = sph(pair[0] + gauss(rng, 0, 0.003), th);
        p = [p[0] * 1.01, p[1] * 1.01, p[2] * 1.01];
        sv = rng() < cbias ? 1 : 0;
        put(p, pair[1] * urand(rng, 0.5, 1.0), urand(rng, 0.6, 0.95), 0, sv);
      }
    });
  }

  function buildHShell(buf, dens, k, user) {
    var rng = rngAt(7);
    var VIEW = rot(-24 * Math.PI / 180, 18 * Math.PI / 180, -8 * Math.PI / 180);
    var fr = new Fracture(rngAt(19), 28, 0.4, 0.045);
    var svBias = user ? 0.62 : 0.28;
    function put(pt, I, H, S, sil) {
      if (!fr.keep(pt) && rng() > 0.12) return;
      buf.add(applym(VIEW, pt), I * k, H, S, sil, 7, null);
    }
    var i, t, lat, lon, p, sv, nfn, keep;
    // meridians
    for (i = 0; i < 12; i++) {
      lon = i * Math.PI / 12 + urand(rng, -0.05, 0.05);
      nfn = noise1d(0, rng, 4, urand(rng, 4, 9));
      var nn = Math.max(40, (160 * dens) | 0);
      for (t = 0; t < nn; t++) {
        var u = t / nn;
        if (!dashedKeep(u * TAU, nfn, urand(rng, 0.45, 0.8))) continue;
        p = sph((u - 0.5) * TAU, lon, 1 + urand(rng, -0.01, 0.01));
        sv = rng() < svBias ? 1 : 0;
        put(p, 1.1 * urand(rng, 0.5, 1.2), 0.55 + urand(rng, -0.15, 0.2), 0, sv);
      }
    }
    // parallels
    [-0.9, -0.6, -0.3, 0.0, 0.3, 0.55, 0.8].forEach(function (lat0) {
      nfn = noise1d(0, rng, 4, urand(rng, 4, 9));
      var nn = Math.max(30, (140 * dens * Math.max(0.25, Math.cos(lat0))) | 0);
      for (t = 0; t < nn; t++) {
        var u = t / nn;
        if (!dashedKeep(u * TAU, nfn, urand(rng, 0.5, 0.85))) continue;
        p = sph(lat0, u * TAU, 1);
        sv = rng() < svBias ? 1 : 0;
        put(p, 0.55 * urand(rng, 0.6, 1.0), 0.55 + urand(rng, -0.15, 0.2), 0, sv);
      }
    });
    // hero band
    for (var s = 0; s < 7; s++) {
      var dl = (s - 3.5) * 0.012 + gauss(rng, 0, 0.004);
      var rr = 1 + urand(rng, -0.015, 0.02);
      nfn = noise1d(0, rng, 4, 6);
      var nn = Math.max(50, (220 * dens) | 0);
      for (t = 0; t < nn; t++) {
        var u = t / nn;
        if (!dashedKeep(u * TAU, nfn, 0.75)) continue;
        p = sph(0.42 + dl + 0.01 * Math.sin(u * TAU * 3 + s), u * TAU, rr);
        sv = rng() < svBias ? 1 : 0;
        put(p, 1.2 * urand(rng, 0.3, 1.0), urand(rng, 0.45, 0.9), 0, sv);
      }
    }
    // shell dust
    var nd = Math.max(200, (3500 * dens) | 0);
    for (i = 0; i < nd; i++) {
      var uu = urand(rng, -1, 1), th = urand(rng, 0, TAU);
      var rad = 1 + Math.abs(gauss(rng, 0, 0.025)) * (rng() < 0.5 ? -1 : 1);
      var ss = Math.sqrt(Math.max(0, 1 - uu * uu));
      p = [ss * Math.cos(th) * rad, uu * rad, ss * Math.sin(th) * rad];
      var f = Math.sin(p[0] * 5.1 + 1.3) * Math.sin(p[1] * 4.3 + 0.7) * Math.sin(p[2] * 6.2 + 2.1);
      if (rng() > 0.35 + 0.65 * (f > -0.05 ? 1 : 0)) continue;
      var big = rng() < 0.06;
      sv = rng() < svBias ? 1 : 0;
      put(p, 0.10 * urand(rng, 0.3, 1.6) * (big ? 3 : 1), urand(rng, 0.25, 0.8), big ? 1 : 0, sv);
    }
    // volume dust inside
    var nv = Math.max(80, (900 * dens) | 0);
    for (i = 0; i < nv; i++) {
      p = unitRand(rng);
      var rad2 = Math.pow(rng(), 1 / 2.2) * 0.97;
      p = [p[0] * rad2, p[1] * rad2, p[2] * rad2];
      sv = rng() < svBias ? 1 : 0;
      buf.add(applym(VIEW, p), 0.06 * k * urand(rng, 0.3, 1.5), urand(rng, 0.3, 0.8), 0, sv, 7, null);
    }
  }

  function buildRingCore(buf, radius, dens, k, silverBias, shellId, tilt) {
    var rng = rngAt(101);
    var M = rot(tilt[0], tilt[1], tilt[2] || 0);
    var rings = [
      [radius, 0.012, Math.max(80, (900 * dens) | 0), 1.4, 0.5, 0],
      [radius, 0.005, Math.max(40, (280 * dens) | 0), 1.8, 0.75, 1],
      [radius * 0.62, 0.006, Math.max(30, (220 * dens) | 0), 1.0, 0.7, 0],
      [radius * 1.55, 0.004, Math.max(30, (200 * dens) | 0), 0.7, 0.6, 0]
    ];
    rings.forEach(function (R) {
      for (var i = 0; i < R[2]; i++) {
        var th = urand(rng, 0, TAU);
        var rad = R[0] + gauss(rng, 0, R[1]);
        var p = applym(M, [rad * Math.cos(th), gauss(rng, 0, R[1] * 0.6), rad * Math.sin(th)]);
        var sv = rng() < silverBias ? 1 : 0;
        buf.add(p, R[3] * k * urand(rng, 0.5, 1.0), urand(rng, R[4], 1.0), R[5], sv, shellId, null);
      }
    });
  }

  function buildStreams(buf, n) {
    var STREAMS = [
      [0.0, 1.00, -0.014, 0.00, 1.00],
      [1.0, 1.00, 0.010, 0.55, 0.92],
      [0.0, 0.95, 0.024, 1.10, 0.80],
      [1.0, 0.95, -0.028, 1.65, 0.70],
      [0.0, 0.40, 0.045, 0.30, 0.55],
      [1.0, 0.40, -0.048, 0.85, 0.50],
      [0.0, 0.32, 0.000, 2.20, 0.40]
    ];
    var rng = rngAt(606);
    var per = Math.max(40, (n / STREAMS.length) | 0);
    STREAMS.forEach(function (S) {
      for (var i = 0; i < per; i++) {
        var x = urand(rng, -2.55, 2.55);
        var z = gauss(rng, 0, 0.012);
        var heat = urand(rng, 0.65, 1.0);
        var size = rng() < 0.01 ? 1 : 0;
        var inten = S[1] * urand(rng, 0.5, 1.0) * 0.55;
        buf.add([x, S[2], z], inten, heat, size, S[0], 9, [S[2], S[3], S[4], S[1]]);
      }
    });
  }


  function addPal(buf, p, I, H, size, sil, shell, pal, extra) {
    extra = extra || [0, 0, 0];
    buf.add(p, I, H, size, sil, shell, [extra[0], extra[1], extra[2], pal || 0]);
  }

  function phraseJS(t) {
    function bump(t, a, b, pw) {
      if (t <= a || t >= b) return 0;
      var u = (t - a) / (b - a);
      return Math.pow(Math.sin(Math.PI * u), pw);
    }
    return 0.06 + bump(t, 0.02, 0.41, 0.85) + 0.92 * bump(t, 0.47, 0.975, 0.8);
  }

  function buildWave(buf, dens, opts) {
    opts = opts || {};
    var rng = rngAt(opts.seed || 77);
    var goldW = opts.goldW == null ? 1 : opts.goldW;
    var silvW = opts.silvW == null ? 1 : opts.silvW;
    var strands = opts.strands || 2;
    var nEach = Math.max(80, (900 * dens * (opts.dense || 1)) | 0);
    var style = opts.style || 0; // 0 wave, 1 fan, 2 folds, 3 bundle
    var smoke = opts.smoke || 0;
    var sparkle = !!opts.sparkle;
    var palG = opts.palG || 0, palS = opts.palS || 0;
    var y0 = opts.y0 == null ? 0 : opts.y0;
    var spread0 = opts.spread == null ? 0.045 : opts.spread;
    var i, s, t, yoff, pal, sil, I, H, sz;
    for (s = 0; s < strands; s++) {
      var gold = (s / Math.max(strands, 1)) < (goldW / Math.max(goldW + silvW, 0.001));
      if (opts.alternate) gold = (s % 2 === 0);
      yoff = y0 + (s - (strands - 1) / 2) * spread0;
      if (style === 2) yoff = (s < strands / 2 ? -1 : 1) * (0.08 + (s % (strands / 2)) * 0.03);
      pal = gold ? palG : (palS || (palG ? palS : 0));
      sil = gold ? 0 : 1;
      var phase = urand(rng, 0, TAU);
      var ak = urand(rng, 0.7, 1.15);
      for (i = 0; i < nEach; i++) {
        t = i / (nEach - 1);
        if (opts.cross && s === 1) t = 1 - t;
        I = (0.28 + 0.7 * phraseJS(t)) * urand(rng, 0.45, 1) * (opts.inten || 1);
        H = urand(rng, 0.55, 1);
        sz = (sparkle && phraseJS(t) > 0.7 && rng() < 0.06) ? 1 : (rng() < 0.015 ? 1 : 0);
        var jitter = (opts.loose ? urand(rng, -0.03, 0.03) : urand(rng, -0.008, 0.008));
        addPal(buf, [t, yoff + jitter, phase], I, H, sz, sil, 13, pal, [ak, style, smoke]);
      }
    }
  }

  function buildPulse(buf, dens, opts) {
    opts = opts || {};
    var rng = rngAt(opts.seed || 18);
    var pal = opts.pal || 0;
    var sil = opts.silver || 0;
    var ticks = Math.max(36, (72 * dens) | 0);
    var i, ang, I, H;
    for (i = 0; i < ticks; i++) {
      ang = (i / ticks) * TAU - Math.PI / 2;
      I = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(i * 0.48));
      H = urand(rng, 0.55, 1);
      addPal(buf, [ang, 0, i % 3], I, H, 0, sil, 15, pal, [0.22, 0.28, 0]);
    }
    var rings = opts.rings || 4;
    var nR = Math.max(40, (120 * dens) | 0);
    for (var r = 0; r < rings; r++) {
      for (i = 0; i < nR; i++) {
        ang = (i / nR) * TAU;
        addPal(buf, [ang, 0, r + 1], 0.35 + 0.1 * (rings - r), urand(rng, 0.5, 0.9), 0, sil, 15, pal, [0.28 + r * 0.14, 0.06, 1]);
      }
    }
  }

  function buildField(buf, dens, opts) {
    opts = opts || {};
    var rng = rngAt(opts.seed || 3);
    var n = Math.max(200, ((opts.n || 2200) * dens) | 0);
    var shape = opts.shape || "cloud";
    var pals = opts.pals || [0];
    var i, p, pal, I, H, sz, r, u, th;
    for (i = 0; i < n; i++) {
      pal = pals[i % pals.length];
      if (shape === "sphere" || shape === "goldorb" || shape === "silverb" || shape === "dual") {
        p = unitRand(rng);
        r = Math.pow(rng(), 0.55) * (opts.r || 0.92);
        p = [p[0] * r, p[1] * r, p[2] * r];
        if (shape === "dual") pal = (p[0] < 0 ? (opts.pals[0] || 0) : (opts.pals[1] || 0));
      } else if (shape === "blob") {
        p = unitRand(rng);
        r = 0.55 + 0.28 * (0.5 + 0.5 * Math.sin(p[0] * 3.1) * Math.sin(p[1] * 2.4));
        r *= urand(rng, 0.85, 1.05);
        p = [p[0] * r, p[1] * r * 1.12, p[2] * r];
      } else if (shape === "gem") {
        var x = urand(rng, -1, 1), y = urand(rng, -1, 1), z = urand(rng, -1, 1);
        if (Math.abs(x) + Math.abs(y) * 1.2 + Math.abs(z) * 0.7 > 1) { i--; continue; }
        p = [x * 0.7, y * 0.9, z * 0.5];
        pal = (Math.abs(x) + Math.abs(y) > 0.85) ? 0 : 7;
      } else if (shape === "aurora") {
        var tt = rng();
        p = [(tt * 2 - 1) * 1.3, urand(rng, -0.25, 0.35) + 0.12 * Math.sin(tt * 6), urand(rng, -0.2, 0.2)];
        pal = pals[Math.min(pals.length - 1, (tt * pals.length) | 0)];
      } else if (shape === "pastel") {
        p = unitRand(rng);
        r = 0.2 + Math.pow(rng(), 0.7) * 1.05;
        p = [p[0] * r, p[1] * r, p[2] * r];
        pal = pals[irand(rng, 0, pals.length - 1)];
      } else { // cloud
        p = [gauss(rng, 0, 0.55), gauss(rng, 0, 0.32), gauss(rng, 0, 0.4)];
      }
      I = urand(rng, 0.12, 0.9) * (opts.inten || 1);
      H = urand(rng, 0.35, 1);
      sz = rng() < (opts.big || 0.04) ? 1 : 0;
      addPal(buf, p, I, H, sz, pal === 0 ? 0 : 1, 17, pal, [urand(rng, 0, 10), urand(rng, 0, 10), urand(rng, 0, 10)]);
    }
  }

  function buildNeural(buf, dens, opts) {
    opts = opts || {};
    var rng = rngAt(opts.seed || 12);
    var nodes = Math.max(18, (36 * dens) | 0);
    var pts = [], i, j, p;
    for (i = 0; i < nodes; i++) {
      p = unitRand(rng);
      var r = urand(rng, 0.15, 0.95);
      p = [p[0] * r, p[1] * r, p[2] * r];
      pts.push(p);
      var pal = rng() < 0.55 ? 12 : 2;
      addPal(buf, p, 1.4, 0.85, 1, 0, 17, pal, [urand(rng, 0, 8), urand(rng, 0, 8), urand(rng, 0, 8)]);
    }
    for (i = 0; i < nodes; i++) {
      for (j = i + 1; j < nodes; j++) {
        var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dz = pts[i][2] - pts[j][2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 0.42 || rng() > 0.35) continue;
        var steps = Math.max(4, (12 * dens) | 0);
        for (var k = 1; k < steps; k++) {
          var u = k / steps;
          var q = [pts[i][0] * (1 - u) + pts[j][0] * u, pts[i][1] * (1 - u) + pts[j][1] * u, pts[i][2] * (1 - u) + pts[j][2] * u];
          addPal(buf, q, 0.35, 0.7, 0, 0, 17, (i + j) % 2 ? 12 : 2, [i, j, k]);
        }
      }
    }
  }

  function buildInnerCords(buf, dens, user) {
    var rng = rngAt(4311);
    var n = Math.max(6, (9 * dens) | 0 + 6);
    var i, t, x, y, z, gold, pal;
    for (i = 0; i < n; i++) {
      gold = user ? (i % 3 !== 0) : (i % 3 !== 2);
      var phase = urand(rng, 0, TAU);
      var amp = urand(rng, 0.04, 0.12);
      var nn = Math.max(40, (160 * dens) | 0);
      for (var k = 0; k < nn; k++) {
        t = (k / (nn - 1)) * 2 - 1;
        x = t * 0.55;
        y = Math.sin(t * 3.2 + phase) * amp + (i - n / 2) * 0.035;
        z = Math.cos(t * 2.1 + phase) * 0.12;
        addPal(buf, [x, y, z], 0.7, urand(rng, 0.55, 1), rng() < 0.03 ? 1 : 0, gold ? 0 : 1, 17, 0, [phase, i, k]);
      }
    }
  }

  function buildWrap(buf, dens, user) {
    var rng = rngAt(4313);
    var bundles = 3;
    for (var b = 0; b < bundles; b++) {
      var gold = user ? (b !== 0) : (b !== 2);
      var lat = urand(rng, -0.5, 0.6);
      var nn = Math.max(80, (280 * dens) | 0);
      for (var k = 0; k < nn; k++) {
        var t = k / (nn - 1);
        var lon = t * TAU;
        var p = sph(lat + 0.08 * Math.sin(t * TAU * 2 + b), lon, 1.02);
        addPal(buf, p, 0.85, urand(rng, 0.5, 1), rng() < 0.04 ? 1 : 0, gold ? 0 : 1, 7, 0, [0, 0, 0]);
      }
    }
  }

  function buildWire(buf, dens, mer, par, scale, user) {
    var rng = rngAt(6220);
    mer = mer || 10; par = par || 5;
    var i, t, n, lon, lat;
    n = Math.max(30, (90 * dens) | 0);
    for (i = 0; i < mer; i++) {
      lon = i * Math.PI / mer;
      for (t = 0; t < n; t++) {
        var u = t / n;
        var p = sph((u - 0.5) * TAU, lon, scale || 1);
        addPal(buf, p, 0.7, urand(rng, 0.45, 0.9), 0, user ? 1 : 0, 7, 0, [0, 0, 0]);
      }
    }
    for (i = 0; i < par; i++) {
      lat = -0.9 + (i / Math.max(par - 1, 1)) * 1.8;
      var np = Math.max(24, (70 * dens * Math.max(0.25, Math.cos(lat))) | 0);
      for (t = 0; t < np; t++) {
        var p2 = sph(lat, (t / np) * TAU, scale || 1);
        addPal(buf, p2, 0.55, urand(rng, 0.4, 0.85), 0, user ? 1 : 0, 7, 0, [0, 0, 0]);
      }
    }
  }

  function buildCoreVoice(buf, dens) {
    var rng = rngAt(91);
    for (var s = 0; s < 4; s++) {
      var sil = (s % 2);
      var nn = Math.max(50, (220 * dens) | 0);
      for (var i = 0; i < nn; i++) {
        var t = 0.35 + 0.3 * (i / (nn - 1));
        addPal(buf, [t, (s - 1.5) * 0.03, urand(rng, 0, TAU)], 0.9, urand(rng, 0.6, 1), 0, sil, 13, 0, [1.2, 0, 0.05]);
      }
    }
  }

  function buildLook(buf, look, dens, user, quality) {
    var S = {
      N: { core: 1, shells: 1, dust: 1, tint: [0.06, 0.045, 0.02] },
      M: { core: 1, shells: 1, dust: 1, streams: 1 },
      F: { hshell: 0.75, ring: 1, streams: 1 },
      H: { hshell: 1, ring: 1, dust: 1 },
      F1: { ring: 1, streams: 1, hshell: 0.4 },
      F2: { ring: 1, streams: 1, hshell: 1, dust: 1 },
      H1: { hshell: 1, ring: 1, dust: 1 },
      H2: { core: 1, hshell: 0.7, ring: 0.55, inner: 1 },
      H3: { hshell: 1, ring: 1, wrap: 1, dust: 1 },
      H4: { hshell: 1, ring: 0.95, inner: 1, silverRing: 1, dust: 1 },
      V1: { hshell: 1, ring: 1, voice: 1, dust: 1 },
      V2: { hshell: 1, ring: 1, dust: 1, follow: 1 },
      I1: { core: 1, inner: 1, wire: 0.85, ring: 1, dust: 1 },
      I3: { core: 1, wrap: 1, wire: 0.5, ring: 1, dust: 1 },
      R:  { core: 0.5, wire2: 1, ring: 1, volume: 1, dust: 1 }
    };
    var s = S[look];
    if (!s) s = conceptSpec(look);
    if (s.shells) {
      for (var i = 0; i < SHELLS4.length; i++) buildShell(buf, i, SHELLS4[i], dens, 1, user);
    }
    if (s.hshell) buildHShell(buf, dens * (s.hshell === 1 ? 1 : s.hshell), 1, user && look !== "F" && look !== "F1");
    if (s.ring) buildRingCore(buf, s.silverRing ? 0.16 : (s.core ? 0.14 : 0.105), dens * (typeof s.ring === "number" ? s.ring : 1), 1.2, s.silverRing || user ? 0.7 : 0, 5, [0.25, -0.35, 0]);
    if (s.streams) buildStreams(buf, quality.streams);
    if (s.inner) buildInnerCords(buf, dens, user);
    if (s.wrap) buildWrap(buf, dens, user);
    if (s.wire) buildWire(buf, dens, 6, 3, 0.97, user);
    if (s.wire2) {
      buildWire(buf, dens, 10, 5, 1.0, user);
      buildWire(buf, dens * 0.7, 6, 3, 0.82, user);
    }
    if (s.volume) buildField(buf, dens, { shape: "sphere", n: 1400, pals: [0], inten: 0.35, r: 0.85, seed: 65 });
    if (s.voice) buildCoreVoice(buf, dens);
    if (s.wave) buildWave(buf, dens, s.wave);
    if (s.pulse) buildPulse(buf, dens, s.pulse);
    if (s.field) buildField(buf, dens, s.field);
    if (s.neural) buildNeural(buf, dens, s.neural || {});
    return s;
  }

  function conceptSpec(look) {
    var waves = {
      "14": { wave: { goldW: 1, silvW: 0, strands: 1, dense: 1.2 }, dust: 1 },
      "15": { wave: { goldW: 0, silvW: 1, strands: 1, dense: 1.2, palS: 0 }, dust: 1 },
      "16": { wave: { goldW: 0, silvW: 1, strands: 1, palS: 5, dense: 1.1 }, dust: 1 },
      "17": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, dense: 1.15 }, dust: 1 },
      "19": { wave: { goldW: 0, silvW: 1, strands: 2, spread: 0.03, palS: 5 }, dust: 1 },
      "20": { wave: { goldW: 1, silvW: 0, strands: 1, dense: 0.55, inten: 0.85 }, dust: 1 },
      "21": { wave: { goldW: 0, silvW: 1, strands: 1, palS: 15, dense: 1.1 }, dust: 1 },
      "22": { wave: { goldW: 0.3, silvW: 0.7, strands: 3, smoke: 1, loose: 1, palS: 15 }, dust: 1 },
      "23": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, sparkle: 1, spread: 0.07 }, dust: 1 },
      "24": { wave: { goldW: 1, silvW: 1, strands: 5, dense: 0.7, spread: 0.06, sparkle: 1 }, dust: 1 },
      "25": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, loose: 1, smoke: 0.5, dense: 1.2 }, dust: 1 },
      "26": { wave: { goldW: 1.45, silvW: 0.6, strands: 2, loose: 1, smoke: 0.4, dense: 1.2 }, dust: 1 },
      "27": { wave: { goldW: 0.6, silvW: 1.45, strands: 2, loose: 1, smoke: 0.4, dense: 1.2 }, dust: 1 },
      "28": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, loose: 1, dense: 1 }, dust: 1, core: 0 },
      "28A": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, dense: 0.9 }, ring: 1, core: 1, dust: 1 },
      "28B": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, smoke: 0.6, loose: 1 }, ring: 1, core: 1, dust: 1 },
      "28C": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, sparkle: 1 }, ring: 1, core: 1, dust: 1 },
      "28D": { wave: { goldW: 1, silvW: 1, strands: 2, dense: 0.45 }, ring: 0.6, dust: 0 },
      "29": { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, palG: 0, palS: 5, dense: 1 }, dust: 1 },
      "6": { wave: { goldW: 0, silvW: 1, strands: 1, palS: 6, dense: 1.1 }, dust: 1, tint: [0.12, 0.03, 0.03] },
      D1: { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, dense: 1.35 }, core: 1, dust: 1 },
      D2: { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, smoke: 1, loose: 1, dense: 1 }, core: 1, dust: 1 },
      D3: { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, sparkle: 1, dense: 1.1 }, core: 1, dust: 1 },
      D4: { wave: { goldW: 1, silvW: 1, strands: 2, alternate: 1, style: 0, spread: 0.16, cross: 1, dense: 1.1 }, dust: 1 },
      C1: { wave: { goldW: 1, silvW: 1, strands: 8, style: 3, spread: 0.022, dense: 0.7, alternate: 1 }, core: 1, dust: 1 },
      C2: { wave: { goldW: 1, silvW: 1, strands: 6, style: 2, dense: 0.8, alternate: 1 }, core: 1, dust: 1 },
      C3: { wave: { goldW: 1, silvW: 1, strands: 7, style: 1, spread: 0.07, dense: 0.8, alternate: 1 }, core: 1, dust: 1 },
      C4: { wave: { goldW: 1, silvW: 1, strands: 12, style: 0, spread: 0.04, smoke: 0.8, loose: 1, dense: 0.7, alternate: 1 }, dust: 1 }
    };
    if (waves[look]) {
      var w = waves[look];
      if (look === "28A" || look === "28B" || look === "28C" || look === "28D") w.core = look === "28D" ? 0 : 1;
      return w;
    }
    var fields = {
      "1": { field: { shape: "cloud", pals: [2], n: 1800, inten: 0.8, seed: 1 }, tint: [0.12, 0.06, 0.18], dust: 1 },
      "2": { pulse: { pal: 3, rings: 5, seed: 2 }, tint: [0.02, 0.1, 0.1], dust: 1 },
      "3": { field: { shape: "gem", pals: [4, 13], n: 1600, seed: 3, inten: 0.9 }, dust: 1, tint: [0.14, 0.06, 0.03] },
      "4": { field: { shape: "blob", pals: [5], n: 2400, seed: 4, big: 0.06 }, dust: 1 },
      "5": { field: { shape: "aurora", pals: [14, 3, 2, 12], n: 2600, seed: 5, inten: 0.7 }, dust: 1, tint: [0.03, 0.05, 0.14] },
      "7": { field: { shape: "gem", pals: [7, 0], n: 2200, seed: 7, inten: 1, big: 0.05 }, dust: 1, tint: [0.04, 0.1, 0.04] },
      "8": { field: { shape: "pastel", pals: [8, 9, 10], n: 900, seed: 8, big: 0.18, inten: 0.85 }, dust: 1 },
      "9": { field: { shape: "cloud", pals: [11], n: 2000, seed: 9, inten: 0.75 }, wire: 0.4, dust: 1, tint: [0.02, 0.05, 0.14] },
      "10": { field: { shape: "goldorb", pals: [0], n: 2800, r: 0.95, inten: 1, seed: 10 }, ring: 1, dust: 1, tint: [0.14, 0.08, 0.02] },
      "11": { field: { shape: "silverb", pals: [0], n: 2800, r: 0.95, inten: 1, seed: 11 }, ring: 1, dust: 1, tint: [0.06, 0.07, 0.09] },
      "12": { neural: { seed: 12 }, tint: [0.04, 0.1, 0.12], dust: 1 },
      "13": { field: { shape: "dual", pals: [0, 0], n: 2600, r: 0.95, seed: 13, inten: 1 }, ring: 1, dust: 1 },
      "18": { pulse: { pal: 0, rings: 4, seed: 18 }, dust: 1, tint: [0.12, 0.07, 0.02] }
    };
    if (look === "11") fields["11"].field.pals = [0];
    // force silver particles for 11 via silver mix: use pal 0 with sil=1 in buildField? goldorb/silverb both use pal 0; for 11 I'll use pal 5/0 and sil
    return fields[look] || { field: { shape: "cloud", pals: [0], n: 1600 }, dust: 1 };
  }

  // ---------------- shaders ----------------
  var VERT = [
    "attribute vec3 aPos;",
    "attribute vec4 aData;",
    "attribute float aShell;",
    "attribute vec4 aStream;",
    "uniform vec2 uRes;",
    "uniform vec2 uCenter;",
    "uniform float uTime,uScale,uCam,uRadius,uCoreR,uDpr,uPointScale,uTalk,uAmp,uWarm,uHasCore,uK,uSpeaker;",
    "uniform vec3 uAxis0,uAxis1,uAxis2,uAxis3;",
    "uniform float uAng0,uAng1,uAng2,uAng3,uAngH;",
    "varying vec3 vCol;",
    "vec3 goldRamp(float t){",
    "  t=clamp(t,0.0,1.0)*3.0; vec3 a,b; float f;",
    "  if(t<1.0){a=vec3(0.85,0.22,0.00);b=vec3(1.00,0.42,0.02);f=t;}",
    "  else if(t<2.0){a=vec3(1.00,0.42,0.02);b=vec3(1.00,0.62,0.12);f=t-1.0;}",
    "  else{a=vec3(1.00,0.62,0.12);b=vec3(1.0,0.84,0.45);f=t-2.0;}",
    "  return mix(a,b,f);",
    "}",
    "vec3 silvRamp(float t){",
    "  t=clamp(t,0.0,1.0)*3.0; vec3 a,b; float f;",
    "  if(t<1.0){a=vec3(0.36,0.40,0.48);b=vec3(0.70,0.75,0.84);f=t;}",
    "  else if(t<2.0){a=vec3(0.70,0.75,0.84);b=vec3(0.90,0.93,0.98);f=t-1.0;}",
    "  else{a=vec3(0.90,0.93,0.98);b=vec3(1.0);f=t-2.0;}",
    "  return mix(a,b,f);",
    "}",
    "vec3 palColor(float pal,float heat,float sil){",
    "  if(pal<1.5) return mix(goldRamp(heat),silvRamp(heat),sil);",
    "  vec3 a;",
    "  if(pal<2.5) a=vec3(0.62,0.42,0.92);",
    "  else if(pal<3.5) a=vec3(0.25,0.92,0.86);",
    "  else if(pal<4.5) a=vec3(0.96,0.62,0.42);",
    "  else if(pal<5.5) a=vec3(0.86,0.88,0.92);",
    "  else if(pal<6.5) a=vec3(1.00,0.45,0.38);",
    "  else if(pal<7.5) a=vec3(0.18,0.78,0.48);",
    "  else if(pal<8.5) a=vec3(1.00,0.78,0.68);",
    "  else if(pal<9.5) a=vec3(0.62,0.92,0.78);",
    "  else if(pal<10.5) a=vec3(0.78,0.70,0.96);",
    "  else if(pal<11.5) a=vec3(0.28,0.62,1.00);",
    "  else if(pal<12.5) a=vec3(0.35,1.00,0.95);",
    "  else if(pal<13.5) a=vec3(0.95,0.42,0.62);",
    "  else if(pal<14.5) a=vec3(0.22,0.38,0.72);",
    "  else a=vec3(0.72,0.72,0.68);",
    "  return mix(a*0.45, min(a*1.35,vec3(1.0)), clamp(heat,0.0,1.0));",
    "}",
    "float phraseEnv(float t){",
    "  float e=0.06;",
    "  if(t>0.02&&t<0.41){float u=(t-0.02)/0.39; e+=pow(sin(3.14159*u),0.85);}",
    "  if(t>0.47&&t<0.975){float u=(t-0.47)/0.505; e+=0.92*pow(sin(3.14159*u),0.80);}",
    "  return e;",
    "}",
    "vec3 rotAxis(vec3 p,vec3 axis,float ang){",
    "  float c=cos(ang),s=sin(ang);",
    "  return p*c+cross(axis,p)*s+axis*dot(axis,p)*(1.0-c);",
    "}",
    "void main(){",
    "  vec3 p=aPos;",
    "  float sh=aShell;",
    "  if(sh>=0.0&&sh<0.5) p=rotAxis(p,uAxis0,uAng0);",
    "  else if(sh<1.5) p=rotAxis(p,uAxis1,uAng1);",
    "  else if(sh<2.5) p=rotAxis(p,uAxis2,uAng2);",
    "  else if(sh<3.5) p=rotAxis(p,uAxis3,uAng3);",
    "  else if(sh>6.5&&sh<8.5) p=rotAxis(p,vec3(0.18,0.92,0.34),uAngH);",
    "  else if(sh>8.5&&sh<10.5){",
    "    float span=2.6;",
    "    float x=mod(aPos.x+uTime*0.23+span,span*2.0)-span;",
    "    float env=mix(1.0,0.10+0.90*exp(-(x*x)/0.81),uTalk);",
    "    float ph=aStream.y;",
    "    float w=mix(sin(6.28318*x/3.2+ph+uTime*0.25),",
    "      sin(6.28318*x/0.85+ph+uTime*1.13)*0.80+sin(6.28318*x/0.40+ph*1.7)*0.20,uTalk);",
    "    float A=mix(0.012,0.27*uAmp,uTalk)*aStream.z;",
    "    p=vec3(x,aStream.x*mix(1.5,1.0,uTalk)+A*env*w,aPos.z);",
    "  }",
    "  else if(sh>12.5&&sh<14.5){",
    "    float t=clamp(aPos.x,0.0,1.0);",
    "    float x=(t*2.0-1.0)*1.48;",
    "    float env=phraseEnv(t);",
    "    float A=mix(0.10,0.30*uAmp,uTalk)*aStream.x;",
    "    float w=sin(6.28318*t*5.15+aPos.z+uTime*0.31)*0.76",
    "          +sin(6.28318*t*8.40+aPos.z*1.55+0.35)*0.36",
    "          +sin(6.28318*t*13.2+aPos.z*0.45+1.05)*0.14;",
    "    float y=aPos.y;",
    "    if(aStream.y>0.5&&aStream.y<1.5) y=aPos.y*(0.12+0.88*t);",
    "    else if(aStream.y>1.5&&aStream.y<2.5) y=aPos.y+sign(aPos.y)*mix(0.05,0.11,uTalk);",
    "    y+=A*env*w;",
    "    y+=aStream.z*mix(0.01,0.10,uTalk)*sin(uTime*0.73+t*11.0+aPos.z);",
    "    p=vec3(x,y,0.0);",
    "  }",
    "  else if(sh>14.5&&sh<16.5){",
    "    float ang=aPos.x;",
    "    float reach=aStream.y*mix(0.72,1.05+uTalk*0.55,uTalk);",
    "    float rr=aStream.x+reach;",
    "    if(aStream.z>0.5){ rr=aStream.x+reach*(0.55+0.45*sin(ang*(6.0+aPos.z)+uTime*0.8)); }",
    "    p=vec3(cos(ang)*rr,sin(ang)*rr,0.0);",
    "  }",
    "  else if(sh>16.5&&sh<18.5){",
    "    p=aPos+0.03*vec3(sin(uTime*0.13+aStream.x),cos(uTime*0.09+aStream.y),sin(uTime*0.07+aStream.z));",
    "    p*=mix(1.0,1.0+0.07*uTalk,1.0);",
    "  }",
    "  p*=uScale;",
    "  float z=p.z;",
    "  float persp=uCam/(uCam-z);",
    "  vec2 xy=p.xy*uRadius*persp;",
    "  float zn=clamp((z+1.2)/2.4,0.0,1.0);",
    "  float dw=0.22+0.95*pow(zn,1.35);",
    "  if(sh>8.5||(sh>4.5&&sh<6.5)||sh>12.5) dw=1.0;",
    "  if(uHasCore>0.5){",
    "    float r2=dot(p.xy,p.xy);",
    "    float rb=uCoreR*uScale;",
    "    if(r2<rb*rb){",
    "      float zf=sqrt(max(rb*rb-r2,0.0));",
    "      if(z<-zf) dw*=0.10;",
    "      else if(z<=zf) dw*=0.82;",
    "    }",
    "  }",
    "  float inten=aData.x*dw*uK;",
    "  vec3 col=palColor(aStream.w,aData.y,aData.w);",
    "  col=mix(col,goldRamp(0.78),max(uSpeaker,0.0)*uTalk*0.30);",
    "  col=mix(col,silvRamp(0.78),max(-uSpeaker,0.0)*uTalk*0.30);",
    "  col=mix(col,col*vec3(1.06,0.95,0.80),uWarm*0.22);",
    "  vCol=col*inten;",
    "  vec2 clip=vec2((uCenter.x+xy.x)/uRes.x*2.0-1.0,(uCenter.y+xy.y)/uRes.y*2.0-1.0);",
    "  gl_Position=vec4(clip,0.5-z*0.08,1.0);",
    "  float sz=mix(1.25,4.0,aData.z)*persp*uDpr*uPointScale*(0.85+0.35*zn);",
    "  gl_PointSize=max(sz,0.75*uDpr);",
    "}"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "varying vec3 vCol;",
    "void main(){",
    "  vec2 uv=gl_PointCoord*2.0-1.0;",
    "  float d=dot(uv,uv);",
    "  if(d>1.0) discard;",
    "  float a=exp(-d*3.15);",
    "  float c=exp(-d*12.0);",
    "  vec3 col=vCol*(a+c*0.55);",
    "  gl_FragColor=vec4(col,a);",
    "}"
  ].join("\n");

  var QUAD_VERT = [
    "attribute vec2 aUv;",
    "varying vec2 vUv;",
    "void main(){ vUv=aUv; gl_Position=vec4(aUv*2.0-1.0,0.0,1.0); }"
  ].join("\n");

  var BODY_FRAG = [
    "precision mediump float;",
    "uniform vec2 uRes,uCenter;",
    "uniform float uRadius,uScale,uCoreR,uWarm,uSpec;",
    "uniform vec3 uTint;",
    "void main(){",
    "  vec2 pix=gl_FragCoord.xy;",
    "  float Rb=max(uRadius*uScale*uCoreR,1.0);",
    "  vec2 dxy=(pix-uCenter)/Rb;",
    "  float r=length(dxy);",
    "  float inside=clamp((1.0-r)*Rb/1.5,0.0,1.0);",
    "  float disc=1.0-smoothstep(0.985,1.03,r);",
    "  vec3 gold=vec3(1.0,0.62,0.18);",
    "  vec3 silv=vec3(0.75,0.80,0.88);",
    "  float wmix=clamp(0.5+0.5*(dxy.x+dxy.y)/1.4,0.0,1.0)*uWarm;",
    "  float rim=pow(clamp(r,0.0,1.0),40.0)*inside;",
    "  vec3 light=rim*mix(silv,gold,wmix)*0.22;",
    "  float sheen=exp(-pow((dxy.x+0.35)/0.55,2.0)-pow((dxy.y+0.42)/0.38,2.0))*inside;",
    "  light+=sheen*vec3(0.9,0.92,0.95)*0.010;",
    "  float sp=exp(-pow((dxy.x+0.28)/0.085,2.0)-pow((dxy.y+0.33)/0.12,2.0))*inside;",
    "  light+=vec3(sp)*uSpec;",
    "  float g=exp(-0.5*(pow((pix.x-uCenter.x)/(uRadius*uScale*1.55),2.0)+pow((pix.y-uCenter.y)/(uRadius*uScale*0.85),2.0)));",
    "  light+=uTint*g*0.42;",
    "  float alpha=inside*0.88*disc;",
    "  gl_FragColor=vec4(light*2.0,alpha);",
    "}"
  ].join("\n");

  var BLUR_FRAG = [
    "precision mediump float;",
    "varying vec2 vUv;",
    "uniform sampler2D uTex;",
    "uniform vec2 uDir;",
    "void main(){",
    "  vec3 c=texture2D(uTex,vUv).rgb*0.227027;",
    "  c+=texture2D(uTex,vUv+uDir*1.3846).rgb*0.316216;",
    "  c+=texture2D(uTex,vUv-uDir*1.3846).rgb*0.316216;",
    "  c+=texture2D(uTex,vUv+uDir*3.2308).rgb*0.070270;",
    "  c+=texture2D(uTex,vUv-uDir*3.2308).rgb*0.070270;",
    "  gl_FragColor=vec4(c,1.0);",
    "}"
  ].join("\n");

  var COMP_FRAG = [
    "precision mediump float;",
    "varying vec2 vUv;",
    "uniform sampler2D uScene,uBloom1,uBloom2,uBloom3;",
    "uniform float uBloomLevels,uTime,uExposure;",
    "vec3 filmic(vec3 lit){",
    "  vec3 tm=1.0-exp(-lit);",
    "  float L=max(max(lit.r,lit.g),lit.b);",
    "  vec3 hp=lit/max(L,1e-6)*(1.0-exp(-L));",
    "  tm=mix(tm,hp,0.45);",
    "  float lum=max(max(tm.r,tm.g),tm.b);",
    "  float hot=clamp((L-1.4)/3.0,0.0,1.0)*0.12;",
    "  return mix(tm,vec3(lum),hot);",
    "}",
    "void main(){",
    "  vec3 lit=texture2D(uScene,vUv).rgb;",
    "  if(uBloomLevels>0.5) lit+=0.70*texture2D(uBloom1,vUv).rgb;",
    "  if(uBloomLevels>1.5) lit+=0.55*texture2D(uBloom2,vUv).rgb;",
    "  if(uBloomLevels>2.5) lit+=0.40*texture2D(uBloom3,vUv).rgb;",
    "  lit*=uExposure;",
    "  vec3 tm=filmic(lit);",
    "  vec2 p=vUv*2.0-1.0;",
    "  float vig=1.0-0.28*dot(p,p);",
    "  tm*=vig;",
    "  float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);",
    "  tm+=(g-0.5)*0.018*tm;",
    "  tm=mix(tm,tm*vec3(1.03,0.99,0.94),0.18);",
    "  gl_FragColor=vec4(clamp(tm,0.0,1.0),1.0);",
    "}"
  ].join("\n");

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var err = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(err);
    }
    return sh;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var loc = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i;
    for (i = 0; i < n; i++) {
      var u = gl.getActiveUniform(p, i);
      loc[u.name] = gl.getUniformLocation(p, u.name);
    }
    p._u = loc;
    return p;
  }

  function makeTarget(gl, w, h, floaty, half) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var type = gl.UNSIGNED_BYTE, internal = gl.RGBA, fmt = gl.RGBA;
    if (floaty && half) type = half;
    else if (floaty) type = gl.FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, fmt, type, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) return null;
    return { tex: tex, fbo: fbo, w: w, h: h };
  }

  function axisFromTilt(tilt) {
    var M = rot(tilt[0], tilt[1], tilt[2]);
    return applym(M, [0, 1, 0]);
  }

  function FridayOrb(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: true,
      depth: false,
      stencil: false,
      powerPreference: "high-performance"
    }) || canvas.getContext("experimental-webgl");
    if (!this.gl) throw new Error("WebGL is not available on this phone.");
    var gl = this.gl;
    gl.getExtension("OES_standard_derivatives");
    this._half = null;
    this._float = false;
    var c32 = gl.getExtension("WEBGL_color_buffer_float") || gl.getExtension("EXT_color_buffer_float");
    var c16 = gl.getExtension("EXT_color_buffer_half_float");
    var t16 = gl.getExtension("OES_texture_half_float");
    var t32 = gl.getExtension("OES_texture_float");
    if (c16 && t16) this._half = t16.HALF_FLOAT_OES;
    else if (c32 && t32) this._float = true;

    this.progP = program(gl, VERT, FRAG);
    this.progBody = program(gl, QUAD_VERT, BODY_FRAG);
    this.progBlur = program(gl, QUAD_VERT, BLUR_FRAG);
    this.progComp = program(gl, QUAD_VERT, COMP_FRAG);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    this.pbuf = gl.createBuffer();
    this.dbuf = gl.createBuffer();
    this.staticCount = 0;
    this.dustCount = 0;
    this.dustMax = 0;
    this.dust = null;

    this.look = "N";
    this.quality = QUALITY.high;
    this._qOrder = ["high", "med", "low"];
    this.speaker = "idle";
    this.volume = 0;
    this.talk = 0;
    this.scale = 1;
    this.k = 0.7;
    this.warm = 0.5;
    this.amp = 1;
    this.hasCore = 1;
    this.syllable = 0;
    this.spinSign = 1;
    this.angles = [0, 0, 0, 0];
    this.angH = 0;
    this.axes = SHELLS4.map(function (s) { return axisFromTilt(s.tilt); });
    this.running = false;
    this._raf = 0;
    this._t0 = 0;
    this._last = 0;
    this._fpsWin = [];
    this._checked = 0;
    this._cx = 0; this._cy = 0; this._cssW = 0; this._cssH = 0;
    this._dpr = 1;
    this._radius = 160;
    this._targets = null;
    this._tint = [0.11, 0.07, 0.02];
    this._exposure = 1.9;

    var self = this;
    this._onResize = function () { self.resize(); };
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", this._onResize);
    this.resize();
    this._rebuild();
  }

  FridayOrb.prototype.setFrame = function (opts) {
    opts = opts || {};
    this._cyN = opts.cyN == null ? 0.46 : opts.cyN;
    this._radiusK = opts.radiusK == null ? 0.28 : opts.radiusK;
    this.resize();
  };

  FridayOrb.prototype.setLook = function (id) {
    if (!id || this.look === id) {
      if (id) this.look = id;
      return;
    }
    this.look = id;
    this._rebuild();
  };

  FridayOrb.prototype.setTalking = function (who, volume) {
    if (!who || who === "idle") this.speaker = "idle";
    else this.speaker = who;
    if (volume != null) this.volume = Math.max(0, Math.min(1, volume));
  };

  FridayOrb.prototype.setVolume = function (v) {
    this.volume = Math.max(0, Math.min(1, v || 0));
  };

  FridayOrb.prototype.notifySyllable = function () {
    this.syllable += 1;
    this.spinSign = (this.syllable % 2 === 0) ? 1 : -1;
  };

  FridayOrb.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this._t0 = 0;
    this._last = 0;
    var self = this;
    var loop = function (ts) {
      if (!self.running) return;
      self._raf = requestAnimationFrame(loop);
      self._frame(ts);
    };
    this._raf = requestAnimationFrame(loop);
  };

  FridayOrb.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  };

  FridayOrb.prototype.destroy = function () {
    this.stop();
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("orientationchange", this._onResize);
  };

  FridayOrb.prototype.resize = function () {
    var cvs = this.canvas;
    var cssW = Math.max(1, window.innerWidth);
    var cssH = Math.max(1, window.innerHeight);
    var dpr = Math.min(this.quality.dpr, window.devicePixelRatio || 1);
    this._dpr = dpr;
    this._cssW = cssW;
    this._cssH = cssH;
    var w = Math.max(1, Math.round(cssW * dpr));
    var h = Math.max(1, Math.round(cssH * dpr));
    if (cvs.width !== w || cvs.height !== h) {
      cvs.width = w;
      cvs.height = h;
      cvs.style.width = cssW + "px";
      cvs.style.height = cssH + "px";
      this._allocTargets();
    }
    // Orb sits at the bubble-ring center (46% from the top).
    this._cx = (cssW * 0.5) * dpr;
    var cyN = this._cyN == null ? 0.46 : this._cyN;
    var rk = this._radiusK == null ? 0.28 : this._radiusK;
    this._cy = (cssH * (1 - cyN)) * dpr;
    this._radius = Math.min(cssW, cssH) * rk * dpr;
    this.gl.viewport(0, 0, w, h);
  };

  FridayOrb.prototype._allocTargets = function () {
    var gl = this.gl;
    this._freeTargets();
    var w = this.canvas.width, h = this.canvas.height;
    var floaty = !!(this._half || this._float);
    var half = this._half;
    function tryMake(tw, th) {
      var t = makeTarget(gl, tw, th, floaty, half);
      if (!t && floaty) t = makeTarget(gl, tw, th, false, null);
      return t;
    }
    var scene = tryMake(w, h);
    if (!scene) scene = makeTarget(gl, w, h, false, null);
    var b1 = tryMake(Math.max(1, w >> 1), Math.max(1, h >> 1));
    var b2 = tryMake(Math.max(1, w >> 2), Math.max(1, h >> 2));
    var b3 = tryMake(Math.max(1, w >> 3), Math.max(1, h >> 3));
    var t1 = tryMake(Math.max(1, w >> 1), Math.max(1, h >> 1));
    var t2 = tryMake(Math.max(1, w >> 2), Math.max(1, h >> 2));
    var t3 = tryMake(Math.max(1, w >> 3), Math.max(1, h >> 3));
    this._targets = { scene: scene, b1: b1, b2: b2, b3: b3, t1: t1, t2: t2, t3: t3 };
  };

  FridayOrb.prototype._freeTargets = function () {
    var gl = this.gl, t = this._targets;
    if (!t) return;
    Object.keys(t).forEach(function (k) {
      if (!t[k]) return;
      gl.deleteTexture(t[k].tex);
      gl.deleteFramebuffer(t[k].fbo);
    });
    this._targets = null;
  };

  FridayOrb.prototype._rebuild = function () {
    var look = this.look;
    var dens = this.quality.dens;
    var buf = new ParticleBuf();
    var user = this.speaker === "user";
    var spec = buildLook(buf, look, dens, user, this.quality) || {};
    this._spec = spec;
    this.hasCore = spec.core ? 1 : (spec.shells || spec.inner || look === "I1" || look === "I3" || look === "H2" || look === "N" || look === "M" ? 1 : 0);
    if (spec.core === 0) this.hasCore = 0;
    this._dustOn = spec.dust !== 0 && spec.dust !== false;
    this._idleTint = spec.tint || [0.06, 0.045, 0.02];
    this._follow = !!spec.follow;
    var data = buf.float32();
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.staticCount = buf.count();

    this.dustMax = this.quality.dust;
    this.dust = new Float32Array(this.dustMax * STRIDE);
    this.dustLive = [];
    this.dustCount = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.dust.byteLength, gl.DYNAMIC_DRAW);
  };

  FridayOrb.prototype._bindParticles = function (prog, buffer) {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    var locP = gl.getAttribLocation(prog, "aPos");
    var locD = gl.getAttribLocation(prog, "aData");
    var locS = gl.getAttribLocation(prog, "aShell");
    var locT = gl.getAttribLocation(prog, "aStream");
    var stride = STRIDE * 4;
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(locD);
    gl.vertexAttribPointer(locD, 4, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(locS);
    gl.vertexAttribPointer(locS, 1, gl.FLOAT, false, stride, 28);
    gl.enableVertexAttribArray(locT);
    gl.vertexAttribPointer(locT, 4, gl.FLOAT, false, stride, 32);
  };

  FridayOrb.prototype._setParticleUniforms = function (time) {
    var gl = this.gl, p = this.progP, u = p._u;
    gl.useProgram(p);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uCenter, this._cx, this._cy);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uScale, this.scale);
    gl.uniform1f(u.uCam, CAM);
    gl.uniform1f(u.uRadius, this._radius);
    gl.uniform1f(u.uCoreR, CORE_R);
    gl.uniform1f(u.uDpr, this._dpr);
    gl.uniform1f(u.uPointScale, this.quality.point);
    gl.uniform1f(u.uTalk, this.talk);
    gl.uniform1f(u.uAmp, this.amp);
    gl.uniform1f(u.uWarm, this.warm);
    gl.uniform1f(u.uHasCore, this.hasCore);
    gl.uniform1f(u.uK, this.k);
    if (u.uSpeaker) gl.uniform1f(u.uSpeaker, this.speaker === "friday" ? 1 : this.speaker === "user" ? -1 : 0);
    function ax(loc, v) { gl.uniform3f(loc, v[0], v[1], v[2]); }
    ax(u.uAxis0, this.axes[0]); ax(u.uAxis1, this.axes[1]);
    ax(u.uAxis2, this.axes[2]); ax(u.uAxis3, this.axes[3]);
    gl.uniform1f(u.uAng0, this.angles[0]);
    gl.uniform1f(u.uAng1, this.angles[1]);
    gl.uniform1f(u.uAng2, this.angles[2]);
    gl.uniform1f(u.uAng3, this.angles[3]);
    gl.uniform1f(u.uAngH, this.angH);
  };

  FridayOrb.prototype._drawQuad = function (prog) {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    var loc = gl.getAttribLocation(prog, "aUv");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  FridayOrb.prototype._bindFbo = function (t) {
    var gl = this.gl;
    if (!t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.w, t.h);
  };

  FridayOrb.prototype._blur = function (src, tmp, dst) {
    var gl = this.gl, p = this.progBlur, u = p._u;
    if (!src || !tmp || !dst) return;
    gl.useProgram(p);
    gl.disable(gl.BLEND);
    this._bindFbo(tmp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(u.uTex, 0);
    gl.uniform2f(u.uDir, 1 / tmp.w, 0);
    this._drawQuad(p);
    this._bindFbo(dst);
    gl.bindTexture(gl.TEXTURE_2D, tmp.tex);
    gl.uniform2f(u.uDir, 0, 1 / dst.h);
    this._drawQuad(p);
  };

  FridayOrb.prototype._emitDust = function (n, reach) {
    if (!this.dust || n <= 0) return;
    var live = this.dustLive;
    var max = this.dustMax;
    for (var i = 0; i < n; i++) {
      if (live.length >= max) break;
      var th = Math.random() * TAU;
      var z = gauss(Math.random, 0, 0.28);
      // Math.random as rng is wrong for gauss signature — use a tiny wrapper
      z = (function () {
        var u = Math.max(1e-9, Math.random()), v = Math.random();
        return 0.28 * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
      })();
      var d = unit(Math.cos(th), Math.sin(th), z);
      var travel = Math.max(0.02, Math.min(reach * 3.2, reach * lognormal(Math.random, -0.75, 0.9)));
      // lognormal also expects rng function; Math.random works if we wrap
      travel = Math.max(0.02, Math.min(reach * 3.2, reach * Math.exp(-0.75 + 0.9 * (function () {
        var u = Math.max(1e-9, Math.random()), v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
      })())));
      live.push({
        d: d,
        travel: travel,
        life: Math.random() * 0.08,
        silver: (this.speaker === "user" ? Math.random() < 0.82 : this.speaker === "friday" ? Math.random() < 0.18 : Math.random() < 0.5) ? 1 : 0,
        heat: 0.65 + Math.random() * 0.35,
        jitter: Math.random() * 0.06,
        size: Math.random() < 0.03 + 0.05 * Math.max(0, travel / reach - 1) ? 1 : 0,
        bright: 0.3 + Math.random() * 0.7
      });
    }
  };

  FridayOrb.prototype._updateDust = function (dt) {
    var talking = this.speaker !== "idle";
    var reach = 0.35 + 0.27 * this.volume;
    if (talking) {
      var rate = (18 + 70 * this.volume) * dt * (this.dustMax / 2800);
      var n = rate | 0;
      if (Math.random() < (rate - n)) n += 1;
      this._emitDust(n, reach);
    }
    var live = this.dustLive;
    var next = [];
    var k = this.k * 2.2;
    var arr = this.dust;
    var count = 0;
    for (var i = 0; i < live.length; i++) {
      var p = live[i];
      var dur = 0.55 + p.travel * 0.9;
      p.life += dt / dur;
      if (p.life >= 1) continue;
      var r = 0.97 + p.jitter + p.life * p.travel;
      var fade = Math.pow(1 - p.life, 1.2) * p.bright / (1 + 0.35 * p.travel / Math.max(reach, 0.2));
      var x = p.d[0] * r, y = p.d[1] * r, z = p.d[2] * r;
      var o = count * STRIDE;
      arr[o] = x; arr[o + 1] = y; arr[o + 2] = z;
      arr[o + 3] = k * fade;
      arr[o + 4] = p.heat;
      arr[o + 5] = p.size;
      arr[o + 6] = p.silver;
      arr[o + 7] = 11;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = 0; arr[o + 11] = 0;
      count += 1;
      next.push(p);
    }
    this.dustLive = next;
    this.dustCount = count;
    if (count > 0) {
      var gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dbuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr.subarray(0, count * STRIDE));
    }
  };

  FridayOrb.prototype._frame = function (ts) {
    if (!this._t0) this._t0 = ts;
    var time = (ts - this._t0) / 1000;
    var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
    this._last = ts;

    var talking = this.speaker !== "idle";
    var targetTalk = talking ? 1 : 0;
    this.talk += (targetTalk - this.talk) * (1 - Math.exp(-dt * 6));
    var targetScale = talking ? (0.90 + 0.22 * this.volume) : 1;
    this.scale += (targetScale - this.scale) * (1 - Math.exp(-dt * 8));
    var targetK = talking ? (0.90 + 0.20 * this.volume) : 0.70;
    this.k += (targetK - this.k) * (1 - Math.exp(-dt * 5));
    var targetWarm = this.speaker === "user" ? 0.2 : this.speaker === "friday" ? 0.7 : 0.5;
    this.warm += (targetWarm - this.warm) * (1 - Math.exp(-dt * 4));
    this.amp += (((this.speaker === "friday") ? 1.15 : 1.0) - this.amp) * (1 - Math.exp(-dt * 4));
    if (this.speaker === "user") this._tint = [0.06, 0.07, 0.085];
    else if (this.speaker === "friday") this._tint = [0.11, 0.07, 0.02];
    else this._tint = this._idleTint || [0.06, 0.045, 0.02];
    this._exposure = talking ? (this.speaker === "friday" ? 2.3 : 2.1) : 1.9;

    var sign = this.spinSign;
    for (var i = 0; i < 4; i++) {
      this.angles[i] += dt * SHELLS4[i].speed * SHELLS4[i].spin * sign;
    }
    this.angH += dt * 0.11;

    if (this._dustOn) this._updateDust(dt);
    if (this._follow && this.talk > 0.2) {
      for (var fi = 0; fi < 4; fi++) this.angles[fi] += dt * 0.12 * this.talk;
    }

    var gl = this.gl;
    var T = this._targets;
    if (!T || !T.scene) return;

    this._bindFbo(T.scene);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.hasCore) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.progBody);
      var bu = this.progBody._u;
      gl.uniform2f(bu.uRes, T.scene.w, T.scene.h);
      gl.uniform2f(bu.uCenter, this._cx, this._cy);
      gl.uniform1f(bu.uRadius, this._radius);
      gl.uniform1f(bu.uScale, this.scale);
      gl.uniform1f(bu.uCoreR, CORE_R);
      gl.uniform1f(bu.uWarm, this.warm);
      gl.uniform1f(bu.uSpec, 0.8);
      gl.uniform3f(bu.uTint, this._tint[0], this._tint[1], this._tint[2]);
      this._drawQuad(this.progBody);
    } else {
      // Soft tint only, no black glass.
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.progBody);
      var bu2 = this.progBody._u;
      gl.uniform2f(bu2.uRes, T.scene.w, T.scene.h);
      gl.uniform2f(bu2.uCenter, this._cx, this._cy);
      gl.uniform1f(bu2.uRadius, this._radius);
      gl.uniform1f(bu2.uScale, this.scale);
      gl.uniform1f(bu2.uCoreR, 0.02);
      gl.uniform1f(bu2.uWarm, this.warm);
      gl.uniform1f(bu2.uSpec, 0.0);
      gl.uniform3f(bu2.uTint, this._tint[0], this._tint[1], this._tint[2]);
      this._drawQuad(this.progBody);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.blendEquation(gl.FUNC_ADD);
    this._setParticleUniforms(time);
    if (this.staticCount > 0) {
      this._bindParticles(this.progP, this.pbuf);
      gl.drawArrays(gl.POINTS, 0, this.staticCount);
    }
    if (this.dustCount > 0) {
      this._bindParticles(this.progP, this.dbuf);
      gl.drawArrays(gl.POINTS, 0, this.dustCount);
    }

    var levels = this.quality.bloom;
    if (levels >= 1 && T.b1) this._blur(T.scene, T.t1, T.b1);
    if (levels >= 2 && T.b2) this._blur(T.b1 || T.scene, T.t2, T.b2);
    if (levels >= 3 && T.b3) this._blur(T.b2 || T.b1, T.t3, T.b3);

    this._bindFbo(null);
    gl.disable(gl.BLEND);
    gl.useProgram(this.progComp);
    var cu = this.progComp._u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.scene.tex); gl.uniform1i(cu.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (T.b1 || T.scene).tex); gl.uniform1i(cu.uBloom1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, (T.b2 || T.b1 || T.scene).tex); gl.uniform1i(cu.uBloom2, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, (T.b3 || T.b2 || T.b1 || T.scene).tex); gl.uniform1i(cu.uBloom3, 3);
    gl.uniform1f(cu.uBloomLevels, levels);
    gl.uniform1f(cu.uTime, time);
    gl.uniform1f(cu.uExposure, this._exposure * 0.85);
    this._drawQuad(this.progComp);

    this._fpsWin.push(dt);
    if (this._fpsWin.length > 90) this._fpsWin.shift();
    this._checked += dt;
    if (this._checked > 2.2) {
      this._checked = 0;
      this._maybeDropQuality();
    }
  };

  FridayOrb.prototype._maybeDropQuality = function () {
    if (this._fpsWin.length < 40) return;
    var s = 0, i;
    for (i = 0; i < this._fpsWin.length; i++) s += this._fpsWin[i];
    var fps = this._fpsWin.length / s;
    if (fps < 44) {
      var idx = this._qOrder.indexOf(this.quality.name);
      if (idx < this._qOrder.length - 1) {
        this.quality = QUALITY[this._qOrder[idx + 1]];
        this.resize();
        this._rebuild();
        this._fpsWin = [];
      }
    }
  };

  root.FridayOrb = FridayOrb;
})(window);
