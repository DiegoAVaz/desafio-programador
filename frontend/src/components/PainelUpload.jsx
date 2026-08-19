import { useState } from 'react';

export default function PainelUpload({ aoEnviar }) {
  const [tipo, setTipo] = useState('cartao-ponto');
  const [arquivo, setArquivo] = useState(null);

  const lidarComEnvio = (e) => {
    e.preventDefault();
    if (!arquivo) return alert('Selecione um PDF!');

    aoEnviar(tipo, arquivo);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '400px' }}>
      <h2>Nova Transcrição</h2>
      <form onSubmit={lidarComEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <label>
          Tipo de Documento:
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="cartao-ponto">Cartão de Ponto</option>
            <option value="holerite">Holerite</option>
          </select>
        </label>

        <label>
          Arquivo PDF:
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={e => setArquivo(e.target.files[0])} 
            style={{ width: '100%' }} 
          />
        </label>

        <button type="submit" style={{ padding: '10px', backgroundColor: '#173772', color: 'white', border: 'none', cursor: 'pointer' }}>
          Enviar Documento
        </button>
      </form>
    </div>
  );
}