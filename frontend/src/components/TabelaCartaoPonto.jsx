import { Fragment } from 'react';
import { calcularAvisosCartao, estiloLinha, flattenDiasCartao } from '../utils/avisos';

export default function TabelaCartaoPonto({ dados, atualizarCampo }) {
  const pages = dados?.value?.pages;
  if (!pages?.length) return <p>Nenhum dado de cartão de ponto extraído.</p>;

  const linhas = flattenDiasCartao(pages);
  if (!linhas.length) return <p>Nenhum dia encontrado na transcrição.</p>;

  const maxPares = Math.max(1, ...linhas.map(({ dia }) => Math.ceil((dia.punches || []).length / 2)));
  const colunasBatida = Array.from({ length: maxPares }, (_, index) => index);
  const linhasComAvisos = linhas.map(({ pageIndex, dayIndex, dia }, index) => {
    const anterior = linhas.slice(0, index).reverse().find(({ dia: item }) => parseDataLegivel(item.date_raw))?.dia ?? null;
    const avisos = calcularAvisosCartao(dia, anterior);
    return { pageIndex, dayIndex, dia, avisos, estilo: estiloLinha(avisos) };
  });

  return (
    <div className="review-table-scroll" tabIndex="0" aria-label="Tabela editável do cartão de ponto">
      <table className="review-table">
        <thead>
          <tr>
            <th className="review-table__alerts">Avisos</th>
            <th className="review-table__date">Data</th>
            {colunasBatida.map((parIndex) => <Fragment key={`header-${parIndex}`}><th className="review-table__time">Entrada {parIndex + 1}</th><th className="review-table__time">Saída {parIndex + 1}</th></Fragment>)}
          </tr>
        </thead>
        <tbody>
          {linhasComAvisos.map(({ pageIndex, dayIndex, dia, avisos, estilo }, index) => (
            <tr key={`${pageIndex}-${dayIndex}-${index}`} style={estilo}>
              <td className="review-table__alerts">{avisos.motivos.length ? avisos.motivos.join('; ') : '—'}</td>
              <td className="review-table__date" style={{ borderLeft: estilo.borderLeft }}>
                <input className="review-input review-input--date" value={dia.date_raw || ''} onChange={(event) => atualizarCampo({ tipo: 'cartao-ponto', pageIndex, dayIndex, campo: 'date_raw', valor: event.target.value })} />
              </td>
              {colunasBatida.map((parIndex) => {
                const entrada = dia.punches?.[parIndex * 2];
                const saida = dia.punches?.[parIndex * 2 + 1];
                return (
                  <Fragment key={`row-${pageIndex}-${dayIndex}-${parIndex}`}>
                    <td className="review-table__time"><input className="review-input review-input--time" value={entrada?.time_raw || ''} placeholder="--:--" onChange={(event) => atualizarCampo({ tipo: 'cartao-ponto', pageIndex, dayIndex, campo: 'time_raw', valor: event.target.value, punchIndex: parIndex * 2 })} /></td>
                    <td className="review-table__time"><input className="review-input review-input--time" value={saida?.time_raw || ''} placeholder="--:--" onChange={(event) => atualizarCampo({ tipo: 'cartao-ponto', pageIndex, dayIndex, campo: 'time_raw', valor: event.target.value, punchIndex: parIndex * 2 + 1 })} /></td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function parseDataLegivel(dateRaw) {
  if (!dateRaw || dateRaw.includes('?')) return false;
  const partes = dateRaw.split('/');
  if (partes.length !== 3) return false;
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  return !Number.isNaN(dia) && !Number.isNaN(mes) && dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12;
}
