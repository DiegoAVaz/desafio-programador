import { calcularAvisosHolerite, coletarLabelsHolerite, estiloLinha, parseCompetencia } from '../utils/avisos';

export default function TabelaHolerite({ dados, atualizarCampo }) {
  const pages = dados?.value?.pages;
  if (!pages?.length) return <p>Nenhum dado de holerite extraído.</p>;

  const labels = coletarLabelsHolerite(pages);
  const paginasComAvisos = pages.map((pagina, pageIndex) => {
    const anterior = pages.slice(0, pageIndex).reverse().find((item) => parseCompetencia(item.year, item.month) !== null) ?? null;
    const avisos = calcularAvisosHolerite(pagina, anterior);
    return { pagina, pageIndex, avisos, estilo: estiloLinha(avisos) };
  });

  return (
    <div className="review-table-scroll" tabIndex="0" aria-label="Tabela editável do holerite">
      <table className="review-table">
        <thead><tr><th className="review-table__alerts">Avisos</th><th className="review-table__page">Pág.</th><th className="review-table__month">Mês</th><th className="review-table__year">Ano</th>{labels.map((label) => <th key={label} className="review-table__money">{label}</th>)}</tr></thead>
        <tbody>
          {paginasComAvisos.map(({ pagina, pageIndex, avisos, estilo }) => (
            <tr key={pagina.page} style={estilo}>
              <td className="review-table__alerts">{avisos.motivos.length ? avisos.motivos.join('; ') : '—'}</td>
              <td className="review-table__page" style={{ borderLeft: estilo.borderLeft }}>{pagina.page}</td>
              <td className="review-table__month"><input className="review-input review-input--date" value={pagina.month || ''} onChange={(event) => atualizarCampo({ tipo: 'holerite', pageIndex, campo: 'month', valor: event.target.value })} /></td>
              <td className="review-table__year"><input className="review-input review-input--date" value={pagina.year || ''} onChange={(event) => atualizarCampo({ tipo: 'holerite', pageIndex, campo: 'year', valor: event.target.value })} /></td>
              {labels.map((label) => {
                const fieldIndex = (pagina.fields || []).findIndex((field) => field.label === label);
                const field = fieldIndex >= 0 ? pagina.fields[fieldIndex] : null;
                return <td key={label} className="review-table__money"><input className="review-input review-input--money" value={field?.value || ''} onChange={(event) => atualizarCampo({ tipo: 'holerite', pageIndex, campo: 'field.value', valor: event.target.value, label, fieldIndex: fieldIndex >= 0 ? fieldIndex : undefined })} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
