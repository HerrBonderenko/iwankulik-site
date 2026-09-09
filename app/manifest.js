export default function manifest() {
  return {
    name: "Iwan Kulik",
    short_name: "Kulik",
    description: "Oil painting",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // Той самий --bg темної теми, що й у themeColor макета сайту.
    theme_color: "#171614",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
