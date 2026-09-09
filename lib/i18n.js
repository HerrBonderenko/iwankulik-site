import uk from "@/dictionaries/uk.json";
import en from "@/dictionaries/en.json";
import pl from "@/dictionaries/pl.json";
import de from "@/dictionaries/de.json";
import ru from "@/dictionaries/ru.json";

export const locales = ["uk", "en", "pl", "de", "ru"];
const dicts = { uk, en, pl, de, ru };

export function getDict(locale) {
  return dicts[locale] ?? dicts.uk;
}

export function pick(field, locale) {
  if (typeof field === "string") return field;
  return field[locale] ?? field.en ?? field.uk;
}

// Підставляє {ключ} у рядок словника значеннями з vars — для префілу
// коментаря заявки (назва/код/розмір картини), де повний i18n-шаблонізатор
// був би зайвим.
export function interpolate(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
