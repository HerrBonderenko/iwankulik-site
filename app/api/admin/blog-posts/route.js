import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/adminAuth";
import { getPostSlugs, getPostMeta } from "@/lib/blog";

// ru як джерело істини для списку статей в адмінці — слаг спільний для
// всіх мов теми, тож достатньо прочитати одну локаль, щоб знати всі теми.
const SOURCE_LOCALE = "ru";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ ok: false }, { status: 401 });

  const slugs = getPostSlugs(SOURCE_LOCALE);
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      // {} замість реального blogCovers — навмисно: хочемо саме
      // фронтматтерний дефолт, override клієнт уже має з /api/admin/data.
      const meta = await getPostMeta(SOURCE_LOCALE, slug, {});
      return { slug, title: meta.title, defaultCover: meta.cover };
    })
  );

  return NextResponse.json(posts);
}
