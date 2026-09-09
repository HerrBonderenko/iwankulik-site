// Рендерить один блок JSON-LD. Екранує "<", щоб дані з адмінки
// (заголовки/описи робіт) не могли розірвати </script> і зламати розмітку.
export default function JsonLd({ data }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
