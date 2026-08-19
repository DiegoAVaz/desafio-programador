import LegendaAvisos from './LegendaAvisos';
import TabelaCartaoPonto from './TabelaCartaoPonto';
import TabelaHolerite from './TabelaHolerite';

export default function PainelDireito({
  dados,
  atualizarCampo,
  salvarEdicoes,
  baixarPlanilha,
  statusSalvamento,
  mensagemSalvamento,
  statusDownload,
  mensagemDownload,
}) {
  if (!dados) {
    return <div className="review-card"><p>Nenhum dado disponível.</p></div>;
  }

  if (!dados.value) {
    return (
      <div className="review-card">
        <h2 className="review-card__title">Revisão ({dados.tipo})</h2>
        <p>Nenhum dado extraído.</p>
        {dados.erro && <p className="review-message review-message--error">Erro: {dados.erro}</p>}
      </div>
    );
  }

  return (
    <section className="review-card">
      <header className="review-card__header">
        <div>
          <h2 className="review-card__title">Revisão da transcrição</h2>
          <p className="review-card__subtitle">
            {dados.tipo === 'holerite' ? 'Holerite' : 'Cartão de ponto'} · edite, salve e exporte os dados revisados.
          </p>
        </div>
      </header>

      <LegendaAvisos tipo={dados.tipo} />

      <div className="review-actions">
        <button
          type="button"
          className="review-button review-button--primary"
          onClick={salvarEdicoes}
          disabled={statusSalvamento === 'salvando' || statusDownload === 'baixando'}
        >
          {statusSalvamento === 'salvando' ? 'Salvando...' : 'Salvar correções'}
        </button>
        <button
          type="button"
          className="review-button"
          onClick={() => baixarPlanilha('xlsx')}
          disabled={statusSalvamento === 'salvando' || statusDownload === 'baixando'}
        >
          {statusDownload === 'baixando' ? 'Gerando...' : 'Baixar XLSX'}
        </button>
        <button type="button" className="review-button" onClick={() => baixarPlanilha('csv')} disabled={statusSalvamento === 'salvando' || statusDownload === 'baixando'}>CSV</button>
        <button type="button" className="review-button" onClick={() => baixarPlanilha('json')} disabled={statusSalvamento === 'salvando' || statusDownload === 'baixando'}>JSON</button>
        {mensagemSalvamento && <p className={`review-message${statusSalvamento === 'erro' ? ' review-message--error' : ''}`} role={statusSalvamento === 'erro' ? 'alert' : 'status'}>{mensagemSalvamento}</p>}
        {mensagemDownload && <p className={`review-message${statusDownload === 'erro' ? ' review-message--error' : ''}`} role={statusDownload === 'erro' ? 'alert' : 'status'}>{mensagemDownload}</p>}
      </div>

      {dados.tipo === 'holerite'
        ? <TabelaHolerite dados={dados} atualizarCampo={atualizarCampo} />
        : <TabelaCartaoPonto dados={dados} atualizarCampo={atualizarCampo} />}
    </section>
  );
}
