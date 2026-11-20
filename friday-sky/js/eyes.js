/* "Show her a photo": take or pick a picture, shrink it, and ask a vision model about it. */
(function (root) {
  "use strict";

  function shrink(file, max) {
    max = max || 1280;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("I couldn't open that picture.")); };
      img.src = url;
    });
  }

  function FridayEyes(opts) {
    this.opts = opts || {};
    this.input = document.getElementById("eyes-file");
    this.question = "";
    var self = this;
    if (this.input) {
      this.input.addEventListener("change", function () {
        var f = self.input.files && self.input.files[0];
        self.input.value = "";
        if (f) self._look(f);
      });
    }
  }

  // Must be called from a tap (iOS only opens the camera from a real tap).
  FridayEyes.prototype.open = function (question) {
    this.question = question || "";
    if (this.input) this.input.click();
  };

  // When the request came by voice, show a button the user can tap.
  FridayEyes.prototype.offer = function (question) {
    var self = this;
    this.question = question || "";
    var old = document.getElementById("eyes-offer");
    if (old) old.remove();
    var b = document.createElement("button");
    b.id = "eyes-offer";
    b.type = "button";
    b.className = "float-action";
    b.textContent = "Take a photo";
    b.onclick = function () { b.remove(); self.open(self.question); };
    document.body.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.remove(); }, 30000);
  };

  FridayEyes.prototype._look = async function (file) {
    var o = this.opts;
    var profile = o.profile || {};
    var q = String(this.question || "").trim();
    if (!q || /^(what(?:'s| is) (this|that)|what am i looking at|look at (this|that)|take a (photo|picture)|show you something|scan (this|that)|identify (this|that))\W*$/i.test(q)) {
      q = "What is this? Tell me what matters about it.";
    }
    try {
      if (o.onStart) o.onStart();
      var data = await shrink(file, 1280);
      var text = await root.FridayBrain.ask([
        { role: "system", content: "You are " + (profile.assistantName || "Friday") + ", " + (profile.ownerName || "the user") + "'s assistant. They are showing you a photo from their phone. Answer what they asked in two to four short spoken sentences: no lists, no markdown. If there is text in the photo that matters (a label, a sign, a bill, instructions), read the important part. If you're unsure, say so." },
        { role: "user", content: [{ type: "text", text: q }, { type: "image_url", image_url: { url: data } }] }
      ], { purpose: "vision", temperature: 0.4, max_tokens: 400 });
      text = root.FridayGroq ? root.FridayGroq.cleanSpoken(text) : text;
      if (!text) throw new Error("I couldn't make out that picture.");
      if (o.onAnswer) o.onAnswer(text, q, data);
    } catch (e) {
      var msg = (e && e.message) || "I couldn't look at that picture.";
      if (/limit|busy|brain/i.test(msg)) msg = "My vision is busy right now. Try again in a minute.";
      if (o.onError) o.onError(msg);
    }
  };

  root.FridayEyes = FridayEyes;
})(window);
