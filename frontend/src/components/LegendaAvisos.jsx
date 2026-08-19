export default function LegendaAvisos({ tipo }) {
  const avisosCartao = [
    { cor: '#FFF3CD', texto: 'Amarelo: caractere ilegível (?) ou batidas ímpares' },
    { cor: '#F8D7DA', texto: 'Vermelho: data fora de sequência ou impossível' },
  ];

  const avisosHolerite = [
    { cor: '#FFF3CD', texto: 'Amarelo: caractere ilegível (?) ou página vazia' },
    { cor: '#F8D7DA', texto: 'Vermelho: mês fora de sequência' },
  ];

  const avisos = tipo === 'holerite' ? avisosHolerite : avisosCartao;

  return (
    <div className="review-legend">
      {avisos.map((aviso) => (
        <div key={aviso.texto} className="review-legend__item">
          <span
            className="review-legend__swatch"
            style={{ backgroundColor: aviso.cor }}
          />
          <span>{aviso.texto}</span>
        </div>
      ))}
    </div>
  );
}
