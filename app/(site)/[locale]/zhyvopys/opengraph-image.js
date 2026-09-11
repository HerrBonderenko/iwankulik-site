import { locales } from "@/lib/i18n";
import { OG_ALT, OG_CONTENT_TYPE, OG_SIZE, renderStaticPageOg } from "@/lib/ogImage";

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 60;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function Image({ params }) {
  return renderStaticPageOg(await params, "paintings");
}
