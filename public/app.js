(function () {
  "use strict";

  var form = document.getElementById("leadForm");
  var successPanel = document.getElementById("success");
  var submitBtn = document.getElementById("submitBtn");
  var waFallback = document.getElementById("waFallback");

  // WhatsApp de destino. Se sobreescribe con el valor del servidor (/api/config)
  // que lee la variable de entorno WHATSAPP_NUMBER.
  var whatsappNumber = "5215510597019";

  fetch("/api/config")
    .then(function (r) { return r.json(); })
    .then(function (c) { if (c && c.whatsappNumber) whatsappNumber = c.whatsappNumber; })
    .catch(function () { /* usa el default */ });

  // Etiquetas legibles para los valores del formulario.
  var LABELS = {
    propertyType: {
      casa: "Casa habitación", negocio: "Comercio / Oficina",
      industria: "Industria", campo: "Agrícola / Campo",
    },
    monthlyBill: {
      "0-1000": "Menos de $1,000", "1000-3000": "$1,000 – $3,000",
      "3000-6000": "$3,000 – $6,000", "6000+": "Más de $6,000",
    },
  };
  function label(field, value) {
    return (LABELS[field] && LABELS[field][value]) || value;
  }

  // Atribución de campaña desde la URL (qué anuncio de Facebook generó el lead).
  function attribution() {
    var p = new URLSearchParams(window.location.search);
    return {
      source: p.get("utm_source") || p.get("source") || "facebook",
      campaign: p.get("utm_campaign") || p.get("campaign") || "",
      fbclid: p.get("fbclid") || "",
    };
  }

  // Construye el mensaje de WhatsApp con todos los datos del prospecto.
  function buildWhatsappUrl(data) {
    var lines = [
      "Hola EcoValue 👋, solicito una cotización de un sistema de paneles solares.",
      "",
      "*Nombre:* " + data.name,
      "*Teléfono:* " + data.phone,
    ];
    if (data.email) lines.push("*Correo:* " + data.email);
    if (data.propertyType) lines.push("*Inmueble:* " + label("propertyType", data.propertyType));
    if (data.monthlyBill) lines.push("*Consumo mensual:* " + label("monthlyBill", data.monthlyBill));
    if (data.state) lines.push("*Ubicación:* " + data.state);
    if (data.campaign) lines.push("_Campaña: " + data.campaign + "_");

    var text = encodeURIComponent(lines.join("\n"));
    return "https://wa.me/" + whatsappNumber + "?text=" + text;
  }

  function clearErrors() {
    document.querySelectorAll(".error").forEach(function (el) { el.textContent = ""; });
    document.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
  }

  function showErrors(errors) {
    Object.keys(errors).forEach(function (field) {
      var slot = document.querySelector('[data-error="' + field + '"]');
      if (slot) slot.textContent = errors[field];
      var input = document.getElementById(field);
      if (input) input.classList.add("invalid");
    });
    var firstInvalid = document.querySelector(".invalid");
    if (firstInvalid) firstInvalid.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    var data = {
      name: form.name.value,
      phone: form.phone.value,
      email: form.email.value,
      propertyType: form.propertyType.value,
      monthlyBill: form.monthlyBill.value,
      state: form.state.value,
      consent: form.consent.checked,
      company: form.company.value, // honeypot
    };
    Object.assign(data, attribution());

    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Enviando…";

    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { status: res.status, body: body }; });
      })
      .then(function (result) {
        if (result.status >= 200 && result.status < 300 && result.body.ok) {
          var waUrl = buildWhatsappUrl(data);
          waFallback.href = waUrl;

          form.hidden = true;
          successPanel.hidden = false;
          successPanel.scrollIntoView({ behavior: "smooth", block: "center" });

          // Dispara el evento Lead de Meta Pixel, si el píxel está presente.
          if (typeof window.fbq === "function") window.fbq("track", "Lead");

          // Redirige a WhatsApp con los datos ya escritos. Se deja un botón
          // de respaldo por si el navegador bloquea la redirección.
          setTimeout(function () { window.location.href = waUrl; }, 900);
          return;
        }
        if (result.body && result.body.errors) {
          showErrors(result.body.errors);
        } else {
          alert((result.body && result.body.error) || "Ocurrió un error. Intenta de nuevo.");
        }
      })
      .catch(function () {
        alert("No pudimos enviar el formulario. Revisa tu conexión e intenta de nuevo.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.querySelector("span").textContent = "Solicitar cotización";
      });
  });
})();
