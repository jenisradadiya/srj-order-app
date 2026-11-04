import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Impressum and Datenschutzerklärung. Required in Germany for an app that is online.
// ⚠️ Everything in [brackets] must be filled in by SRJ, and the final text should be
// checked by a lawyer or a generator such as e-recht24.de. Kept in German on purpose.
export default function Legal() {
  const { user } = useAuth();
  return (
    <div className={user ? 'page narrow legal' : 'legal-public'}>
      {!user && (
        <Link to="/" className="back-link">← Anmelden</Link>
      )}
      <section className="card">
        <h1>Impressum</h1>
        <p><strong>Angaben gemäß § 5 DDG</strong></p>
        <p>
          [Firmenname, Rechtsform, z. B. SRJ GmbH]<br />
          [Straße Hausnummer]<br />
          [PLZ Ort]
        </p>
        <p>
          Vertreten durch: [Namen der Geschäftsführer / Inhaber]<br />
          Telefon: [Telefonnummer]<br />
          E-Mail: [E-Mail-Adresse]
        </p>
        <p>
          Registereintrag: [Registergericht, Registernummer – falls vorhanden]<br />
          Umsatzsteuer-ID: [USt-IdNr. gemäß § 27a UStG]
        </p>
      </section>

      <section className="card">
        <h2>Datenschutzerklärung</h2>
        <p><strong>Verantwortlich</strong><br />[Firmenname und Anschrift wie oben, E-Mail]</p>

        <p><strong>Welche Daten diese App speichert</strong></p>
        <ul>
          <li>Name, Handynummer und Sprache der Benutzer (für die Anmeldung)</li>
          <li>Firmen- und Filialdaten der Kunden (Name, Lieferadresse, Telefon)</li>
          <li>Bestellungen, Notizen und Sprachnachrichten, die über die App gesendet werden</li>
          <li>Rechnungen (PDF) und erfasste Zahlungen</li>
          <li>Für Benachrichtigungen: eine technische Adresse des Geräts (Push-Abonnement)</li>
        </ul>

        <p><strong>Zweck und Rechtsgrundlage</strong><br />
          Die Daten werden zur Abwicklung von Bestellungen, Lieferungen und Rechnungen verwendet
          (Art. 6 Abs. 1 lit. b DSGVO – Vertrag) sowie zur Erfüllung gesetzlicher Aufbewahrungspflichten
          (Art. 6 Abs. 1 lit. c DSGVO).</p>

        <p><strong>Cookies</strong><br />
          Die App verwendet nur ein technisch notwendiges Cookie, damit Benutzer angemeldet bleiben.
          Es gibt kein Tracking und keine Werbung.</p>

        <p><strong>Hosting</strong><br />
          Die App läuft auf einem Server von [Hosting-Anbieter, Sitz in der EU, z. B. Hetzner Online GmbH, Deutschland].
          Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO).</p>

        <p><strong>Push-Benachrichtigungen</strong><br />
          Wenn Benachrichtigungen erlaubt werden, werden sie über den Push-Dienst des Browsers bzw. Betriebssystems
          (z. B. Google, Apple, Mozilla, Microsoft) zugestellt. Sie können jederzeit im Profil oder in den
          Geräteeinstellungen abgeschaltet werden.</p>

        <p><strong>Speicherdauer</strong><br />
          [Wie lange Daten gespeichert werden, z. B. Bestellungen und Rechnungen 10 Jahre gemäß § 147 AO.]</p>

        <p><strong>Ihre Rechte</strong><br />
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch, sowie das Recht auf Beschwerde bei einer
          Datenschutz-Aufsichtsbehörde. Kontakt: [E-Mail-Adresse].</p>
      </section>
    </div>
  );
}
