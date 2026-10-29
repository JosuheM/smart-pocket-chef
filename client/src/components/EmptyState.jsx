export default function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
