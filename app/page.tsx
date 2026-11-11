import { ConsentBanner, ConsentSettingsButton } from "@/components/ConsentBanner";
import { Funnel, FunnelMicrocopy } from "@/components/Funnel";
import { Arrow, Icon } from "@/components/Icon";
import { COMPANY, LANDING_VARIANT, SHOW_PREVIEW_BAR } from "@/lib/public-config";
import { getLeadMode } from "@/lib/server/config";

const FAQ = [
  {
    q: "Kann ich auch nur eine einzelne Rechnung anfragen?",
    a: "Ja. Sie brauchen keine Mindestanzahl an Fällen. Ob und wie eine Beauftragung für Ihre Forderung sinnvoll ist, besprechen wir offen mit Ihnen.",
  },
  {
    q: "Bei uns bleiben regelmäßig Rechnungen offen. Wie läuft das ab?",
    a: "Dann lohnt sich ein fester Ablauf, über den Sie neue Fälle laufend an uns übergeben. Wie das zu Ihren Abläufen passt, klären wir im Gespräch.",
  },
  {
    q: "Was kostet die Zusammenarbeit?",
    a: "Das hängt von Art und Anzahl Ihrer Forderungen ab. Die Konditionen nennen wir Ihnen im Gespräch, bevor Sie etwas beauftragen. Die Anfrage selbst verpflichtet Sie zu nichts.",
  },
  {
    q: "Was passiert, wenn mein Kunde die Forderung bestreitet?",
    a: "Dann kommt es auf den Sachverhalt, Ihre Unterlagen und den Inhalt der Einwendungen an. Das lässt sich nicht pauschal beantworten – wir sehen uns Ihre Situation individuell an.",
  },
  {
    q: "Ich habe bereits einen Titel. Kann Pajisto trotzdem helfen?",
    a: "Ja, auch titulierte Forderungen können Sie anfragen. Welche Vollstreckungsmaßnahmen in Betracht kommen, klären wir im Einzelfall.",
  },
  {
    q: "Ist die Anfrage schon eine Beauftragung?",
    a: "Nein. Die Anfrage ist unverbindlich und keine Inkasso-Beauftragung. Sie entscheiden nach dem Gespräch, ob und wie Sie uns beauftragen.",
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
      <a className="skip-link" href="#anfrage">
        Direkt zur Anfrage
      </a>
      {SHOW_PREVIEW_BAR && (
        <div className="preview-bar" data-testid="preview-bar">
          VORSCHAU · VARIANTE {LANDING_VARIANT} · NICHT DIE LIVE-SEITE
        </div>
      )}
      <header className="nav-wrap">
        <nav className="nav container" aria-label="Hauptnavigation">
          <Logo />
          <div className="links">
            <a href="#vorteile">Vorteile</a>
            <a href="#ablauf">Ablauf</a>
            <a href="#fragen">Fragen &amp; Antworten</a>
          </div>
          <a href="#anfrage" className="btn btn-dark">
            Anfrage starten <Arrow />
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-grid">
            <div className="hero-head">
              <div className="eyebrow">Forderungsmanagement für Unternehmen</div>
              <h1 className="display" id="hero-title">
                Offene Rechnungen?
                <br />
                <span className="underline">Wir übernehmen das.</span>
              </h1>
            </div>
            <p className="lead hero-sub">
              Ob eine einzelne Forderung oder regelmäßig ausbleibende Zahlungen: Pajisto unterstützt Unternehmen bei der
              professionellen Durchsetzung offener Forderungen – auf Wunsch bis zur Vollstreckung.
            </p>
            <p className="hero-micro">
              <Icon name="check" size={15} />
              <span>
                <FunnelMicrocopy />
              </span>
            </p>
            <div className="hero-funnel">
              <Funnel leadMode={leadMode} />
            </div>
          </div>
        </section>

        <div className="trust">
          <ul className="container trust-row" aria-label="Über Pajisto">
            <li className="trust-item">
              <span>
                <Icon name="shield" size={15} />
              </span>
              Registrierter Inkassodienstleister (§ 10 RDG)
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
              Einzelfälle und laufende Betreuung
            </li>
            <li className="trust-item">
              <span>
                <Icon name="pin" size={15} />
              </span>
              Standort Nürnberg
            </li>
          </ul>
        </div>

        <section className="section" id="vorteile" aria-labelledby="benefits-title">
          <div className="container">
            <div className="section-intro">
              <div className="eyebrow">Was sich für Sie ändert</div>
              <h2 id="benefits-title">
                Sie haben geliefert.
                <br />
                Um die Zahlung kümmern wir uns.
              </h2>
            </div>
            <div className="cards">
              <article className="card">
                <div className="card-icon">
                  <Icon name="clock" size={23} />
                </div>
                <h3>Weniger eigenes Nachfassen</h3>
                <p>
                  Sie müssen nicht mehr selbst immer wieder schreiben und anrufen. Sie übergeben die Forderung, wir
                  übernehmen die Kommunikation mit dem Schuldner.
                </p>
              </article>
              <article className="card">
                <div className="card-icon">
                  <Icon name="shield" size={23} />
                </div>
                <h3>Professionelle Bearbeitung</h3>
                <p>
                  Als registrierter Inkassodienstleister bearbeiten wir Ihre Fälle strukturiert und sachlich. Sie haben
                  einen persönlichen Ansprechpartner und bleiben informiert.
                </p>
              </article>
              <article className="card">
                <div className="card-icon">
                  <Icon name="scale" size={23} />
                </div>
                <h3>Bis zur Vollstreckung, wenn nötig</h3>
                <p>
                  Bleibt die Zahlung aus, können je nach Sachlage und nach Abstimmung mit Ihnen gerichtliche Schritte
                  über Partnerkanzleien und die Vollstreckung folgen.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="process" id="ablauf" aria-labelledby="process-title">
          <div className="container">
            <div className="eyebrow">Nach Ihrer Anfrage</div>
            <h2 id="process-title" className="section-title">
              So geht es weiter.
            </h2>
            <ol className="steps">
              <li className="step">
                <strong>01</strong>
                <h3>Wir melden uns persönlich</h3>
                <p>Per E-Mail oder Rückruf – so, wie Sie es in der Anfrage angeben.</p>
              </li>
              <li className="step">
                <strong>02</strong>
                <h3>Wir besprechen Ihre Situation</h3>
                <p>Welche Forderungen offen sind, was bisher passiert ist und welches Vorgehen dazu passt.</p>
              </li>
              <li className="step">
                <strong>03</strong>
                <h3>Sie entscheiden</h3>
                <p>Sie kennen die Konditionen und entscheiden in Ruhe, ob und wie Sie uns beauftragen.</p>
              </li>
              <li className="step">
                <strong>04</strong>
                <h3>Wir übernehmen</h3>
                <p>Sie übergeben Ihre Forderungen, wir bearbeiten sie im vereinbarten Rahmen.</p>
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

        <section className="final-cta" aria-labelledby="final-title">
          <div className="container final-row">
            <div>
              <h2 id="final-title">Offene Rechnungen müssen nicht Ihr Problem bleiben.</h2>
              <p>
                Ein paar kurze Fragen, dann melden wir uns persönlich. Lieber telefonisch?{" "}
                <a href={COMPANY.phoneHref}>{COMPANY.phoneDisplay}</a>
              </p>
            </div>
            <a href="#anfrage" className="btn btn-lime">
              Anfrage starten <Arrow />
            </a>
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
