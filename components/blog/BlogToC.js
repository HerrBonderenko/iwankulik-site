export default function BlogToC({ t, headings }) {
  if (!headings || headings.length === 0) return null;
  return (
    <details className="blog-toc">
      <summary>{t.blog.toc}</summary>
      <nav>
        <ul>
          {headings.map((h) => (
            <li key={h.id} className={h.depth === 3 ? "blog-toc-sub" : undefined}>
              <a href={`#${h.id}`}>{h.text}</a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
