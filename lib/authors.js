export const AUTHORS = {
  "iwan-kulik": {
    id: "iwan-kulik",
    name: {
      uk: "Іван Кулік",
      ru: "Иван Кулик",
      en: "Iwan Kulik",
      pl: "Iwan Kulik",
      de: "Iwan Kulik",
    },
    // ВРЕМЕННАЯ ЗАГЛУШКА — копия artist-portrait.jpg (фрагмент
    // шахматной работы). Заменить на настоящее фото перед деплоем.
    photo: "/assets/authors/iwan-kulik.webp",
    bio: {
      uk: "Художник, спеціалізується на олійному живописі. Автор тематичних циклів, натхненних світовою літературою — «Майстер і Маргарита», «Дон Кіхот», «Скотоферма». Живе і працює у Варшаві з 1990 року.",
      ru: "Художник, специализируется на масляной живописи. Автор тематических циклов, вдохновленных мировой литературой — «Мастер и Маргарита», «Дон Кихот», «Скотный двор». Живёт и работает в Варшаве с 1990 года.",
      en: "Painter specializing in oil painting. Author of thematic cycles inspired by world literature — ‘The Master and Margarita’, ‘Don Quixote’, ‘Animal Farm’. Lives and works in Warsaw since 1990.",
      pl: "Malarz specjalizujący się w malarstwie olejnym. Autor cykli tematycznych inspirowanych światową literaturą — «Mistrz i Małgorzata», «Don Kichot», «Folwark zwierzęcy». Mieszka i pracuje w Warszawie od 1990 roku.",
      de: "Maler, spezialisiert auf Ölmalerei. Autor thematischer Zyklen, inspiriert von der Weltliteratur — „Der Meister und Margarita“, „Don Quijote“, „Farm der Tiere“. Lebt und arbeitet seit 1990 in Warschau.",
    },
  },
};

export function getAuthor(id) {
  return AUTHORS[id] ?? null;
}
