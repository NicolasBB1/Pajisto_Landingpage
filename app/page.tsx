import { ConsentBanner, ConsentSettingsButton } from "@/components/ConsentBanner";
import { ContactForm } from "@/components/ContactForm";
import { ForderungsCheck } from "@/components/ForderungsCheck";
import { Arrow, Icon } from "@/components/Icon";
import { COMPANY, LANDING_VARIANT, SHOW_PREVIEW_BAR } from "@/lib/public-config";
import { getLeadMode } from "@/lib/server/config";

const FAQ = [
  {
    q: "Lohnt sich Inkasso überhaupt, wenn ich nur selten offene Rechnungen habe?",
    a: "Auch einzelne Forderungen können Sie zur Prüfung anfragen. Ob und welche Beauftragung wirtschaftlich sinnvoll ist, hängt unter anderem von der Forderungshöhe und vom Fall ab. Das besprechen wir offen mit Ihnen.",
  },
  {
    q: "Muss ich für den Forderungscheck etwas abschließen?",
    a: "Nein. Der Check dient der unverbindlichen Orientierung und funktioniert ohne Registrierung. Die Zusammenarbeit und mögliche Modelle besprechen wir erst danach persönlich.",
  },
  {
    q: "Was passiert, wenn Kunden ihre Forderungen bestreiten?",
    a: "Dann kommt es auf den konkreten Sachverhalt, Ihre Unterlagen und den Inhalt der Einwendungen an. Wir schauen uns Ihre Situation individuell an.",
  },
  {
    q: "Bearbeitet Pajisto auch bereits titulierte Forderungen?",
    a: "Ja, auch die Durchsetzung titulierter Forderungen kann Gegenstand einer Anfrage sein. Welche Vollstreckungsmaßnahmen in Betracht kommen, klären wir im Einzelfall.",
  },
  {
    q: "Ist die Anfrage bereits eine verbindliche Beauftragung?",
    a: "Nein. Eine unverbindliche Anfrage oder das Ausfüllen des Checks ist keine Inkasso-Beauftragung. Sie entscheiden nach dem Gespräch, ob und wie Sie uns beauftragen.",
  },
];

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="Pajisto – zum Seitenanfang">
      <span className="mark" aria-hidden="true">
        p
      </span>{" "}
      pajisto
    </a>
  );
}

