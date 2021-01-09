module.exports = {
  headers: [
    {
      script:
        "https://cdnjs.cloudflare.com/ajax/libs/plotly.js/1.54.5/plotly.min.js",
      integrity: "sha256-qXgZ3jy1txdNZG0Lv20X3u5yh4892KqFcfF1SaOW0gI=",
    },
  ],
  sc_plugin_api_version: 1,
  viewtemplates: [require("./proportions")],
};
