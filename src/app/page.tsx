import Link from "next/link";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">BELEZA, COM TEMPO PARA SI</div>
          <h1>
            O seu próximo
            <br />
            momento de <em>cuidado.</em>
          </h1>
          <p>
            Mais simples de marcar. Mais tempo para desfrutar. Encontre o
            serviço e o profissional para cuidar de si.
          </p>
          <div className="actions">
            <Link className="button" href="/reservar">
              Marcar o meu momento <span>↗</span>
            </Link>
            <Link className="text-link" href="/minhas-marcacoes">
              Ver as minhas marcações →
            </Link>
          </div>
          <div className="hero-note">
            <span>✦</span> Escolha o horário que combina consigo.
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-vase" />
          <div className="art-stem stem-one" />
          <div className="art-stem stem-two" />
          <div className="art-stem stem-three" />
          <span className="art-word">floresça.</span>
          <div className="art-caption">
            UM MOMENTO SÓ SEU
            <br />
            <b>Beleza em cada detalhe.</b>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SIMPLES, DO INÍCIO AO FIM</div>
            <h2>O cuidado começa na marcação.</h2>
          </div>
          <span className="muted">
            Três passos até ao seu próximo atendimento
          </span>
        </div>
        <div className="grid steps">
          {[
            [
              "01",
              "Encontre o seu serviço",
              "Consulte preços e duração. Escolha o cuidado de que precisa.",
            ],
            [
              "02",
              "Escolha o seu momento",
              "Seleccione um profissional e um horário disponível na agenda.",
            ],
            [
              "03",
              "Confirme o pagamento",
              "A equipa valida o pagamento integral e confirma a sua marcação.",
            ],
          ].map(([n, t, d]) => (
            <article className="card" key={n}>
              <span className="step-number">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bottom-banner">
        <div>
          <div className="eyebrow">TUDO NUM SÓ LUGAR</div>
          <h2>A sua agenda de beleza, sempre consigo.</h2>
          <p>Acompanhe o estado das suas marcações na sua conta.</p>
        </div>
        <Link className="button ghost" href="/entrar">
          Aceder à minha conta ↗
        </Link>
      </section>
    </>
  );
}
