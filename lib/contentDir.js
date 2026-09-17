// Корінь локального сховища fs-драйвера (data.json, uploads, логи,
// лічильники). Типово — content/ у корені проєкту, як і було. Змінна
// CONTENT_DIR переносить його вбік: інтеграційні тести запускають
// сервер зі сховищем у тимчасовій теці й не чіпають робочу копію
// розробника. На проді (Netlify/Vercel Blobs) fs-драйвер не працює,
// тож змінна там ні на що не впливає.
import path from "path";

export const CONTENT_DIR = process.env.CONTENT_DIR || path.join(process.cwd(), "content");
