import { categoryKeyFromSlug, categorySlug } from "@/lib/blogCategories";

// Той самий шлях іншою мовою.
//
// Просте «зрізати /uk, підставити /de» ламається там, де локалізований не
// лише префікс, а й сам сегмент: слаг категорії блогу перекладається
// (/uk/blog/tsykly ↔ /de/blog/zyklen), і підстановка префікса давала 404.
// Слаги статей і циклів, навпаки, спільні для всіх мов — їх лишаємо як є.
//
// Та сама таблиця, з якої generateMetadata збирає localizedPaths для
// hreflang, тож видимий перемикач і теги в <head> тепер не розходяться.
export function switchLocalePath(pathname, from, to) {
  // (?=/|$) — щоб /ukraine не перетворилось на /raine.
  const rest = String(pathname || "").replace(new RegExp(`^/${from}(?=/|$)`), "");

  const category = rest.match(/^\/blog\/([^/]+)\/?$/);
  if (category) {
    const key = categoryKeyFromSlug(from, category[1]);
    if (key) return `/${to}/blog/${categorySlug(key, to)}`;
  }

  return `/${to}${rest}`;
}
