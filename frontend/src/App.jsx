import { useState } from 'react';
import PainelUpload from './components/PainelUpload';
import PainelDireito from './components/PainelDireito';
import PainelEsquerdo from './components/PainelEsquerdo';
import { normalizarHorario } from './utils/avisos';
import './components/Review.css';

// Em produção/Docker a aplicação chama a mesma origem e o Nginx encaminha
// /api para o backend. O valor pode ser sobrescrito no desenvolvimento local.
const API_URL = import.meta.env.VITE_API_URL || '/api/transcricoes';

function App() {
  const [status, setStatus] = useState('upload');
  const [dadosDaApi, setDadosDaApi] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [tentativaPolling, setTentativaPolling] = useState(0);
  const [statusSalvamento, setStatusSalvamento] = useState('idle');
  const [mensagemSalvamento, setMensagemSalvamento] = useState('');
  const [statusDownload, setStatusDownload] = useState('idle');
  const [mensagemDownload, setMensagemDownload] = useState('');

  const atualizarCampo = (payload) => {
    const copia = JSON.parse(JSON.stringify(dadosDaApi));

    if (payload.tipo === 'cartao-ponto') {
      const { pageIndex, dayIndex, campo, valor, punchIndex } = payload;
      const dia = copia.value.pages[pageIndex].days[dayIndex];

      if (campo === 'date_raw') {
        dia.date_raw = valor;
      } else if (campo === 'time_raw' && punchIndex !== undefined) {
        if (!dia.punches[punchIndex]) {
          dia.punches[punchIndex] = {
            kind: punchIndex % 2 === 0 ? 'IN' : 'OUT',
            time_raw: '',
            time_hhmm: '',
          };
        }
        dia.punches[punchIndex].time_raw = valor;
        dia.punches[punchIndex].time_hhmm = normalizarHorario(valor);
      }
    } else if (payload.tipo === 'holerite') {
      const { pageIndex, campo, valor, label, fieldIndex } = payload;
      const pagina = copia.value.pages[pageIndex];

      if (campo === 'year') {
        pagina.year = valor;
      } else if (campo === 'month') {
        pagina.month = valor;
      } else if (campo === 'field.value') {
        if (fieldIndex !== undefined && fieldIndex >= 0) {
          pagina.fields[fieldIndex].value = valor;
        } else if (label) {
          const idx = pagina.fields.findIndex((f) => f.label === label);
          if (idx >= 0) {
            pagina.fields[idx].value = valor;
          } else {
            pagina.fields.push({ code: '', label, reference: '', value: valor });
          }
        }
      }
    }

    setDadosDaApi(copia);
    setStatusSalvamento('idle');
    setMensagemSalvamento('Há alterações não salvas.');
  };

  const lerMensagemDeErro = async (resposta, mensagemPadrao) => {
    const corpo = await resposta.json().catch(() => ({}));
    return corpo.erro || corpo.message || mensagemPadrao;
  };

  const salvarEdicoes = async () => {
    if (!dadosDaApi?.id || !dadosDaApi?.value) {
      return false;
    }

    setStatusSalvamento('salvando');
    setMensagemSalvamento('Salvando correções...');

    try {
      const resposta = await fetch(`${API_URL}/${dadosDaApi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: dadosDaApi.value }),
      });

      if (!resposta.ok) {
        throw new Error(await lerMensagemDeErro(resposta, 'Não foi possível salvar as correções.'));
      }

      const transcricaoAtualizada = await resposta.json().catch(() => null);
      if (transcricaoAtualizada?.value) {
        setDadosDaApi(transcricaoAtualizada);
      }

      setStatusSalvamento('salvo');
      setMensagemSalvamento('Correções salvas.');
      return true;
    } catch (erro) {
      console.error('Erro ao salvar correções:', erro);
      setStatusSalvamento('erro');
      setMensagemSalvamento(erro.message || 'Não foi possível salvar as correções.');
      return false;
    }
  };

  const baixarPlanilha = async (formato) => {
    if (!dadosDaApi?.id) return;

    setStatusDownload('baixando');
    setMensagemDownload('Preparando download...');

    const salvo = await salvarEdicoes();
    if (!salvo) {
      setStatusDownload('erro');
      setMensagemDownload('Salve as correções antes de baixar a planilha.');
      return;
    }

    try {
      const resposta = await fetch(`${API_URL}/${dadosDaApi.id}/planilha?formato=${formato}`);
      if (!resposta.ok) {
        throw new Error(await lerMensagemDeErro(resposta, 'Não foi possível gerar a planilha.'));
      }

      const arquivo = await resposta.blob();
      const urlArquivo = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      const nomeDoArquivo = resposta.headers
        .get('content-disposition')
        ?.match(/filename[^;=\n]*=(?:UTF-8''|)?"?([^";\n]+)/i)?.[1];

      link.href = urlArquivo;
      link.download = nomeDoArquivo || `transcricao-${dadosDaApi.id}.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(urlArquivo);

      setStatusDownload('concluido');
      setMensagemDownload(`Download .${formato} iniciado.`);
    } catch (erro) {
      console.error('Erro ao baixar planilha:', erro);
      setStatusDownload('erro');
      setMensagemDownload(erro.message || 'Não foi possível baixar a planilha.');
    }
  };

  const enviarParaApi = async (tipo, arquivo) => {
    setStatus('processando');
    setTentativaPolling(0);

    const urlLocal = URL.createObjectURL(arquivo);
    setPdfUrl(urlLocal);

    try {
      const form = new FormData();
      form.append('arquivo', arquivo);
      form.append('tipo', tipo);

      const resPost = await fetch(API_URL, {
        method: 'POST',
        body: form,
      });

      if (!resPost.ok) {
        const erro = await resPost.json().catch(() => ({}));
        throw new Error(erro.erro || 'Falha ao enviar documento.');
      }

      const { id } = await resPost.json();

      let tentativa = 0;
      let dados = null;

      // OCR pode levar mais de 20 segundos. Enquanto o backend informar que
      // ainda está processando, a interface continua aguardando em vez de
      // transformar um trabalho pendente em "erro desconhecido".
      while (!dados || dados.status === 'processando') {
        await new Promise((r) => setTimeout(r, 2000));
        tentativa += 1;
        setTentativaPolling(tentativa);

        const resGet = await fetch(`${API_URL}/${id}`);
        if (!resGet.ok) {
          throw new Error(await lerMensagemDeErro(resGet, 'Não foi possível acompanhar o processamento.'));
        }

        dados = await resGet.json();
      }

      setDadosDaApi(dados);
      setStatusSalvamento('idle');
      setMensagemSalvamento('');
      setStatusDownload('idle');
      setMensagemDownload('');

      if (dados.status === 'concluido') {
        setStatus('revisao');
      } else {
        setStatus('upload');
        alert('Erro no processamento: ' + (dados.erro || 'O backend não informou o motivo.'));
      }
    } catch (erro) {
      console.error('Erro ao conectar com a API:', erro);
      setStatus('upload');
      alert(erro.message || 'Falha na comunicação com o servidor!');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'left' }}>
      <h1 style={{ textAlign: 'center' }}>Quick Filler - Sistema de Transcrição</h1>
      <hr />

      {status === 'upload' && <PainelUpload aoEnviar={enviarParaApi} />}

      {status === 'processando' && (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <h2>Processando documento no OCR...</h2>
          <p>Isso pode levar alguns minutos, conforme o número de páginas e a qualidade do PDF.</p>
          {tentativaPolling > 0 && (
            <p style={{ color: '#666' }}>
              Aguardando resposta há aproximadamente {tentativaPolling * 2}s
            </p>
          )}
        </div>
      )}

      {status === 'revisao' && (
        <div className="review-layout">
          <PainelEsquerdo pdfUrl={pdfUrl} />
          <PainelDireito
            dados={dadosDaApi}
            atualizarCampo={atualizarCampo}
            salvarEdicoes={salvarEdicoes}
            baixarPlanilha={baixarPlanilha}
            statusSalvamento={statusSalvamento}
            mensagemSalvamento={mensagemSalvamento}
            statusDownload={statusDownload}
            mensagemDownload={mensagemDownload}
          />
        </div>
      )}
    </div>
  );
}

export default App;
