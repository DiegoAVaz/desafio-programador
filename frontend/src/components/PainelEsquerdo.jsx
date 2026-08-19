export default function PainelEsquerdo({ pdfUrl }) {
  if (!pdfUrl) {
    return (
      <div className="pdf-panel">
        <h2 className="pdf-panel__title">Visualizador PDF</h2>
        <p className="pdf-panel__empty">Nenhum PDF carregado.</p>
      </div>
    );
  }

  return (
    <div className="pdf-panel">
      <h2 className="pdf-panel__title">Visualizador PDF</h2>
      <iframe
        src={pdfUrl}
        className="pdf-panel__viewer"
        title="Visualizador de Documento"
      />
    </div>
  );
}