export default function Page() {
  const leadMode = getLeadMode();

  return (
    <>
      <a className="skip-link" href="#check">
        Direkt zum Forderungscheck
      </a>
      {SHOW_PREVIEW_BAR && (
        <div className="preview-bar" data-testid="preview-bar">
          ENTWICKLUNGSVORSCHAU · VARIANTE {LANDING_VARIANT} · NICHT DIE LIVE-SEITE
        </div>
      )}
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Hauptnavigation">
          <Logo />
          <div className="links">
            <a href="#leistungen">Leistungen</a>
            <a href="#ablauf">So funktioniert&apos;s</a>
            <a href="#fragen">Fragen &amp; Antworten</a>
          </div>
          <a href="#check" className="btn btn-dark">
            Forderungscheck starten <Arrow />
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <div className="eyebrow">Forderungsmanagement für Unternehmen</div>
              <h1 className="display">
                Offene Rechnungen?
                <br />
                <span className="underline">Wir kümmern uns.</span>
              </h1>
              <p className="lead">
                Ob eine einzelne Rechnung offen bleibt oder jeden Monat neue dazukommen: Pajisto unterstützt Sie bei der
                professionellen Durchsetzung Ihrer Forderungen. Finden Sie heraus, welche Lösung zu Ihnen passt.
              </p>
              <div className="hero-actions">
                <a href="#check" className="btn btn-dark">
                  Forderungscheck starten <Arrow />
                </a>
                <a href="#kontakt" className="btn btn-white">
                  Direkt anfragen
                </a>
              </div>
              <div className="hero-micro">
                <Icon name="check" size={15} /> Drei kurze Schritte · Ohne Registrierung · Unverbindlich
              </div>
            </div>

            <div className="hero-visual" role="img" aria-label="Beispielhafte Illustration einer Übersicht offener Rechnungen. Keine echten Daten.">
              <div className="visual-bg" />
              <div className="window" aria-hidden="true">
                <div className="window-bar">
                  <div>
                    <div className="small-eyebrow">BEISPIELANSICHT · KEINE ECHTEN DATEN</div>
                    <div className="window-title">Forderungen im Blick.</div>
                  </div>
                  <div className="dots">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="example-card">
                  <div className="example-icon">
                    <Icon name="invoice" />
                  </div>
                  <div className="example-label">
                    <strong>Rechnung 2026-041</strong>
                    <small>Überfällige Forderung</small>
                  </div>
                  <div className="example-amount">
                    1.250 €<span>Zu prüfen</span>
                  </div>
                </div>
                <div className="example-card">
                  <div className="example-icon">
                    <Icon name="clock" />
                  </div>
                  <div className="example-label">
                    <strong>Rechnung 2026-042</strong>
                    <small>Zahlungserinnerung versendet</small>
                  </div>
                  <div className="example-amount">
                    420 €<span>In Bearbeitung</span>
                  </div>
                </div>
                <div className="example-card">
                  <div className="example-icon">
                    <Icon name="path" />
                  </div>
                  <div className="example-label">
                    <strong>Rechnung 2026-043</strong>
                    <small>Weiteres Vorgehen klären</small>
                  </div>
                  <div className="example-amount">
                    870 €<span>In Prüfung</span>
                  </div>
                </div>
                <div className="example-note">
                  <span className="round-check">
                    <Icon name="check" size={16} />
                  </span>
                  <span>
                    <strong>Ein Ansprechpartner. Ein klarer Ablauf.</strong>
                    <small>Passend zu Anzahl und Art Ihrer Forderungen</small>
                  </span>
                </div>
              </div>
              <div className="float-tag" aria-hidden="true">
                <Icon name="check" size={14} /> Vom Einzelfall bis zur laufenden Betreuung
              </div>
              <div className="float-tag float-bottom" aria-hidden="true">
                <Icon name="path" size={14} /> Mehr Klarheit bei offenen Rechnungen
              </div>
            </div>
          </div>
        </section>

        <div className="trust">
          <ul className="container trust-row" aria-label="Über Pajisto">
            <li className="trust-item">
              <span>
                <Icon name="shield" size={15} />
              </span>
              Registrierter Inkassodienstleister (§ 10 RDG)
            </li>
            <li className="trust-item">
              <span>
                <Icon name="person" size={15} />
              </span>
              Persönliche Ansprechpartner
            </li>
            <li className="trust-item">
              <span>
                <Icon name="layers" size={15} />
              </span>
              Einzelne und laufende Fälle
            </li>
            <li className="trust-item">
              <span>
                <Icon name="pin" size={15} />
              </span>
              Standort Nürnberg
            </li>
          </ul>
        </div>

        <section className="section" aria-labelledby="pain-title">
          <div className="container">
            <div className="section-intro">
              <div className="eyebrow">Kommt Ihnen bekannt vor?</div>
              <h2 id="pain-title">
                Manchmal reicht schon
                <br />
                eine offene Rechnung.
              </h2>
              <p className="lead">
                Unbezahlte Rechnungen halten Sie auf – egal ob einmal im Jahr oder regelmäßig. Entscheidend ist nicht
                nur die Anzahl der Fälle, sondern auch, wie Sie damit umgehen.
              </p>
            </div>
            <div className="cards">
              <article className="card">
                <div className="card-number">01 / ZAHLUNGSVERZUG</div>
                <div className="card-icon">
                  <Icon name="invoice" size={23} />
                </div>
                <h3>Der Betrag bleibt offen.</h3>
                <p>Sie haben Ihre Leistung erbracht, aber die Zahlung lässt auf sich warten. Das bindet Liquidität.</p>
              </article>
              <article className="card">
                <div className="card-number">02 / NACHFASSEN</div>
                <div className="card-icon">
                  <Icon name="clock" size={23} />
                </div>
                <h3>Erinnerungen bringen nichts.</h3>
                <p>Sie wollen nicht immer wieder schreiben oder telefonieren – ganz gleich, wie oft das vorkommt.</p>
              </article>
              <article className="card">
                <div className="card-number">03 / WEITERES VORGEHEN</div>
                <div className="card-icon">
                  <Icon name="path" size={23} />
                </div>
                <h3>Wie geht es jetzt weiter?</h3>
                <p>Wann ist professionelle Unterstützung sinnvoll? Wir klären die Möglichkeiten mit Ihnen.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="check-section" id="check" aria-labelledby="check-title">
          <div className="container check-grid">
            <div className="check-copy">
              <div className="eyebrow">Pajisto-Forderungscheck</div>
              <h2 id="check-title">Welche Lösung passt zu Ihren offenen Rechnungen?</h2>
              <p className="lead">
                Jede Forderungssituation ist anders. Unser kurzer Check ordnet Ihren Bedarf ein und zeigt einen
                passenden nächsten Schritt – ohne komplizierte Kostenannahmen.
              </p>
              <ul className="check-points">
                <li>
                  <Icon name="check" size={16} /> Auch für nur eine offene Rechnung
                </li>
                <li>
                  <Icon name="check" size={16} /> Ergebnis in drei Schritten
                </li>
                <li>
                  <Icon name="check" size={16} /> Ohne E-Mail oder Registrierung
                </li>
                <li>
                  <Icon name="check" size={16} /> Keine Erfolgsversprechen, keine Prognosen
                </li>
              </ul>
            </div>
            <ForderungsCheck />
          </div>
        </section>

        <section id="leistungen" className="section" aria-labelledby="services-title">
          <div className="container">
            <div className="section-intro">
              <div className="eyebrow">So unterstützt Pajisto</div>
              <h2 id="services-title">
                Die passende Unterstützung.
                <br />
                Ganz gleich, wie oft es passiert.
              </h2>
              <p className="lead">
                Nicht jedes Unternehmen braucht dieselbe Lösung. Wir klären, welche Vorgehensweise für Ihre Forderungen
                sinnvoll ist.
              </p>
            </div>
            <div className="solutions-grid">
              <article className="solution-feature">
                <div className="eyebrow">Für wiederkehrende Forderungen</div>
                <h3>Laufendes Forderungsmanagement</h3>
                <p>
                  Wenn regelmäßig Rechnungen offen bleiben, wird aus einzelnen Erinnerungen schnell ein dauerhafter
                  Aufwand. Wir unterstützen Sie mit einem festen Ablauf, über den Sie Ihre Fälle laufend übergeben.
                </p>
                <a href="#check">
                  Laufende Betreuung prüfen <Arrow />
                </a>
              </article>
              <div className="solution-stack">
                <article className="solution-small">
                  <div className="shape">
                    <Icon name="invoice" size={27} />
                  </div>
                  <h3>Einzelne Forderungen</h3>
                  <p>Auch bei einer einzelnen überfälligen Rechnung können Sie sich an uns wenden.</p>
                </article>
                <article className="solution-small">
                  <div className="shape">
                    <Icon name="scale" size={27} />
                  </div>
                  <h3>Gerichtliche Durchsetzung</h3>
                  <p>
                    Wenn es erforderlich wird, können je nach Sachlage und nach Abstimmung mit Ihnen gerichtliche
                    Schritte über Partnerkanzleien bis hin zur Vollstreckung folgen.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="process" id="ablauf" aria-labelledby="process-title">
          <div className="container">
            <div className="eyebrow">Einfacher Start</div>
            <h2 id="process-title" className="section-title">
              Vier Schritte.
              <br />
              Ein klarer Ablauf.
            </h2>
            <ol className="steps">
              <li className="step">
                <strong>01 / EINSCHÄTZEN</strong>
                <h3>Situation beschreiben</h3>
                <p>Sie schildern uns kurz, welche und wie viele Forderungen offen sind.</p>
              </li>
              <li className="step">
                <strong>02 / ABSTIMMEN</strong>
                <h3>Persönlich sprechen</h3>
                <p>Wir prüfen mit Ihnen die Voraussetzungen und Möglichkeiten.</p>
              </li>
              <li className="step">
                <strong>03 / ENTSCHEIDEN</strong>
                <h3>Modell auswählen</h3>
                <p>Sie entscheiden bewusst, ob und wie Sie uns beauftragen.</p>
              </li>
              <li className="step">
                <strong>04 / DURCHSETZEN</strong>
                <h3>Forderungen übergeben</h3>
                <p>Wir bearbeiten Ihre Fälle im vereinbarten Rahmen und halten Sie informiert.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section faq" id="fragen" aria-labelledby="faq-title">
          <div className="container">
            <div className="eyebrow centered">Gut zu wissen</div>
            <h2 id="faq-title" className="section-title centered">
              Häufige Fragen.
            </h2>
            <div className="faq-list">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="contact" id="kontakt" aria-labelledby="contact-title">
          <div className="container contact-grid">
            <div>
              <div className="eyebrow">Lassen Sie uns sprechen</div>
              <h2 id="contact-title">
                Ein nächster Schritt.
                <br />
                Ganz ohne Verpflichtung.
              </h2>
              <p className="lead">
                Ob ein einzelner Fall oder viele offene Rechnungen: Schildern Sie uns Ihre Situation. Gemeinsam klären
                wir, welche Unterstützung sinnvoll ist.
              </p>
              <div className="contact-detail">
                <b>Sie sprechen lieber direkt mit uns?</b>
                <br />
                <a href={COMPANY.phoneHref}>{COMPANY.phoneDisplay}</a>
                <br />
                <br />
                {COMPANY.name}
                <br />
                {COMPANY.street}, {COMPANY.city}
              </div>
            </div>
            <ContactForm leadMode={leadMode} />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-row">
          <Logo />
          <small>
            © {new Date().getFullYear()} {COMPANY.name} · {COMPANY.street}, {COMPANY.city}
          </small>
          <div className="footer-links">
            <ConsentSettingsButton />
            <a href={COMPANY.imprintUrl} target="_blank" rel="noopener noreferrer">
              Impressum
            </a>
            <a href={COMPANY.privacyUrl} target="_blank" rel="noopener noreferrer">
              Datenschutz
            </a>
          </div>
        </div>
      </footer>
      <ConsentBanner />
    </>
  );
}
