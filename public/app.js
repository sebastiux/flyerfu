(function () {
  "use strict";

  var form = document.getElementById("leadForm");
  var successPanel = document.getElementById("success");
  var submitBtn = document.getElementById("submitBtn");

  // Pull marketing attribution from the URL so leads are traceable back to
  // the Facebook ad / campaign that produced them.
  function attribution() {
    var p = new URLSearchParams(window.location.search);
    return {
      source: p.get("utm_source") || p.get("source") || "facebook",
      campaign: p.get("utm_campaign") || p.get("campaign") || "",
      fbclid: p.get("fbclid") || "",
    };
  }

  function clearErrors() {
    document.querySelectorAll(".error").forEach(function (el) {
      el.textContent = "";
    });
    document.querySelectorAll(".invalid").forEach(function (el) {
      el.classList.remove("invalid");
    });
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
      message: form.message.value,
      consent: form.consent.checked,
      company: form.company.value, // honeypot
    };
    Object.assign(data, attribution());

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";

    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (result.status >= 200 && result.status < 300 && result.body.ok) {
          form.hidden = true;
          successPanel.hidden = false;
          successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
          // Fire Meta Pixel Lead event if the pixel is present on the page.
          if (typeof window.fbq === "function") window.fbq("track", "Lead");
          return;
        }
        if (result.body && result.body.errors) {
          showErrors(result.body.errors);
        } else {
          alert(
            (result.body && result.body.error) ||
              "Ocurrió un error. Por favor intenta de nuevo."
          );
        }
      })
      .catch(function () {
        alert("No pudimos enviar el formulario. Revisa tu conexión e intenta de nuevo.");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Quiero mi cotización gratis";
      });
  });
})();
