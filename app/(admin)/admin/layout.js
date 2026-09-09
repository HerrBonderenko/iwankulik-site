import { Inter } from "next/font/google";
import "@/app/globals.css";
import "./admin.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], weight: ["400", "500"] });

export const metadata = {
  title: "Адмінка — Iwan Kulik",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  // Адмінка не залежить від теми сайту: це робочий інструмент,
  // із даними працюють довго, тож фон завжди денний.
  return (
    <html lang="uk" data-theme="light">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
