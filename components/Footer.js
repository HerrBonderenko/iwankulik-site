import WorkCodeSearch from "@/components/WorkCodeSearch";

export default function Footer({ locale, t, contacts, works }) {
  return (
    <div className="container">
      <footer className="footer">
        {contacts.phone && <a href={`tel:${contacts.phone.replace(/\s/g, "")}`}>{contacts.phone}</a>}
        <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
        {contacts.instagram && (
          <a href={contacts.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
        )}
        <span className="footer-copy">
          © {new Date().getFullYear()} {t.footer.rights}
          <span className="footer-credit">
            {" "}· {t.footer.madeBy}{" "}
            <a href="https://olafboettcher.de" target="_blank" rel="noopener noreferrer" className="footer-credit-link">
              Olaf Boettcher
            </a>
          </span>
        </span>
        <WorkCodeSearch locale={locale} t={t} works={works} />
      </footer>
    </div>
  );
}
