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
    // 192 — розмір, який Android бере для ярлика на екрані; 512 —
    // для сплеш-екрана. maskable окремим файлом, бо системі потрібні
    // поля навколо малюнка: вона обрізає іконку під форму лаунчера
    // (коло, скруглений квадрат), і без запасу з'їла б край.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
