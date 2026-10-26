import Link from "next/link";
import Icon from "@/components/icon";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span /> O SEU PRÓXIMO MOMENTO COMEÇA AQUI
          </div>
          <h1>
            O seu estilo.
            <br />O seu tempo.
            <br />
            <span>À sua maneira.</span>
          </h1>
          <p>
            Reserve o seu próximo cuidado em poucos passos. Escolha o serviço,
            encontre o horário e deixe o resto connosco.
          </p>
          <div className="actions">
            <Link className="button" href="/reservar">
              Fazer uma marcação <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="#como-funciona">
              Como funciona <span>↓</span>
            </Link>
          </div>
          <div className="hero-note">
            <Icon name="check" size={16} /> Serviços, profissionais e horários
            num só lugar.
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-top">
            <span>FEITO PARA SI</span>
            <Icon name="spark" size={30} />
          </div>
          <div className="sculpture" aria-hidden="true">
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>
          <div className="visual-title">
            O cuidado
            <br />
            tem o seu ritmo.
          </div>
          <div className="visual-bottom">
            <span>BELEZA & BEM-ESTAR</span>
            <span>01 — 03</span>
          </div>
          <div className="floating-label">
            <span className="circle-icon">
              <Icon name="calendar" />
            </span>
            <div>
              <strong>Mais espaço na sua agenda.</strong>
              <small>Mais tempo para si.</small>
            </div>
            <Icon name="arrow" size={18} />
          </div>
        </div>
      </section>
      <div className="benefit-strip">
        {[
          ["calendar", "Marcações online"],
          ["user", "Escolha do profissional"],
          ["clock", "Horários disponíveis"],
          ["check", "Confirmação pela equipa"],
        ].map(([icon, label]) => (
          <span key={label}>
            <Icon name={icon} size={18} />
            {label}
          </span>
        ))}
      </div>
      <section className="section" id="como-funciona">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SEM COMPLICAÇÕES</div>
            <h2>
              Do primeiro clique
              <br />
              ao seu próximo cuidado.
            </h2>
          </div>
          <p>
            Uma experiência simples.
            <br />
            Antes, durante e depois da marcação.
          </p>
        </div>
        <div className="grid steps">
          {[
            [
              "01",
              "spark",
              "Escolha o cuidado.",
              "Consulte os serviços, preços e duração. Encontre o que combina consigo.",
            ],
            [
              "02",
              "calendar",
              "Encontre o momento.",
              "Escolha o profissional e um dos horários disponíveis na agenda.",
            ],
            [
              "03",
              "check",
              "Está quase tudo pronto.",
              "Efectue o pagamento integral. A equipa valida o recebimento e confirma a marcação.",
            ],
          ].map(([n, icon, t, d]) => (
            <article className="card" key={n}>
              <div className="step-top">
                <span className="step-icon">
                  <Icon name={icon} size={25} />
                </span>
                <span className="step-number">{n}</span>
              </div>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bottom-banner">
        <div className="banner-mark" aria-hidden="true">
          <Icon name="spark" size={70} />
        </div>
        <div>
          <div className="eyebrow">O SEU ESPAÇO PESSOAL</div>
          <h2>
            Menos mensagens.
            <br />
            Mais tempo para si.
          </h2>
          <p>
            Acompanhe as suas marcações e consulte os detalhes na sua conta.
          </p>
        </div>
        <Link className="button" href="/minhas-marcacoes">
          Ver as minhas marcações <Icon name="arrow" />
        </Link>
      </section>
    </>
  );
}
