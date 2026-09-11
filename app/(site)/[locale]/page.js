import Image from "next/image";
import ProcessVideo from "@/components/ProcessVideo";
import Link from "next/link";
import { getDict, locales, pick } from "@/lib/i18n";
import { formatPrice } from "@/lib/price";
import { getData } from "@/lib/store";
import OrderForm from "@/components/OrderForm";
import CyclesSection from "@/components/CyclesSection";
import AuthenticitySection from "@/components/AuthenticitySection";
import WorksSection from "@/components/WorksSection";
import { localBusinessSchema, websiteSchema } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const revalidate = 60;

export default async function Home({ params }) {
  const { locale } = await params;
  const t = getDict(locale);
  const { paintings, contacts, hero, homeCount, cycles, authenticityPhotos, processSection } = await getData();
  const heroVideo = Boolean(hero.videoEnabled && hero.video);
  const processVideo = Boolean(processSection.videoEnabled && processSection.video);

  return (
    <>
      <JsonLd data={websiteSchema({ locale })} />
      <JsonLd data={localBusinessSchema()} />
      {/* Без відео ліва колонка не рендериться зовсім, а фото займає
          весь герой — див. .hero.no-video у globals.css (там же
          мобільний випадок: за замовчуванням на телефоні видно саме
          відео, а фото сховане). */}
      <section className={heroVideo ? "hero" : "hero no-video"}>
        {heroVideo && (
          <div className="hero-video">
            {/* poster прибрано разом із файлом: то був кадр із відео
                попереднього власника сайту, і будь-яке нове відео з
                адмінки він би підмінив чужою заставкою. Без poster
                браузер показує перший кадр самого відео. */}
            <video src={hero.video} autoPlay muted loop playsInline preload="metadata" />
          </div>
        )}
        <div className="hero-photo">
          {/* LCP-елемент сторінки. priority у Next 16 позначено застарілим —
              він лише вставляє <link rel=preload>, а fetchpriority не ставить,
              тож браузер тягнув героя з пріоритетом Low позаду восьми шрифтів
              (виміряно: Load Delay 1.1 s). preload + fetchPriority="high" дають
              і ранній preload, і високий пріоритет — обидва потрапляють і в
              <link>, і в <img>.
              alt="": той самий напис стоїть поверх фото в <h1>.
              sizes рахуємо по факту: на телефоні фото на всю ширину, на
              десктопі в .hero є padding 20px з кожного боку, а коли грає
              відео — ще й колонка 420px + gap 20px зліва. */}
          <Image
            src={hero.img}
            alt=""
            fill
            preload
            fetchPriority="high"
            quality={60}
            sizes={
              heroVideo
                ? "(max-width: 920px) 100vw, calc(100vw - 480px)"
                : "(max-width: 920px) 100vw, calc(100vw - 40px)"
            }
          />
          <div className="hero-text">
            {/* Заголовок і заклик — одна клікабельна плашка, а не два
                сусідні елементи. h1 усередині посилання валідний: a може
                містити блоковий контент. Це єдиний h1 сторінки — мобільна
                копія блоку нижче лишається span. */}
            <Link href={`/${locale}/zhyvopys`} className="hero-cta-box">
              <h1 className="hero-tagline">{t.hero.tagline}</h1>
              <span className="hero-cta-label">
                {t.cta.choosePainting}
                <svg
                  className="hero-cta-arrow"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
        {/* Копія підпису для телефона потрібна лише тоді, коли грає
            відео: воно на телефоні єдиний видимий шар, а фото сховане.
            Без відео фото показується разом зі своїм підписом, і цей
            блок лягав на нього точно згори — той самий текст двічі
            в DOM і дві кнопки одна на одній. */}
        {heroVideo && (
        <div className="hero-text hero-text-mobile">
          <Link href={`/${locale}/zhyvopys`} className="hero-cta-box">
            <span className="hero-tagline">{t.hero.tagline}</span>
            <span className="hero-cta-label">
              {t.cta.choosePainting}
              <svg
                className="hero-cta-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </Link>
        </div>
        )}
      </section>

      <div className="container">
        <WorksSection
          locale={locale}
          t={t}
          paintings={paintings}
          cycles={cycles}
          homeCount={homeCount}
        />

        <CyclesSection locale={locale} t={t} cycles={cycles} />
      </div>

      <AuthenticitySection t={t} photos={authenticityPhotos} />

      <div className="container">
        <section className="section">
          {/* Без відео колонка не рендериться, а текст лишається
              своєю колонкою — див. .process.no-video у globals.css. */}
          <div className={processVideo ? "process" : "process no-video"}>
            {processVideo && (
              <ProcessVideo
                src={processSection.video}
                hasSound
                labelOn={t.home.soundOn}
                labelOff={t.home.soundOff}
              />
            )}
            <div className="process-text">
              <h2 className="section-title" style={{ marginBottom: 0 }}>{t.home.processTitle}</h2>
              {/* Без нумерації: це не послідовність кроків (як у «Як придбати
                  роботу» нижче), а три властивості самої роботи. */}
              <div className="process-list">
                <p>{t.home.process1}</p>
                <p>{t.home.process2}</p>
                <p>{t.home.process3}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">{t.home.stepsTitle}</h2>
          <div className="steps">
            {[1, 2, 3, 4].map((n) => (
              <div key={n}>
                <div className="step-num">0{n}</div>
                <div className="step-title">{t.home[`s${n}`]}</div>
                <div className="step-desc">{t.home[`s${n}d`]}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section home-blog-teaser">
          <h2 className="section-title" style={{ marginBottom: 0 }}>{t.home.blogTitle}</h2>
          <p className="muted">{t.home.blogSubtitle}</p>
          <p style={{ marginTop: 16 }}>
            <Link href={`/${locale}/blog`} className="link">{t.home.blogCta} →</Link>
          </p>
        </section>
      </div>

      <section className="cta" id="zayavka">
        <div className="container">
          <OrderForm t={t} inline email={contacts.email} phone={contacts.phone} isGeneralForm />
        </div>
      </section>
    </>
  );
}
