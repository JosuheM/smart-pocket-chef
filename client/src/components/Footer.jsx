import StatusPanel from './StatusPanel.jsx';

export default function Footer({ feedResults, notify }) {
  return (
    <footer className="footer">
      <p>
        Recetas de <a href="https://www.themealdb.com" target="_blank" rel="noreferrer">TheMealDB</a>, fotos de{' '}
        <a href="https://unsplash.com/?utm_source=smart_pocket_chef&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>,
        códigos QR de <a href="https://quickchart.io" target="_blank" rel="noreferrer">QuickChart</a> y traducción automática
        al español. Las recetas peruanas son propias.
      </p>
      <p className="muted">Proyecto académico full-stack: React, Node.js/Express y MySQL.</p>
      <StatusPanel feedResults={feedResults} notify={notify} />
    </footer>
  );
}
