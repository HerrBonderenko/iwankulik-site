// Alt-тексти обкладинок блогу.
//
// Раніше alt дорівнював заголовку статті. Це подвійна помилка: заголовок
// і так стоїть у <h1> поруч, а обкладинки в нас спільні — одна робота
// підписувалась то «Сейм, 1991», то «Реставрація картини», хоча на кадрі
// та сама картина. Тому таблиця прив'язана до файлу зображення, а не до
// статті: повтор обкладинки дає повтор alt, і це правильно.
//
// Alt самих робіт у галереї сюди не входить — там опис прив'язаний до
// конкретного полотна (див. data/site.js і компоненти галереї).

// Спільний зачин: далі через двокрапку йде те, що видно на кадрі.
const PREFIX = {
  uk: "Фрагмент картини Івана Куліка",
  ru: "Фрагмент картины Ивана Кулика",
  en: "Detail of a painting by Iwan Kulik",
  pl: "Fragment obrazu Iwana Kulika",
  de: "Ausschnitt eines Gemäldes von Iwan Kulik",
};

// Ключ — ім'я файлу обкладинки. Шлях (/assets/…) навмисно не тримаємо:
// якщо картинки колись переїдуть в інший каталог, таблиця не зламається.
const SCENES = {
  "kulik-chess-01.webp": {
    uk: "двоє за шахами, кіт і риба",
    ru: "двое за шахматами, кот и рыба",
    en: "two players at chess, a cat and a fish",
    pl: "dwaj gracze przy szachach, kot i ryba",
    de: "zwei Spieler beim Schach, Katze und Fisch",
  },
  "kulik-chess-02.webp": {
    uk: "пара за шахами біля ілюмінатора",
    ru: "пара за шахматами у иллюминатора",
    en: "a couple at chess by a porthole",
    pl: "para przy szachach obok bulaja",
    de: "ein Paar beim Schach am Bullauge",
  },
  "kulik-chess-03.webp": {
    uk: "троє за столом, риба в чаші й птахи",
    ru: "трое за столом, рыба в чаше и птицы",
    en: "three figures at a table, a fish in a bowl and birds",
    pl: "trzy postacie przy stole, ryba w misie i ptaki",
    de: "drei Figuren am Tisch, ein Fisch in der Schale und Vögel",
  },
  "cycle-master-margarita.webp": {
    uk: "риба й кіт у темному інтер'єрі",
    ru: "рыба и кот в тёмном интерьере",
    en: "a fish and a cat in a dark interior",
    pl: "ryba i kot w ciemnym wnętrzu",
    de: "ein Fisch und eine Katze in dunklem Interieur",
  },
  "cycle-don-quixote.webp": {
    uk: "жіноча постать із книгою",
    ru: "женская фигура с книгой",
    en: "a female figure with a book",
    pl: "kobieca postać z książką",
    de: "eine weibliche Gestalt mit einem Buch",
  },
  "cycle-animal-farm.webp": {
    uk: "фігури за столом і риба в чаші",
    ru: "фигуры за столом и рыба в чаше",
    en: "figures at a table and a fish in a bowl",
    pl: "postacie przy stole i ryba w misie",
    de: "Figuren am Tisch und ein Fisch in der Schale",
  },
  "cycle-stanczyk.webp": {
    uk: "шахіст крупним планом",
    ru: "шахматист крупным планом",
    en: "a chess player in close-up",
    pl: "szachista w zbliżeniu",
    de: "ein Schachspieler in Nahaufnahme",
  },
  "cycle-critique.webp": {
    uk: "птахи на спинках стільців",
    ru: "птицы на спинках стульев",
    en: "birds perched on chair backs",
    pl: "ptaki na oparciach krzeseł",
    de: "Vögel auf Stuhllehnen",
  },
  "auth-signing.webp": {
    uk: "фактура мазка й риба зблизька",
    ru: "фактура мазка и рыба вблизи",
    en: "brushwork texture and a fish up close",
    pl: "faktura pociągnięcia pędzla i ryba z bliska",
    de: "Pinselstruktur und ein Fisch aus der Nähe",
  },
  "auth-studio.webp": {
    uk: "шахова дошка й фактура полотна",
    ru: "шахматная доска и фактура холста",
    en: "a chessboard and the texture of the canvas",
    pl: "szachownica i faktura płótna",
    de: "ein Schachbrett und die Struktur der Leinwand",
  },
  "auth-certificate.webp": {
    uk: "шахова дошка й книги",
    ru: "шахматная доска и книги",
    en: "a chessboard and books",
    pl: "szachownica i książki",
    de: "ein Schachbrett und Bücher",
  },
  // Дві обкладинки з назвами, що вводять в оману: hero-work і
  // artist-portrait — теж полотна, а не фото майстерні чи художника.
  "hero-work.webp": {
    uk: "двоє за шахівницею, риба в чаші, кіт і птахи",
    ru: "двое за шахматной доской, рыба в чаше, кот и птицы",
    en: "two players at a chessboard, a fish in a bowl, a cat and birds",
    pl: "dwaj gracze przy szachownicy, ryba w misie, kot i ptaki",
    de: "zwei Spieler am Schachbrett, ein Fisch in der Schale, Katze und Vögel",
  },
  "artist-portrait.webp": {
    uk: "двоє за шахівницею під лампою, один тримається за голову",
    ru: "двое за шахматной доской под лампой, один держится за голову",
    en: "two players at a chessboard under a lamp, one holding his head",
    pl: "dwaj gracze przy szachownicy pod lampą, jeden trzyma się za głowę",
    de: "zwei Spieler am Schachbrett unter einer Lampe, einer fasst sich an den Kopf",
  },
};

// Опис обкладинки або null, якщо файла в таблиці нема — тоді викликач
// лишає те, що мав (заголовок статті). Мовчазний null навмисний:
// нова обкладинка без опису не повинна валити сторінку.
export function coverAlt(cover, locale) {
  if (!cover) return null;
  const file = String(cover).split("/").pop();
  const scene = SCENES[file]?.[locale] ?? SCENES[file]?.uk;
  if (!scene) return null;
  const prefix = PREFIX[locale] ?? PREFIX.uk;
  return `${prefix}: ${scene}`;
}
